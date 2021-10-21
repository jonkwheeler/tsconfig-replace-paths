#! /usr/bin/env node

import * as program from 'commander'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { sync } from 'globby'
import { dirname, relative, resolve } from 'path'
import { loadConfig } from './util'

program
  .version('0.0.1')
  .option('-p, --project <file>', 'path to tsconfig.json')
  .option('-s, --src <path>', 'source root path')
  .option('-o, --out <path>', 'output root path')
  .option('-v, --verbose', 'output logs')
  .option('-q, --quiet', 'suppress logs')

program.on('--help', () => {
  console.log(`
  $ tscpath -p tsconfig.json
`)
})

program.parse(process.argv)

const {
  out: flagOut,
  project,
  quiet = true,
  src: flagSrc,
  verbose = false,
} = program as {
  out?: string | undefined
  project?: string
  quiet?: boolean
  src?: string | undefined
  verbose?: boolean
}

if (!project) {
  throw new Error('--project must be specified')
}

const log = (...args: any[]): void => {
  if (verbose || !quiet) {
    console.log(...args)
  }
}

const configFile = resolve(process.cwd(), project)

log(`Using tsconfig: ${configFile}`)

const exitingErr = (): any => {
  throw new Error('--- exiting tsconfig-replace-paths due to parameters missing ---')
}

const missingConfigErr = (property: string): any => {
  console.error(`Whoops! Please set ${property} in your tsconfig or supply a flag`)
  exitingErr()
}

const missingDirectoryErr = (directory: string, flag: string): any => {
  console.error(
    `Whoops! ${directory} must be specified in your project => --project ${project}, or flagged with directory => ${flag} './path'`,
  )
  exitingErr()
}

// Imported the TS Config
const returnedTsConfig = loadConfig(configFile)

// Destructure only the necessary keys, and rename to give context
const { baseUrl, paths, outDir: tsConfigOutDir = '', rootDir: tsConfigRootDir = '' } = returnedTsConfig

// If no flagSrc or tsConfigRootDir, error
if (!flagSrc && tsConfigRootDir === '') {
  missingConfigErr('compilerOptions.rootDir')
}

// If no flagOut or tsConfigOutDir, error
if (!flagOut && tsConfigOutDir === '') {
  missingConfigErr('compilerOptions.outDir')
}

// Are we going to use the flag or ts config for src?
let usingSrcDir: string
if (flagSrc) {
  log('Using flag --src')
  usingSrcDir = resolve(flagSrc)
} else {
  log('Using compilerOptions.rootDir from your tsconfig')
  usingSrcDir = resolve(tsConfigRootDir)
}
if (!usingSrcDir) {
  missingDirectoryErr('rootDir', '--src')
}

// Log which src is being used
log(`Using src: ${usingSrcDir}`)

// Are we going to use the flag or ts config for out?
let usingOutDir: string
if (flagOut) {
  log('Using flag --out')
  usingOutDir = resolve(flagOut)
} else {
  log('Using compilerOptions.outDir from your tsconfig')
  usingOutDir = resolve(tsConfigOutDir)
}
if (!usingOutDir) {
  missingDirectoryErr('outDir', '--out')
}

// Log which out is being used
log(`Using out: ${usingOutDir}`)

if (!baseUrl) {
  throw new Error('compilerOptions.baseUrl is not set')
}
if (!paths) {
  throw new Error('compilerOptions.paths is not set')
}
if (!usingOutDir) {
  throw new Error('compilerOptions.outDir is not set')
}
if (!usingSrcDir) {
  throw new Error('compilerOptions.rootDir is not set')
}

log(`baseUrl: ${baseUrl}`)
log(`rootDir: ${usingSrcDir}`)
log(`outDir: ${usingOutDir}`)
log(`paths: ${JSON.stringify(paths, null, 2)}`)

const configDir = dirname(configFile)

const basePath = resolve(configDir, baseUrl)
log(`basePath: ${basePath}`)

const outPath = usingOutDir || resolve(basePath, usingOutDir)
log(`outPath: ${outPath}`)

const outFileToSrcFile = (x: string): string => resolve(usingSrcDir, relative(outPath, x))

const aliases = Object.keys(paths)
  .map(alias => ({
    prefix: alias.replace(/\*$/, ''),
    aliasPaths: paths[alias as keyof typeof paths].map(p => resolve(basePath, p.replace(/\*$/, ''))),
  }))
  .filter(({ prefix }) => prefix)
log(`aliases: ${JSON.stringify(aliases, null, 2)}`)

const toRelative = (from: string, x: string): string => {
  const rel = relative(from, x)
  return (rel.startsWith('.') ? rel : `./${rel}`).replace(/\\/g, '/')
}

const exts = ['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.json']

let replaceCount = 0

const absToRel = (modulePath: string, outFile: string): string => {
  const alen = aliases.length

  for (let j = 0; j < alen; j += 1) {
    const { prefix, aliasPaths } = aliases[j]

    if (modulePath.startsWith(prefix)) {
      const modulePathRel = modulePath.substring(prefix.length)
      const srcFile = outFileToSrcFile(outFile)
      const outRel = relative(basePath, outFile)

      log(`${outRel} (source: ${relative(basePath, srcFile)}):`)
      log(`\timport '${modulePath}'`)

      const len = aliasPaths.length
      for (let i = 0; i < len; i += 1) {
        const apath = aliasPaths[i]
        const moduleSrc = resolve(apath, modulePathRel)
        if (existsSync(moduleSrc) || exts.some(ext => existsSync(moduleSrc + ext))) {
          const rel = toRelative(dirname(srcFile), moduleSrc)

          replaceCount += 1

          log(`\treplacing '${modulePath}' -> '${rel}' referencing ${relative(basePath, moduleSrc)}`)
          return rel
        }
      }
      log(`\tcould not replace ${modulePath}`)
    }
  }

  return modulePath
}

const requireRegex = /(?:import|require)\(['"]([^'"]*)['"]\)/g
const importRegex = /(?:import|from) ['"]([^'"]*)['"]/g

const replaceImportStatement = (orig: string, matched: string, outFile: string): string => {
  const index = orig.indexOf(matched)
  return orig.substring(0, index) + absToRel(matched, outFile) + orig.substring(index + matched.length)
}

const replaceAlias = (text: string, outFile: string): string =>
  text
    .replace(requireRegex, (orig, matched) => replaceImportStatement(orig, matched, outFile))
    .replace(importRegex, (orig, matched) => replaceImportStatement(orig, matched, outFile))

// import relative to absolute path
const files = sync(`${outPath}/**/*.{js,jsx,ts,tsx}`, {
  dot: true,
  noDir: true,
} as any).map(x => resolve(x))

let changedFileCount = 0

const flen = files.length
let count = 0

for (let i = 0; i < flen; i += 1) {
  const file = files[i]
  const text = readFileSync(file, 'utf8')
  const prevReplaceCount = replaceCount
  const newText = replaceAlias(text, file)
  if (text !== newText) {
    changedFileCount += 1
    log(`${file}: replaced ${replaceCount - prevReplaceCount} paths`)
    writeFileSync(file, newText, 'utf8')
    count = count + 1
  }
}

console.log(`Replaced ${replaceCount} paths in ${changedFileCount} files`)
