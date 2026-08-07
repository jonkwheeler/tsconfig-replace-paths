const path = require('path')
const fs = require('fs')
const JSON5 = require('json5')

export interface IRawTSConfig {
  extends?: string
  compilerOptions?: {
    baseUrl?: string
    outDir?: string
    rootDir?: string
    paths?: { [key: string]: string[] }
  }
}

export interface ITSConfig {
  baseUrl?: string
  outDir?: string
  rootDir?: string
  compilerOptions?: object
  paths?: { [key: string]: string[] }
}

export function mapPaths(
  paths: { [key: string]: string[] },
  mapper: (x: string) => string,
): { [key: string]: string[] } {
  const dest = {} as { [key: string]: string[] }
  Object.keys(paths).forEach(function (key) {
    dest[key] = paths[key].map(mapper)
  })
  return dest
}

function resolveConfigFile(configDir: string, extendsPath: string): string {
  const relativeCandidate = path.resolve(configDir, extendsPath)
  const currentExtension = path.extname(relativeCandidate)

  let localConfigFile = path.format({
    name: relativeCandidate,
    ext: currentExtension === '' ? '.json' : '',
  })

  if (/\.json\.json$/.test(localConfigFile)) {
    localConfigFile = localConfigFile.replace(/\.json\.json$/, '.json')
  }

  if (fs.existsSync(localConfigFile)) {
    return localConfigFile
  }

  try {
    return require.resolve(extendsPath, { paths: [configDir] })
  } catch {
    return localConfigFile
  }
}

export function loadConfig(file: string): ITSConfig {
  const fileToParse = fs.readFileSync(file)
  const parsedJsonFile = JSON5.parse(fileToParse)

  const {
    extends: extendsPath,
    compilerOptions: { baseUrl, outDir, rootDir, paths } = {
      baseUrl: undefined,
      outDir: undefined,
      rootDir: undefined,
      paths: undefined,
    },
  } = parsedJsonFile as IRawTSConfig

  const config: ITSConfig = {}
  if (baseUrl) {
    config.baseUrl = baseUrl
  }
  if (outDir) {
    config.outDir = outDir
  }
  if (rootDir) {
    config.rootDir = rootDir
  }
  if (paths) {
    config.paths = paths
  }
  if (extendsPath) {
    const childConfigDirPath = path.dirname(file)
    const parentExtendedConfigFile = resolveConfigFile(childConfigDirPath, extendsPath)
    const parentConfigDirPath = path.dirname(parentExtendedConfigFile)

    const parentConfig = loadConfig(parentExtendedConfigFile)

    if (parentConfig.baseUrl) {
      parentConfig.baseUrl = path.resolve(parentConfigDirPath, parentConfig.baseUrl)
    }

    return {
      ...parentConfig,
      ...config,
    }
  }

  return config
}
