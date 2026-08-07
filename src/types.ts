export interface ReplacePathsOptions {
  project?: string
  src?: string
  out?: string
  verbose?: boolean
  quiet?: boolean
  check?: boolean
  cwd?: string
}

export interface ReplacePathsResult {
  replaceCount: number
  changedFileCount: number
  changedFiles: string[]
  checkFailed: boolean
}

export interface ResolvedContext {
  configFile: string
  basePath: string
  usingSrcDir: string
  outPath: string
  aliases: AliasEntry[]
  verboseLog: (...args: unknown[]) => void
}

export interface AliasEntry {
  prefix: string
  aliasPaths: string[]
}
