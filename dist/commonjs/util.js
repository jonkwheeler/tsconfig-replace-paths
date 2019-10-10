"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
exports.mapPaths = (paths, mapper) => {
    const dest = {};
    Object.keys(paths).forEach((key) => {
        dest[key] = paths[key].map(mapper);
    });
    return dest;
};
exports.loadConfig = (file) => {
    const { extends: ext, compilerOptions: { baseUrl, outDir, rootDir, paths } = {
        baseUrl: undefined,
        outDir: undefined,
        rootDir: undefined,
        paths: undefined,
    }, } = require(file);
    const config = {};
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
        const parentConfig = exports.loadConfig(path_1.resolve(path_1.dirname(file), ext));
        return Object.assign(Object.assign({}, parentConfig), config);
    }
    return config;
};
//# sourceMappingURL=util.js.map