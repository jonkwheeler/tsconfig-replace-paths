import * as path from 'path'
import * as ts from 'typescript'

export interface IRawTSConfig {
  extends?: string | string[]
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

function createParseHost(): ts.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    // Skip input-file globbing; only compilerOptions are needed here.
    readDirectory: function () {
      return []
    },
    fileExists: function (fileName: string) {
      return ts.sys.fileExists(fileName)
    },
    readFile: function (fileName: string) {
      return ts.sys.readFile(fileName)
    },
  }
}

export function loadConfig(file: string): ITSConfig {
  const readResult = ts.readConfigFile(file, ts.sys.readFile)
  if (readResult.error) {
    throw new Error(ts.flattenDiagnosticMessageText(readResult.error.messageText, '\n'))
  }

  const parsed = ts.parseJsonConfigFileContent(readResult.config, createParseHost(), path.dirname(file), undefined, file)
  const options = parsed.options

  const config: ITSConfig = {}
  if (options.baseUrl) {
    config.baseUrl = options.baseUrl
  }
  if (options.outDir) {
    config.outDir = options.outDir
  }
  if (options.rootDir) {
    config.rootDir = options.rootDir
  }
  if (options.paths) {
    config.paths = options.paths
  }
  return config
}
