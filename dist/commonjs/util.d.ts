export interface IRawTSConfig {
    extends?: string;
    compilerOptions?: {
        baseUrl?: string;
        outDir?: string;
        rootDir?: string;
        paths?: {
            [key: string]: string[];
        };
    };
}
export interface ITSConfig {
    baseUrl?: string;
    outDir?: string;
    rootDir?: string;
    compilerOptions?: object;
    paths?: {
        [key: string]: string[];
    };
}
export declare const mapPaths: (paths: {
    [key: string]: string[];
}, mapper: (x: string) => string) => {
    [key: string]: string[];
};
export declare const loadConfig: (file: string) => ITSConfig;
