import { existsSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { AliasEntry, ResolvedContext } from './types.js'

const PROBE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.mjs', '.cjs', '.mts', '.cts', '.json']
const STRIP_EXTS = ['.d.ts', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.json']
const OUTPUT_EXTS = ['.js', '.jsx', '.d.ts', '.mjs', '.cjs']

type ExistsFn = (path: string) => boolean

export function toRelative(from: string, target: string): string {
  const rel = relative(from, target)
  return (rel.startsWith('.') ? rel : `./${rel}`).replace(/\\/g, '/')
}

function createExistsCache(): ExistsFn {
  const cache = new Map<string, boolean>()
  return function (path: string): boolean {
    const cached = cache.get(path)
    if (cached !== undefined) {
      return cached
    }
    const result = existsSync(path)
    cache.set(path, result)
    return result
  }
}

function stripExtension(filePath: string): { base: string; ext: string | undefined } {
  const ext = STRIP_EXTS.find(function (candidate) {
    return filePath.endsWith(candidate)
  })
  if (ext) {
    return {
      base: filePath.substring(0, filePath.length - ext.length),
      ext: ext,
    }
  }
  return { base: filePath, ext: undefined }
}

function hasKnownExtension(filePath: string): boolean {
  return stripExtension(filePath).ext !== undefined
}

function stripOutputExtension(filePath: string): string {
  const ext = OUTPUT_EXTS.find(function (candidate) {
    return filePath.endsWith(candidate)
  })
  return ext ? filePath.substring(0, filePath.length - ext.length) : filePath
}

function findExistingModule(basePath: string, exists: ExistsFn): { path: string; ext: string } | null {
  const stripped = stripExtension(basePath)

  if (stripped.ext && exists(basePath)) {
    return { path: basePath, ext: stripped.ext }
  }

  if (stripped.ext === '.js' && exists(`${stripped.base}.ts`)) {
    return { path: `${stripped.base}.ts`, ext: '.ts' }
  }

  if (stripped.ext === '.js' && exists(`${stripped.base}.tsx`)) {
    return { path: `${stripped.base}.tsx`, ext: '.tsx' }
  }

  for (let i = 0; i < PROBE_EXTS.length; i += 1) {
    const candidate = `${stripped.base}${PROBE_EXTS[i]}`
    if (exists(candidate)) {
      return { path: candidate, ext: PROBE_EXTS[i] }
    }
  }

  return null
}

function mapSourceExtToOutput(sourceFile: string): string {
  if (sourceFile.endsWith('.d.ts')) {
    return sourceFile
  }
  if (sourceFile.endsWith('.tsx')) {
    return `${sourceFile.substring(0, sourceFile.length - 4)}.jsx`
  }
  if (sourceFile.endsWith('.ts')) {
    return `${sourceFile.substring(0, sourceFile.length - 3)}.js`
  }
  if (sourceFile.endsWith('.mts')) {
    return `${sourceFile.substring(0, sourceFile.length - 4)}.mjs`
  }
  if (sourceFile.endsWith('.cts')) {
    return `${sourceFile.substring(0, sourceFile.length - 4)}.cjs`
  }
  return sourceFile
}

function findOutputModule(
  sourceModule: { path: string; ext: string },
  usingSrcDir: string,
  outPath: string,
  exists: ExistsFn,
): string | null {
  const mappedOutput = mapSourceExtToOutput(join(outPath, relative(usingSrcDir, sourceModule.path)))

  if (exists(mappedOutput)) {
    return mappedOutput
  }

  const stripped = stripExtension(mappedOutput)
  for (let i = 0; i < PROBE_EXTS.length; i += 1) {
    const candidate = `${stripped.base}${PROBE_EXTS[i]}`
    if (exists(candidate)) {
      return candidate
    }
  }

  if (sourceModule.ext === '.ts' || sourceModule.ext === '.tsx') {
    return mappedOutput
  }

  return sourceModule.path
}

export function createAliasResolver(ctx: ResolvedContext): {
  absToRel: (modulePath: string, outFile: string) => string
  getReplaceCount: () => number
} {
  let replaceCount = 0
  const exists = createExistsCache()

  function absToRel(modulePath: string, outFile: string): string {
    const alen = ctx.aliases.length

    for (let j = 0; j < alen; j += 1) {
      const alias = ctx.aliases[j]
      const prefix = alias.prefix
      const aliasPaths = alias.aliasPaths

      if (!modulePath.startsWith(prefix)) {
        continue
      }

      const modulePathRel = modulePath.substring(prefix.length)
      const outFileDir = dirname(outFile)
      const srcMirror = resolve(ctx.usingSrcDir, relative(ctx.outPath, outFile))

      ctx.verboseLog(`${relative(ctx.basePath, outFile)} (source: ${relative(ctx.basePath, srcMirror)}):`)
      ctx.verboseLog(`\timport '${modulePath}'`)

      for (let i = 0; i < aliasPaths.length; i += 1) {
        const apath = aliasPaths[i]
        const lookupBase = resolve(apath, modulePathRel)
        const sourceModule = findExistingModule(lookupBase, exists)

        if (!sourceModule) {
          continue
        }

        const outputModule = findOutputModule(sourceModule, ctx.usingSrcDir, ctx.outPath, exists)

        let targetPath = mapSourceExtToOutput(outputModule || sourceModule.path)

        if (!hasKnownExtension(modulePath) && !hasKnownExtension(apath)) {
          targetPath = stripOutputExtension(targetPath)
        }

        const rel = toRelative(outFileDir, targetPath)
        replaceCount += 1

        ctx.verboseLog(
          `\treplacing '${modulePath}' -> '${rel}' referencing ${relative(ctx.basePath, sourceModule.path)}`,
        )
        return rel
      }

      ctx.verboseLog(`\tcould not replace ${modulePath}`)
    }

    return modulePath
  }

  return {
    absToRel: absToRel,
    getReplaceCount: function () {
      return replaceCount
    },
  }
}

export function buildAliases(paths: { [key: string]: string[] }, basePath: string): AliasEntry[] {
  return Object.keys(paths)
    .map(function (alias) {
      return {
        prefix: alias.replace(/\*$/, ''),
        aliasPaths: paths[alias].map(function (p) {
          return resolve(basePath, p.replace(/\*$/, ''))
        }),
      }
    })
    .filter(function (entry) {
      return Boolean(entry.prefix)
    })
    .sort(function (a, b) {
      return b.prefix.length - a.prefix.length
    })
}
