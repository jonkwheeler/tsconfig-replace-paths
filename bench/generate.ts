import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, 'synthetic')
const srcDir = path.join(root, 'src')
const distDir = path.join(root, 'dist')

const FILE_COUNT = Number(process.argv[2] || 2000)
const ALIAS_IMPORTS_PER_FILE = 3
const RELATIVE_IMPORTS_PER_FILE = 2

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function writeBoth(relPath: string, content: string): void {
  const srcFile = path.join(srcDir, relPath)
  const distFile = path.join(distDir, relPath)
  ensureDir(path.dirname(srcFile))
  ensureDir(path.dirname(distFile))
  fs.writeFileSync(srcFile, content)
  fs.writeFileSync(distFile, content)
}

function main(): void {
  fs.rmSync(root, { recursive: true, force: true })
  ensureDir(srcDir)
  ensureDir(distDir)

  const dirs = ['utils', 'services', 'models', 'lib/deep/nested']
  for (let d = 0; d < dirs.length; d += 1) {
    for (let i = 0; i < 25; i += 1) {
      writeBoth(path.join(dirs[d], `mod${i}.js`), `export const value${i} = ${i}\n`)
    }
  }

  for (let i = 0; i < FILE_COUNT; i += 1) {
    const lines: string[] = []
    for (let a = 0; a < ALIAS_IMPORTS_PER_FILE; a += 1) {
      const dir = dirs[(i + a) % dirs.length]
      const mod = (i * 7 + a * 13) % 25
      lines.push(`import { value${mod} } from '@alias/${dir === 'lib/deep/nested' ? 'deep' : dir}/mod${mod}'`)
    }
    for (let r = 0; r < RELATIVE_IMPORTS_PER_FILE; r += 1) {
      lines.push(`import { value${r} } from './utils/mod${r}'`)
    }
    lines.push(`export const main${i} = ${i}`)
    writeBoth(`feature${i % 20}/file${i}.js`, lines.join('\n') + '\n')
  }

  const tsconfig = {
    compilerOptions: {
      baseUrl: './src',
      outDir: './dist',
      rootDir: './src',
      paths: {
        '@alias/utils/*': ['utils/*'],
        '@alias/services/*': ['services/*'],
        '@alias/models/*': ['models/*'],
        '@alias/deep/*': ['lib/deep/nested/*'],
      },
    },
  }
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

  console.log(`generated ${FILE_COUNT} feature files + 100 lib modules in ${root}`)
}

main()
