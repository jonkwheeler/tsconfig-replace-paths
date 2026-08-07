import * as ts from 'typescript'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, extname, join, relative, resolve } from 'path'
import { loadConfig } from './config'
import { buildAliases, createAliasResolver } from './resolve'
import { ReplacePathsOptions, ReplacePathsResult, ResolvedContext } from './types'

const OUTPUT_FILE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']

function createVerboseLog(verbose: boolean, quiet: boolean): (...args: unknown[]) => void {
  return function (...args: unknown[]): void {
    if (verbose && !quiet) {
      console.log(...args)
    }
  }
}

function listConfigCandidates(configFile: string, cwd: string): string[] {
  const configDir = dirname(configFile)
  try {
    return readdirSync(configDir)
      .filter(function (entry) {
        return /^tsconfig.*\.json$/.test(entry)
      })
      .sort()
      .map(function (entry) {
        return relative(cwd, join(configDir, entry))
      })
  } catch {
    return []
  }
}

function buildContext(options: ReplacePathsOptions): ResolvedContext {
  const cwd = options.cwd || process.cwd()
  const project = options.project || 'tsconfig.json'
  const configFile = resolve(cwd, project)
  const verboseLog = createVerboseLog(Boolean(options.verbose), Boolean(options.quiet))

  verboseLog(`Using tsconfig: ${configFile}`)

  if (!existsSync(configFile)) {
    const candidates = listConfigCandidates(configFile, cwd)
    let hint = ''
    if (candidates.length === 1) {
      hint = ` Found: ${candidates[0]} — use --project ${candidates[0]}`
    } else if (candidates.length > 1) {
      hint = ` Found: ${candidates.join(', ')} — pass one with --project (e.g. --project ${candidates[0]})`
    }
    throw new Error(`tsconfig not found at ${configFile}.${hint}`)
  }

  const returnedTsConfig = loadConfig(configFile)
  const { baseUrl, paths, outDir: tsConfigOutDir, rootDir: tsConfigRootDir } = returnedTsConfig

  let usingSrcDir: string
  if (options.src) {
    verboseLog('Using flag --src')
    usingSrcDir = resolve(cwd, options.src)
  } else if (tsConfigRootDir) {
    verboseLog('Using compilerOptions.rootDir from your tsconfig')
    usingSrcDir = tsConfigRootDir
  } else {
    usingSrcDir = cwd
  }

  verboseLog(`Using src: ${usingSrcDir}`)

  let usingOutDir: string
  if (options.out) {
    verboseLog('Using flag --out')
    usingOutDir = resolve(cwd, options.out)
  } else if (tsConfigOutDir) {
    verboseLog('Using compilerOptions.outDir from your tsconfig')
    usingOutDir = tsConfigOutDir
  } else {
    throw new Error(
      `outDir must be specified in your project => --project ${project}, or flagged with directory => --out './path'`,
    )
  }

  verboseLog(`Using out: ${usingOutDir}`)

  if (!paths) {
    throw new Error('compilerOptions.paths is not set')
  }

  const configDir = dirname(configFile)
  const basePath = baseUrl ? resolve(configDir, baseUrl) : configDir

  verboseLog(`baseUrl: ${baseUrl || '(unset, relative to tsconfig)'}`)
  verboseLog(`rootDir: ${usingSrcDir}`)
  verboseLog(`outDir: ${usingOutDir}`)
  verboseLog(`paths: ${JSON.stringify(paths, null, 2)}`)
  verboseLog(`basePath: ${basePath}`)

  const aliases = buildAliases(paths, basePath)
  verboseLog(`aliases: ${JSON.stringify(aliases, null, 2)}`)

  return {
    configFile: configFile,
    basePath: basePath,
    usingSrcDir: usingSrcDir,
    outPath: usingOutDir,
    aliases: aliases,
    verboseLog: verboseLog,
  }
}

function walkOutputFiles(dir: string, acc: string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkOutputFiles(entryPath, acc)
    } else if (OUTPUT_FILE_EXTS.indexOf(extname(entry.name)) !== -1) {
      acc.push(entryPath)
    }
  }

  return acc
}

function hasAnyPrefix(text: string, prefixes: string[]): boolean {
  for (let i = 0; i < prefixes.length; i += 1) {
    if (text.indexOf(prefixes[i]) !== -1) {
      return true
    }
  }
  return false
}

interface Replacement {
  start: number
  end: number
  text: string
}

function findClosingQuote(text: string, openPos: number): number {
  const quote = text.charAt(openPos)
  let i = openPos + 1
  while (i < text.length) {
    const ch = text.charAt(i)
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) {
      return i
    }
    i += 1
  }
  return -1
}

function collectReplacements(
  text: string,
  outFile: string,
  absToRel: (modulePath: string, outFile: string) => string,
): Replacement[] {
  const replacements: Replacement[] = []
  const refs = ts.preProcessFile(text, true, true).importedFiles

  for (let i = 0; i < refs.length; i += 1) {
    const ref = refs[i]
    const matched = ref.fileName
    const replacement = absToRel(matched, outFile)
    if (replacement === matched) {
      continue
    }

    // ref.end is unreliable (computed from the unescaped specifier), so the
    // closing quote is re-derived from ref.pos, which always points at the
    // opening quote.
    const start = ref.pos + 1
    const end = findClosingQuote(text, ref.pos)
    if (end === -1 || text.substring(start, end) !== matched) {
      continue
    }

    replacements.push({ start: start, end: end, text: replacement })
  }

  return replacements
}

function applyReplacements(text: string, replacements: Replacement[]): string {
  replacements.sort(function (a, b) {
    return b.start - a.start
  })

  let result = text
  for (let i = 0; i < replacements.length; i += 1) {
    const item = replacements[i]
    result = result.substring(0, item.start) + item.text + result.substring(item.end)
  }
  return result
}

export function replacePaths(options: ReplacePathsOptions): ReplacePathsResult {
  const ctx = buildContext(options)
  const resolver = createAliasResolver(ctx)
  const quiet = Boolean(options.quiet)
  const check = Boolean(options.check)

  const files = walkOutputFiles(ctx.outPath, [])
  const prefixes = ctx.aliases.map(function (alias) {
    return alias.prefix
  })

  const changedFiles: string[] = []
  let changedFileCount = 0

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const text = readFileSync(file, 'utf8')

    if (!hasAnyPrefix(text, prefixes)) {
      continue
    }

    const prevCount = resolver.getReplaceCount()
    const newText = applyReplacements(text, collectReplacements(text, file, resolver.absToRel))

    if (text !== newText) {
      changedFileCount += 1
      changedFiles.push(file)
      ctx.verboseLog(`${file}: replaced ${resolver.getReplaceCount() - prevCount} paths`)

      if (!check) {
        writeFileSync(file, newText, 'utf8')
      }
    }
  }

  const replaceCount = resolver.getReplaceCount()

  if (!quiet) {
    console.log(`Replaced ${replaceCount} paths in ${changedFileCount} files`)
  }

  return {
    replaceCount: replaceCount,
    changedFileCount: changedFileCount,
    changedFiles: changedFiles,
    checkFailed: check && changedFileCount > 0,
  }
}
