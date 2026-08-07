import * as program from 'commander'
import { readFileSync } from 'fs'
import { join } from 'path'
import { replacePaths } from './replace-paths'

function readPackageVersion(): string {
  const packageJsonPath = join(__dirname, '..', '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }
  return packageJson.version
}

export function runCli(argv: string[]): void {
  program
    .version(readPackageVersion())
    .option('-p, --project <file>', 'path to tsconfig.json')
    .option('-s, --src <path>', 'source root path')
    .option('-o, --out <path>', 'output root path')
    .option('-v, --verbose', 'output logs')
    .option('-q, --quiet', 'only print the summary line')
    .option('-c, --check', 'verify paths without writing files')

  program.on('--help', function () {
    console.log(`
  $ tsconfig-replace-paths -p tsconfig.json
`)
  })

  program.parse(argv)

  const opts = program as {
    project?: string
    src?: string
    out?: string
    verbose?: boolean
    quiet?: boolean
    check?: boolean
  }

  const result = replacePaths({
    project: opts.project,
    src: opts.src,
    out: opts.out,
    verbose: opts.verbose,
    quiet: opts.quiet,
    check: opts.check,
  })

  if (result.checkFailed) {
    process.exit(1)
  }
}
