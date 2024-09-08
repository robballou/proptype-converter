import { processSourceFile } from './main';
/**
 * Parse a TS/JS file for PropTypes
 */
export declare function processFile(fileName: string, options?: Parameters<typeof processSourceFile>[1]): Promise<Awaited<ReturnType<typeof processSourceFile>> | null>;
