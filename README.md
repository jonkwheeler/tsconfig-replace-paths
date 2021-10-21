# tsconfig-replace-paths

Replace absolute paths to relative paths for package compilation.

I'll add to this over time. Submit PR's if you like. Tag me on them.

## Getting Started

First, install `tsconfig-replace-paths` as devDependency using yarn or npm.

```sh
yarn add -D tsconfig-replace-paths
```

or

```sh
npm install --save-dev tsconfig-replace-paths
```

## Add it to your build scripts in package.json

```json
"scripts": {
  "build": "tsc --project tsconfig.json && tsconfig-replace-paths --project tsconfig.json",
}
```

---

## What if you want to build only the types?

You can also setup a seperate tsconfig file just for types if you are also compiling with Babel. Assuming you're compiling CommonJs, make a `tsconfig.types.cjs.json`. See examples of both CommonJs and ESM in the `examples` folder within repo.

```json
{
  "extends": "./tsconfig",
  "compilerOptions": {
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "dist/commonjs",
    "declaration": true,
    "declarationMap": false,
    "isolatedModules": false,
    "noEmit": false,
    "allowJs": false,
    "emitDeclarationOnly": true
  },
  "exclude": ["**/*.test.ts"]
}
```

And then target that. Your final build script might look like this. You first compile to CommonJs using Babel, and then build the types using the Typescript Compiler, `tsc`, followed by fixing the paths them with `tsconfig-replace-paths`. If only `tsc` did this for you.

```json
"config": {
  "dirBuild": "./dist",
  "dirSrc": "./src",
},
"scripts": {
  "build:commonjs": "yarn nuke:build && cross-env BABEL_ENV=commonjs babel $npm_package_config_dirSrc --out-dir $npm_package_config_dirBuild --extensions \".ts,.tsx,.js,.jsx\" --source-maps inline",
  "build:types:commonjs": "tsc --project tsconfig.types.cjs.json && tsconfig-replace-paths --project tsconfig.types.cjs.json",
  "build:types": "yarn build:types:commonjs",
  "build": "yarn build:commonjs && yarn build:types",
  "nuke:build": "rm -rf $npm_package_config_dirBuild",
}
```

## Options

| flag         | description                                                                          | default   |
| ------------ | ------------------------------------------------------------------------------------ | --------- |
| -p --project | project configuration file (tsconfig.json)                                           | undefined |
| -s --src     | source code root directory (overrides the tsconfig provided)                         | undefined |
| -o --out     | output directory of transpiled code (tsc --outDir) (overrides the tsconfig provided) | undefined |
| -v --verbose | console.log all the events                                                           | false     |

## Inspired by

[tsconfig-paths](https://github.com/dividab/tsconfig-paths) and [tscpaths](https://github.com/joonhocho/tscpaths)
