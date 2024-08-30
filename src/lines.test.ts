import { expect, test } from 'vitest';
import { indentLines } from './lines';

test('indentLines with nested structure', () => {
	const testString = 'folders?: {\n\tid?: string,name?: string\n}[]';
	const lines = indentLines([testString]);
	const firstLine = lines.shift();
	const firstLineExpanded = firstLine?.split('\n');
	expect(firstLineExpanded![0].startsWith('\t')).toBe(false);
	expect(
		firstLineExpanded![firstLineExpanded!.length - 1].startsWith('\t'),
	).toBe(false);
});

test('indentLines with nested structure in ', () => {
	const testString = '\tfolders?: {\n\tid?: string,name?: string\n}[]';
	const lines = indentLines([testString]);
	const firstLine = lines.shift();
	const firstLineExpanded = firstLine?.split('\n');
	expect(firstLineExpanded![0].startsWith('\t')).toBe(true);
	expect(
		firstLineExpanded![firstLineExpanded!.length - 1].startsWith('\t'),
	).toBe(true);
});
