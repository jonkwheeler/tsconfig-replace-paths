# tsconfig-replace-paths

Replace absolute paths to relative paths for package compilation.

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
  "build": "tsc --project tsconfig.json && tsconfig-replace-paths --project tsconfig.json"
}
```

## Options

| flag | description | default |
| ---- | ----------- | ------- |
| `-p, --project` | project configuration file (tsconfig.json) | `tsconfig.json` |
| `-s, --src` | source code root directory (overrides tsconfig) | from tsconfig |
| `-o, --out` | output directory of transpiled code (overrides tsconfig) | from tsconfig |
| `-v, --verbose` | log config, aliases, and each replacement | `false` |
| `-q, --quiet` | suppress the summary line | `false` |
| `-c, --check` | verify replacements without writing files; exits `1` if changes are needed | `false` |

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

### Monorepos (NX and similar)

When `rootDir` points at an app but aliases reference shared libs outside that directory, paths are resolved relative to the compiled output file — not back to `.ts` sources.

### Extending shared configs from npm

Configs like `"extends": "@tsconfig/node16/tsconfig.json"` are resolved from `node_modules` automatically.

## CI check mode

Verify paths are already rewritten without modifying files:

```sh
tsconfig-replace-paths --project tsconfig.json --check
```

Exits with code `1` when replacements are still needed.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `compilerOptions.baseUrl is not set` | Add `baseUrl` to tsconfig |
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
