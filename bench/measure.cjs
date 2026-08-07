const fs = require('fs')
const path = require('path')

let existsSyncCalls = 0
const realExistsSync = fs.existsSync
fs.existsSync = function (p) {
  existsSyncCalls += 1
  return realExistsSync(p)
}

const { replacePaths } = require(path.join(__dirname, '..', 'dist', 'commonjs', 'api.js'))

const start = process.hrtime.bigint()
const result = replacePaths({ project: 'tsconfig.json', cwd: path.join(__dirname, 'synthetic'), quiet: true })
const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6

console.log('replacePaths: ' + elapsedMs.toFixed(0) + 'ms')
console.log('replaced ' + result.replaceCount + ' paths in ' + result.changedFileCount + ' files')
console.log('existsSync calls: ' + existsSyncCalls)
