# tsconfig-replace-paths

Replace absolute paths to relative paths for package compilation.

Requires Node.js 18 or later. The only runtime dependency is `typescript`.

## Getting Started

Install `tsconfig-replace-paths` as a dev dependency:

```sh
pnpm add -D tsconfig-replace-paths
```

or

```sh
npm install --save-dev tsconfig-replace-paths
```

## Add it to your build scripts

```json
"scripts": {
  "build": "tsc && tsconfig-replace-paths"
}
```

All flags are optional when run from the directory containing `tsconfig.json`.

## Options

| flag | description | default |
| ---- | ----------- | ------- |
| `-p, --project` | project configuration file (tsconfig.json) | `tsconfig.json` |
| `-s, --src` | source code root directory (overrides tsconfig) | from tsconfig |
| `-o, --out` | output directory of transpiled code (overrides tsconfig) | from tsconfig |
| `-v, --verbose` | log config, aliases, and each replacement | `false` |
| `-q, --quiet` | suppress the summary line | `false` |
| `-c, --check` | verify replacements without writing files; exits `1` if changes are needed | `false` |
| `-h, --help` | print usage | |
| `-V, --version` | print version | |

Static imports, `export ... from`, `require(...)`, and dynamic `import(...)` specifiers are all rewritten. Output files with `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, and `.cts` extensions are processed.

## Programmatic API

```typescript
import { replacePaths } from 'tsconfig-replace-paths/api'

const result = replacePaths({
  project: 'tsconfig.json',
  verbose: false,
  check: false,
})

console.log(result.replaceCount, result.changedFileCount)
```

## Common setups

### Types-only build (with Babel)

See `examples/tsconfig.types.cjs.json` and `examples/tsconfig.types.esm.json`.

```json
"scripts": {
  "build:types": "tsc --project tsconfig.types.cjs.json && tsconfig-replace-paths --project tsconfig.types.cjs.json"
}
```

### Dual CJS + ESM build

Emit both formats, then rewrite aliases in each output tree:

```json
"scripts": {
  "build:cjs": "tsc -p tsconfig.cjs.json && tsconfig-replace-paths -p tsconfig.cjs.json",
  "build:esm": "tsc -p tsconfig.esm.json && tsconfig-replace-paths -p tsconfig.esm.json",
  "build": "pnpm run build:cjs && pnpm run build:esm"
}
```

Point each tsconfig at its own `outDir` (for example `dist/commonjs` and `dist/esm`).

### Custom project file (`tsconfig.build.json`)

When the compile config is not `tsconfig.json`:

```json
"scripts": {
  "build": "tsc -p tsconfig.build.json && tsconfig-replace-paths -p tsconfig.build.json"
}
```

If you forget `-p`, the CLI error lists matching `tsconfig*.json` files in that directory.

### No `baseUrl`

`paths` without `baseUrl` resolve relative to the tsconfig file (TypeScript >= 4.1):

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "paths": {
      "@utils/*": ["./src/utils/*"]
    }
  }
}
```

### Node ESM with `.js` extensions in paths

If your tsconfig maps aliases to `.js` paths for Node16/NodeNext ESM:

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@service": ["service/index.service.js"]
    }
  }
}
```

`tsconfig-replace-paths` resolves the matching `.ts` source file and rewrites imports using the `.js` extension in the output.

### `.mjs` / NodeNext-style emit

Output files with `.mjs`, `.cjs`, `.mts`, and `.cts` extensions are processed the same way as `.js`. Use the tsconfig that actually emitted those files:

```sh
tsc -p tsconfig.esm.json && tsconfig-replace-paths -p tsconfig.esm.json
```

### Override `--src` / `--out`

When `rootDir` / `outDir` in the tsconfig do not match the tree you need to rewrite:

```sh
tsconfig-replace-paths -p tsconfig.json --src ./packages/app/src --out ./packages/app/dist
```

`--src` overrides `compilerOptions.rootDir`. `--out` overrides `compilerOptions.outDir`.

### Monorepos (NX and similar)

When `rootDir` points at an app but aliases reference shared libs outside that directory, paths are resolved relative to the compiled output file — not back to `.ts` sources.

### Extending shared configs from npm

Configs like `"extends": "@tsconfig/node16/tsconfig.json"` are resolved from `node_modules` automatically. Local `extends` and TypeScript 5.0 `extends` arrays work the same way.

## CI check mode

Verify paths are already rewritten without modifying files:

```sh
tsconfig-replace-paths --project tsconfig.json --check
```

Exits with code `1` when replacements are still needed.

## Migrating to 1.0

- Node.js 18 or later is required.
- Dynamic `import('@alias/...')` specifiers are now rewritten too. If your ESM output intentionally kept aliased dynamic imports, pin to `0.0.x`.
- `compilerOptions.baseUrl` is no longer required; `paths` without `baseUrl` resolve relative to the tsconfig file (TypeScript >= 4.1 semantics).
- `extends` arrays (TypeScript 5.0) are now supported.
- Aliases resolving to `.d.ts` files now rewrite to the declaration file instead of a broken `.js` path.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `tsconfig not found at ...` | The error names the exact flag to run, e.g. `--project tsconfig.build.json` |
| `compilerOptions.paths is not set` | Add `paths` mappings |
| ENOENT for `@tsconfig/*` extends | Upgrade to >= 0.0.15 |
| Imports still point at `.ts` files | Upgrade to >= 0.0.18; ensure compiled `.js` output exists |
| ESM alias not replaced | Ensure path mapping includes `.js` if using Node ESM resolution |

## Development

```sh
pnpm install
pnpm test
pnpm run release
```

## Inspired by

[tsconfig-paths](https://github.com/dividab/tsconfig-paths) and [tscpaths](https://github.com/joonhocho/tscpaths)
