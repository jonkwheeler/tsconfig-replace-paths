import { existsSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { AliasEntry, ResolvedContext } from './types'

const LOOKUP_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.json']

export function toRelative(from: string, target: string): string {
  const rel = relative(from, target)
  return (rel.startsWith('.') ? rel : `./${rel}`).replace(/\\/g, '/')
}

function stripExtension(filePath: string): { base: string; ext: string | undefined } {
  const ext = LOOKUP_EXTS.find(function (candidate) {
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

function findExistingModule(basePath: string): { path: string; ext: string } | null {
  const stripped = stripExtension(basePath)

  if (stripped.ext && existsSync(basePath)) {
    return { path: basePath, ext: stripped.ext }
  }

  if (stripped.ext === '.js' && existsSync(`${stripped.base}.ts`)) {
    return { path: `${stripped.base}.ts`, ext: '.ts' }
  }

  if (stripped.ext === '.js' && existsSync(`${stripped.base}.tsx`)) {
    return { path: `${stripped.base}.tsx`, ext: '.tsx' }
  }

  for (let i = 0; i < LOOKUP_EXTS.length; i += 1) {
    const candidate = `${stripped.base}${LOOKUP_EXTS[i]}`
    if (existsSync(candidate)) {
      return { path: candidate, ext: LOOKUP_EXTS[i] }
    }
  }

  return null
}

function sourcePathToOutputPath(
  sourceFile: string,
  usingSrcDir: string,
  outPath: string,
): string {
  const rel = relative(usingSrcDir, sourceFile)
  if (rel.startsWith('..')) {
    return join(outPath, rel)
  }
  return join(outPath, rel)
}

function mapSourceExtToOutput(sourceFile: string): string {
  if (sourceFile.endsWith('.tsx')) {
    return `${sourceFile.substring(0, sourceFile.length - 4)}.jsx`
  }
  if (sourceFile.endsWith('.ts')) {
    return `${sourceFile.substring(0, sourceFile.length - 3)}.js`
  }
  return sourceFile
}

function findOutputModule(
  sourceModule: { path: string; ext: string },
  usingSrcDir: string,
  outPath: string,
): string | null {
  const mappedOutput = mapSourceExtToOutput(
    sourcePathToOutputPath(sourceModule.path, usingSrcDir, outPath),
  )

  if (existsSync(mappedOutput)) {
    return mappedOutput
  }

  const stripped = stripExtension(mappedOutput)
  for (let i = 0; i < LOOKUP_EXTS.length; i += 1) {
    const candidate = `${stripped.base}${LOOKUP_EXTS[i]}`
    if (existsSync(candidate)) {
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
        const sourceModule = findExistingModule(lookupBase)

        if (!sourceModule) {
          continue
        }

        const outputModule = findOutputModule(sourceModule, ctx.usingSrcDir, ctx.outPath)
        const modulePathEndsWithJs = modulePath.endsWith('.js') || modulePath.endsWith('.jsx')
        const aliasUsesJs = apath.endsWith('.js') || apath.endsWith('.jsx')

        let targetPath = outputModule || sourceModule.path

        if (targetPath.endsWith('.ts') || targetPath.endsWith('.tsx')) {
          targetPath = mapSourceExtToOutput(targetPath)
        }

        if ((modulePathEndsWithJs || aliasUsesJs) && (targetPath.endsWith('.js') || targetPath.endsWith('.jsx'))) {
          // keep js extension in relative path for ESM
        } else if (!modulePathEndsWithJs && targetPath.endsWith('.js')) {
          targetPath = targetPath.substring(0, targetPath.length - 3)
        } else if (!modulePathEndsWithJs && targetPath.endsWith('.jsx')) {
          targetPath = targetPath.substring(0, targetPath.length - 4)
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

export function buildAliases(
  paths: { [key: string]: string[] },
  basePath: string,
): AliasEntry[] {
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
      return entry.prefix
    })
}
