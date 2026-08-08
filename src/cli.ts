import { readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { replacePaths } from './replace-paths.js'

const HELP_TEXT = `
Usage: tsconfig-replace-paths [options]

Options:
  -p, --project <file>  path to tsconfig.json (default: tsconfig.json)
  -s, --src <path>      source root path (overrides tsconfig rootDir)
  -o, --out <path>      output root path (overrides tsconfig outDir)
  -v, --verbose         output logs
  -q, --quiet           only print the summary line
  -c, --check           verify paths without writing files
  -h, --help            show this help
  -V, --version         show version

  $ tsconfig-replace-paths -p tsconfig.json
`

function readPackageVersion(): string {
  const packageJsonPath = join(__dirname, '..', '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }
  return packageJson.version
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function runCli(argv: string[]): void {
  let values: ReturnType<typeof parseCliArgs>

  try {
    values = parseCliArgs(argv)
  } catch (err) {
    console.error(errorMessage(err))
    console.error(HELP_TEXT)
    process.exit(1)
  }

  if (values.help) {
    console.log(HELP_TEXT)
    return
  }

  if (values.version) {
    console.log(readPackageVersion())
    return
  }

  try {
    const result = replacePaths({
      project: values.project,
      src: values.src,
      out: values.out,
      verbose: values.verbose,
      quiet: values.quiet,
      check: values.check,
    })

    if (result.checkFailed) {
      process.exit(1)
    }
  } catch (err) {
    console.error(errorMessage(err))
    process.exit(1)
  }
}

function parseCliArgs(argv: string[]) {
  return parseArgs({
    args: argv.slice(2),
    options: {
      project: { type: 'string', short: 'p' },
      src: { type: 'string', short: 's' },
      out: { type: 'string', short: 'o' },
      verbose: { type: 'boolean', short: 'v' },
      quiet: { type: 'boolean', short: 'q' },
      check: { type: 'boolean', short: 'c' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'V' },
    },
  }).values
}
