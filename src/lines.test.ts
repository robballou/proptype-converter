import { expect, test } from 'vitest';
import { getIndentLevel, indentLines } from './lines';

test('indentLines with nested structure', () => {
	const testString = 'folders?: {\n\tid?: string,name?: string\n}[]';
	const lines = indentLines([testString]);
	const firstLine = lines.shift();
	const firstLineExpanded = firstLine?.split('\n');
	expect(getIndentLevel(firstLineExpanded![0])).toBe(0);
	expect(
		getIndentLevel(firstLineExpanded![firstLineExpanded!.length - 1]),
	).toBe(1);
});

test('indentLines with nested structure while already indented', () => {
	const testString = '\tfolders?: {\n\tid?: string,name?: string\n}[]';
	const lines = indentLines([testString]);
	const firstLine = lines.shift();
	const firstLineExpanded = firstLine?.split('\n');
	expect(getIndentLevel(firstLineExpanded![0])).toBe(1);
	expect(
		getIndentLevel(firstLineExpanded![firstLineExpanded!.length - 1]),
	).toBe(2);
});

test('indentLines will not add semiColons for comment lines', () => {
	const testString =
		'/**\n * A bigger JSDoc comment\n *\n * See more details...\n */';
	const lines = indentLines([testString]);
	console.log(lines);
});
