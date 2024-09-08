/**
 * Add a trailing semicolon where needed
 *
 * Also accounts for end-of-line-comments
 */
export declare function semiColonLine(line: string): string;
/** Indent the lines recursively */
export declare function indentLines(lines: string[], indentLevel?: number): string[];
/**
 * Figure out the indent level of the line
 */
export declare function getIndentLevel(line: string): number;
