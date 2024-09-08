import { readFileSync } from 'fs';
import { processSourceFile } from './main';
import * as ts from 'typescript';
import createDebugger from 'debug';

const baseDebugger = createDebugger('proptype-converter:file');

/**
 * Parse a TS/JS file for PropTypes
 */
export async function processFile(
	fileName: string,
	options: Parameters<typeof processSourceFile>[1] = {},
): Promise<Awaited<ReturnType<typeof processSourceFile>> | null> {
	const d = baseDebugger.extend('processFile');

	d('reading file');
	const sourceFile = ts.createSourceFile(
		fileName,
		readFileSync(fileName).toString(),
		ts.ScriptTarget.ES2015,
		true,
		ts.ScriptKind.JSX,
	);
	d('file read', { wasSuccessful: Boolean(sourceFile) });

	if (!sourceFile) {
		console.error('No sourceFile');
		return null;
	}

	return await processSourceFile(sourceFile, options);
}
