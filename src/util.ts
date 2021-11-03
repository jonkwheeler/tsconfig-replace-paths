const path = require('path')
const fs = require('fs')
const JSON5 = require('json5')

/*
"baseUrl": ".",
"outDir": "lib",
"paths": {
  "src/*": ["src/*"]
},
*/

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

export const mapPaths = (
  paths: { [key: string]: string[] },
  mapper: (x: string) => string,
): { [key: string]: string[] } => {
  const dest = {} as { [key: string]: string[] }
  Object.keys(paths).forEach(key => {
    dest[key] = paths[key].map(mapper)
  })
  return dest
}

export const loadConfig = (file: string): ITSConfig => {
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
    const parentConfigPath = path.resolve(childConfigDirPath, extendsPath)
    const parentConfigDirPath = path.dirname(parentConfigPath)
    const currentExtension = path.extname(parentConfigPath)

    let parentExtendedConfigFile = path.format({
      name: parentConfigPath,
      ext: currentExtension === '' ? '.json' : '',
    })

    /* Ensure without a doubt there's no double extension */
    if (/\.json\.json$/.test(parentExtendedConfigFile)) {
      parentExtendedConfigFile = parentExtendedConfigFile.replace(/\.json\.json$/, '.json')
    }

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
