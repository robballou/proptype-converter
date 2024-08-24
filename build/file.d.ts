import { processSourceFile } from './main';
/**
 * Parse a TS/JS file for PropTypes
 */
export declare function processFile(fileName: string): Promise<Awaited<ReturnType<typeof processSourceFile>> | null>;
