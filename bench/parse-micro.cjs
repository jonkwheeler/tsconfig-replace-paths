const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const distDir = path.join(__dirname, 'synthetic', 'dist')

function listJs(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listJs(p, acc)
    } else if (p.endsWith('.js')) {
      acc.push(p)
    }
  }
  return acc
}

const files = listJs(distDir, [])
const texts = files.map(function (f) {
  return fs.readFileSync(f, 'utf8')
})

function time(label, fn) {
  const start = process.hrtime.bigint()
  const out = fn()
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  console.log(label + ': ' + ms.toFixed(0) + 'ms' + (out !== undefined ? ' (' + out + ')' : ''))
}

time('createSourceFile setParentNodes=true', function () {
  let n = 0
  for (let i = 0; i < files.length; i += 1) {
    ts.createSourceFile(files[i], texts[i], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    n += 1
  }
  return n
})

time('createSourceFile setParentNodes=false', function () {
  let n = 0
  for (let i = 0; i < files.length; i += 1) {
    ts.createSourceFile(files[i], texts[i], ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
    n += 1
  }
  return n
})

time('ts.preProcessFile', function () {
  let n = 0
  let imports = 0
  for (let i = 0; i < files.length; i += 1) {
    const info = ts.preProcessFile(texts[i], true, true)
    imports += info.importedFiles.length
    n += 1
  }
  return n + ' files, ' + imports + ' imports'
})

time('prefix pre-filter (String.includes)', function () {
  let hits = 0
  for (let i = 0; i < files.length; i += 1) {
    if (texts[i].includes('@alias/')) {
      hits += 1
    }
  }
  return hits + ' hits'
})

const sample = ts.preProcessFile(texts[0], true, true)
console.log('sample importedFiles:', JSON.stringify(sample.importedFiles, null, 2))
console.log('sample text:', JSON.stringify(texts[0].split('\n')[0]))

const mixed = ts.preProcessFile(
  "import a from '@alias/x'\nexport { b } from '@alias/y'\nconst c = require('@alias/z')\nconst d = import('@alias/dyn')\nconst e = \"@alias/not-an-import\"\n",
  true,
  true,
)
console.log('mixed detection:', JSON.stringify(mixed.importedFiles))
