import * as ts from 'typescript'
import { readFileSync, writeFileSync } from 'fs'
import { sync } from 'globby'
import { dirname, resolve } from 'path'
import { loadConfig } from './config'
import { buildAliases, createAliasResolver } from './resolve'
import { ReplacePathsOptions, ReplacePathsResult, ResolvedContext } from './types'

function createVerboseLog(verbose: boolean, quiet: boolean): (...args: unknown[]) => void {
  return function (...args: unknown[]): void {
    if (verbose && !quiet) {
      console.log(...args)
    }
  }
}

function buildContext(options: ReplacePathsOptions): ResolvedContext {
  const cwd = options.cwd || process.cwd()
  const project = options.project || 'tsconfig.json'
  const configFile = resolve(cwd, project)
  const verboseLog = createVerboseLog(Boolean(options.verbose), Boolean(options.quiet))

  verboseLog(`Using tsconfig: ${configFile}`)

  const returnedTsConfig = loadConfig(configFile)
  const {
    baseUrl,
    paths,
    outDir: tsConfigOutDir = '',
    rootDir: tsConfigRootDir = cwd,
  } = returnedTsConfig

  if (!options.src && tsConfigRootDir === '') {
    console.error('Whoops! Please set compilerOptions.rootDir in your tsconfig or supply a flag')
    throw new Error('--- exiting tsconfig-replace-paths due to parameters missing ---')
  }

  if (!options.out && tsConfigOutDir === '') {
    console.error('Whoops! Please set compilerOptions.outDir in your tsconfig or supply a flag')
    throw new Error('--- exiting tsconfig-replace-paths due to parameters missing ---')
  }

  let usingSrcDir: string
  if (options.src) {
    verboseLog('Using flag --src')
    usingSrcDir = resolve(cwd, options.src)
  } else {
    verboseLog('Using compilerOptions.rootDir from your tsconfig')
    usingSrcDir = resolve(cwd, tsConfigRootDir)
  }

  if (!usingSrcDir) {
    console.error(
      `Whoops! rootDir must be specified in your project => --project ${project}, or flagged with directory => --src './path'`,
    )
    throw new Error('--- exiting tsconfig-replace-paths due to parameters missing ---')
  }

  verboseLog(`Using src: ${usingSrcDir}`)

  let usingOutDir: string
  if (options.out) {
    verboseLog('Using flag --out')
    usingOutDir = resolve(cwd, options.out)
  } else {
    verboseLog('Using compilerOptions.outDir from your tsconfig')
    usingOutDir = resolve(cwd, tsConfigOutDir)
  }

  if (!usingOutDir) {
    console.error(
      `Whoops! outDir must be specified in your project => --project ${project}, or flagged with directory => --out './path'`,
    )
    throw new Error('--- exiting tsconfig-replace-paths due to parameters missing ---')
  }

  verboseLog(`Using out: ${usingOutDir}`)

  if (!baseUrl) {
    throw new Error('compilerOptions.baseUrl is not set')
  }
  if (!paths) {
    throw new Error('compilerOptions.paths is not set')
  }

  verboseLog(`baseUrl: ${baseUrl}`)
  verboseLog(`rootDir: ${usingSrcDir}`)
  verboseLog(`outDir: ${usingOutDir}`)
  verboseLog(`paths: ${JSON.stringify(paths, null, 2)}`)

  const configDir = dirname(configFile)
  const basePath = resolve(configDir, baseUrl)
  const outPath = usingOutDir || resolve(basePath, usingOutDir)

  verboseLog(`basePath: ${basePath}`)
  verboseLog(`outPath: ${outPath}`)

  const aliases = buildAliases(paths, basePath)
  verboseLog(`aliases: ${JSON.stringify(aliases, null, 2)}`)

  return {
    configFile: configFile,
    basePath: basePath,
    usingSrcDir: usingSrcDir,
    outPath: outPath,
    aliases: aliases,
    verboseLog: verboseLog,
  }
}

function getScriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
    return ts.ScriptKind.TSX
  }
  if (fileName.endsWith('.ts')) {
    return ts.ScriptKind.TS
  }
  return ts.ScriptKind.JS
}

function collectReplacements(
  sourceFile: ts.SourceFile,
  outFile: string,
  absToRel: (modulePath: string, outFile: string) => string,
): Array<{ start: number; end: number; text: string }> {
  const replacements: Array<{ start: number; end: number; text: string }> = []

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier
      if (spec && ts.isStringLiteral(spec)) {
        const matched = spec.text
        const replacement = absToRel(matched, outFile)
        if (replacement !== matched) {
          replacements.push({
            start: spec.getStart(sourceFile) + 1,
            end: spec.getEnd() - 1,
            text: replacement,
          })
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.Identifier &&
      (node.expression as ts.Identifier).text === 'require' &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const arg = node.arguments[0]
      const matched = arg.text
      const replacement = absToRel(matched, outFile)
      if (replacement !== matched) {
        replacements.push({
          start: arg.getStart(sourceFile) + 1,
          end: arg.getEnd() - 1,
          text: replacement,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return replacements
}

function applyReplacements(
  text: string,
  replacements: Array<{ start: number; end: number; text: string }>,
): string {
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

function replaceAliasInText(
  text: string,
  outFile: string,
  absToRel: (modulePath: string, outFile: string) => string,
): string {
  const sourceFile = ts.createSourceFile(outFile, text, ts.ScriptTarget.Latest, true, getScriptKind(outFile))
  const replacements = collectReplacements(sourceFile, outFile, absToRel)
  return applyReplacements(text, replacements)
}

export function replacePaths(options: ReplacePathsOptions): ReplacePathsResult {
  const ctx = buildContext(options)
  const resolver = createAliasResolver(ctx)
  const quiet = Boolean(options.quiet)
  const check = Boolean(options.check)

  const files = sync(`${ctx.outPath.replaceAll('\\', '/')}/**/*.{js,jsx,ts,tsx}`, {
    dot: true,
    noDir: true,
  } as { dot: boolean; noDir: boolean }).map(function (x) {
    return resolve(x)
  })

  const changedFiles: string[] = []
  let changedFileCount = 0

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const text = readFileSync(file, 'utf8')
    const prevCount = resolver.getReplaceCount()
    const newText = replaceAliasInText(text, file, resolver.absToRel)

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
