import * as fs from 'fs'
import { replacePaths } from '../src/replace-paths'

const root = __dirname + '/synthetic'

let existsSyncCalls = 0
const realExistsSync = fs.existsSync
;(fs as { existsSync: typeof fs.existsSync }).existsSync = function (p: fs.PathLike): boolean {
  existsSyncCalls += 1
  return realExistsSync(p)
}

const start = process.hrtime.bigint()
const result = replacePaths({ project: 'tsconfig.json', cwd: root, quiet: true })
const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6

console.log(`replacePaths: ${elapsedMs.toFixed(0)}ms`)
console.log(`replaced ${result.replaceCount} paths in ${result.changedFileCount} files`)
console.log(`existsSync calls: ${existsSyncCalls}`)
