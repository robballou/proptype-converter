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
