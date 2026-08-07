import * as assert from 'assert'
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { test } from 'node:test'
import { replacePaths } from '../src/replace-paths'

const repoRoot = path.resolve(__dirname, '..')
const cliPath = path.join(repoRoot, 'dist', 'commonjs', 'index.js')
const fixturesRoot = path.join(__dirname, 'fixtures')

function listFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push.apply(files, listFiles(entryPath))
    } else {
      files.push(entryPath)
    }
  }

  return files
}

function copyDirectory(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true })
  const entries = fs.readdirSync(source, { withFileTypes: true })

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath)
    } else {
      fs.copyFileSync(sourcePath, destinationPath)
    }
  }
}

function removeDirectory(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function runFixture(fixtureName: string, extraArgs: string[] = []): { stdout: string; status: number | null } {
  const fixtureDir = path.join(fixturesRoot, fixtureName)
  const beforeDir = path.join(fixtureDir, 'before', 'dist')
  const expectedDir = path.join(fixtureDir, 'expected', 'dist')
  const outputDir = path.join(fixtureDir, 'dist')

  removeDirectory(outputDir)
  copyDirectory(beforeDir, outputDir)

  const args = [cliPath, '--project', 'tsconfig.json'].concat(extraArgs)
  const result = spawnSync(process.execPath, args, {
    cwd: fixtureDir,
    encoding: 'utf8',
  })

  if (!extraArgs.includes('--check')) {
    assert.strictEqual(result.status, 0, `${fixtureName} CLI failed: ${result.stderr}${result.stdout}`)
    if (!extraArgs.includes('--quiet')) {
      assert.match(result.stdout, /Replaced \d+ paths in \d+ files/, `${fixtureName} missing summary line`)
    }

    const expectedFiles = listFiles(expectedDir).sort()
    assert.ok(expectedFiles.length > 0, `${fixtureName} has no expected files`)

    for (let i = 0; i < expectedFiles.length; i += 1) {
      const expectedFile = expectedFiles[i]
      const relativePath = path.relative(expectedDir, expectedFile)
      const actualFile = path.join(outputDir, relativePath)

      assert.ok(fs.existsSync(actualFile), `${fixtureName} missing output file: ${relativePath}`)

      const expectedContent = fs.readFileSync(expectedFile, 'utf8')
      const actualContent = fs.readFileSync(actualFile, 'utf8')
      assert.strictEqual(actualContent, expectedContent, `${fixtureName} mismatch in ${relativePath}`)
    }
  }

  removeDirectory(outputDir)

  return {
    stdout: result.stdout,
    status: result.status,
  }
}

const fixtureNames = fs
  .readdirSync(fixturesRoot, { withFileTypes: true })
  .filter(function (entry) {
    return entry.isDirectory()
  })
  .map(function (entry) {
    return entry.name
  })
  .sort()

for (let i = 0; i < fixtureNames.length; i += 1) {
  const fixtureName = fixtureNames[i]

  test(`fixture: ${fixtureName}`, function () {
    runFixture(fixtureName)
  })
}

test('check mode exits non-zero without writing files', function () {
  const fixtureDir = path.join(fixturesRoot, 'basic-alias')
  const beforeDir = path.join(fixtureDir, 'before', 'dist')
  const outputDir = path.join(fixtureDir, 'dist')
  const beforeFile = path.join(beforeDir, 'index.js')

  removeDirectory(outputDir)
  copyDirectory(beforeDir, outputDir)

  const result = spawnSync(process.execPath, [cliPath, '--project', 'tsconfig.json', '--check'], {
    cwd: fixtureDir,
    encoding: 'utf8',
  })

  assert.strictEqual(result.status, 1)
  assert.match(result.stdout, /Replaced \d+ paths in \d+ files/)
  assert.strictEqual(fs.readFileSync(path.join(outputDir, 'index.js'), 'utf8'), fs.readFileSync(beforeFile, 'utf8'))

  removeDirectory(outputDir)
})

test('quiet mode suppresses summary output', function () {
  const result = runFixture('basic-alias', ['--quiet'])
  assert.strictEqual(result.status, 0)
  assert.strictEqual(result.stdout.trim(), '')
})

test('missing tsconfig suggests available configs', function () {
  const fixtureDir = path.join(__dirname, 'missing-config')

  const result = spawnSync(process.execPath, [cliPath], {
    cwd: fixtureDir,
    encoding: 'utf8',
  })

  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /tsconfig not found/)
  assert.match(result.stderr, /--project tsconfig\.build\.json/)
})

test('programmatic api replaces paths', function () {
  const fixtureDir = path.join(fixturesRoot, 'basic-alias')
  const beforeDir = path.join(fixtureDir, 'before', 'dist')
  const outputDir = path.join(fixtureDir, 'dist')

  removeDirectory(outputDir)
  copyDirectory(beforeDir, outputDir)

  const apiResult = replacePaths({
    project: 'tsconfig.json',
    cwd: fixtureDir,
    quiet: true,
  })

  assert.ok(apiResult.replaceCount > 0)
  assert.ok(apiResult.changedFileCount > 0)

  removeDirectory(outputDir)
})
