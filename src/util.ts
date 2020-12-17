import { dirname, resolve, parse } from 'path';
import { readdirSync, lstatSync } from 'fs';

/*
"baseUrl": ".",
"outDir": "lib",
"paths": {
  "src/*": ["src/*"]
},
*/

export interface IRawTSConfig {
  extends?: string;
  compilerOptions?: {
    baseUrl?: string;
    outDir?: string;
    rootDir?: string;
    paths?: { [key: string]: string[] };
  };
}

export interface ITSConfig {
  baseUrl?: string;
  outDir?: string;
  rootDir?: string;
  compilerOptions?: object;
  paths?: { [key: string]: string[] };
}

export const mapPaths = (
  paths: { [key: string]: string[] },
  mapper: (x: string) => string
): { [key: string]: string[] } => {
  const dest = {} as { [key: string]: string[] };
  Object.keys(paths).forEach((key) => {
    dest[key] = paths[key].map(mapper);
  });
  return dest;
};

export const loadConfig = (file: string): ITSConfig => {
  const {
    extends: ext,
    compilerOptions: { baseUrl, outDir, rootDir, paths } = {
      baseUrl: undefined,
      outDir: undefined,
      rootDir: undefined,
      paths: undefined,
    },
  } = require(file) as IRawTSConfig;

  const configDir = dirname(file);

  const basePath = resolve(configDir, baseUrl!);

  const files = readdirSync(basePath);

  const aliases = files.reduce((r, f: any) => {
    const _file = parse(f);
    const name = _file.name;
    const stats = lstatSync(resolve(basePath, f));
    return {
      ...r,
      [`${name}${stats.isDirectory() ? '/*' : ''}`]: [`./${name}${stats.isDirectory() ? '/*' : ''}`],
    };
  }, {} as { [key: string]: string[] })

  const config: ITSConfig = {};
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }
  if (outDir) {
    config.outDir = outDir;
  }
  if (rootDir) {
    config.rootDir = rootDir;
  }
  config.paths = {
    ...paths || {},
    ...aliases,
  };

  if (ext) {
    const parentConfig = loadConfig(resolve(dirname(file), ext));
    return {
      ...parentConfig,
      ...config,
    };
  }

  return config;
};
