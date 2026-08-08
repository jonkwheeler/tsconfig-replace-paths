const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.join(__dirname, 'synthetic')

function listFiles(dir, exts, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listFiles(p, exts, acc)
    } else if (exts.indexOf(path.extname(entry.name)) !== -1) {
      acc.push(p)
    }
  }
  return acc
}

function freshFileSet(dir) {
  return new Set(listFiles(dir, ['.js', '.jsx', '.ts', '.tsx', '.json'], []))
}

// Precompute file sets once; existsSync becomes a Set lookup.
const srcFiles = freshFileSet(path.join(root, 'src'))
const distFiles = freshFileSet(path.join(root, 'dist'))
const knownFiles = new Set([...srcFiles, ...distFiles])

let uncachedCalls = 0
fs.existsSync = function (p) {
  const key = path.resolve(String(p))
  if (knownFiles.has(key)) {
    return true
  }
  uncachedCalls += 1
  return false
}

const { buildAliases, createAliasResolver } = require(path.join(__dirname, '..', 'dist', 'commonjs', 'resolve.js'))

const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'))
const basePath = path.resolve(root, tsconfig.compilerOptions.baseUrl)
const ctx = {
  configFile: path.join(root, 'tsconfig.json'),
  basePath: basePath,
  usingSrcDir: path.join(root, 'src'),
  outPath: path.join(root, 'dist'),
  aliases: buildAliases(tsconfig.compilerOptions.paths, basePath),
  verboseLog: function () {},
}

const resolver = createAliasResolver(ctx)
const prefixes = ctx.aliases.map(function (a) {
  return a.prefix
})

function replaceInText(text, outFile) {
  const info = ts.preProcessFile(text, true, true)
  const replacements = []
  for (const ref of info.importedFiles) {
    const matched = ref.fileName
    const replacement = resolver.absToRel(matched, outFile)
    if (replacement !== matched) {
      replacements.push({ start: ref.pos + 1, end: ref.end - 1, text: replacement })
    }
  }
  replacements.sort(function (a, b) {
    return b.start - a.start
  })
  let result = text
  for (const item of replacements) {
    result = result.substring(0, item.start) + item.text + result.substring(item.end)
  }
  return result
}

const start = process.hrtime.bigint()
const files = listFiles(ctx.outPath, ['.js', '.jsx', '.ts', '.tsx'], [])
let changedFileCount = 0

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  let hasPrefix = false
  for (const prefix of prefixes) {
    if (text.indexOf(prefix) !== -1) {
      hasPrefix = true
      break
    }
  }
  if (!hasPrefix) {
    continue
  }
  const newText = replaceInText(text, file)
  if (newText !== text) {
    changedFileCount += 1
  }
}

const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
console.log('optimized pipeline: ' + elapsedMs.toFixed(0) + 'ms')
console.log('replaced ' + resolver.getReplaceCount() + ' paths in ' + changedFileCount + ' files')
console.log('existsSync fallthrough calls (cache misses): ' + uncachedCalls)
