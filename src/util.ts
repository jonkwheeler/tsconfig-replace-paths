import { dirname, resolve } from 'path';

/**
 * @internal
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

/**
 * @internal
 */
export interface ITSConfig {
  baseUrl?: string;
  outDir?: string;
  rootDir?: string;
  compilerOptions?: object;
  paths?: { [key: string]: string[] };
}

/**
 * @internal
 */
export const mapPaths = (
  paths: { [key: string]: string[] },
  mapper: (x: string) => string
): { [key: string]: string[] } =>
  Object.fromEntries(
    Object.entries(paths).map(([key, value]) => [key, value.map(mapper)])
  );

/**
 * @internal
 */
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
  if (paths) {
    config.paths = paths;
  }

  if (ext) {
    const parentConfig = loadConfig(resolve(dirname(file), ext));
    return {
      ...parentConfig,
      ...config,
    };
  }

  return config;
};
