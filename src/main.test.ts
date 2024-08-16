import { expect, test } from 'vitest';
import { createTypes, processFile } from './main';
import path from 'path';

test('fixture 001: basic', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture001.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(1);
	expect(component.mappedProperties.has('className')).toBe(true);

	const className = component.mappedProperties.get('className')!;
	expect(className.tsType).toEqual('string');
	expect(className.required).toBe(true);
});

test('fixture 002: simple PropTypes only', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture002.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(3);
	expect(component.mappedProperties.has('className')).toBe(true);

	const className = component.mappedProperties.get('className')!;
	expect(className.tsType).toEqual('string');
	expect(className.required).toBe(true);

	const something = component.mappedProperties.get('something')!;
	expect(something.tsType).toEqual('boolean');
	expect(something.required).toBe(false);

	const children = component.mappedProperties.get('children')!;
	expect(children.tsType).toEqual('React.ReactNode');
	expect(children.required).toBe(false);
});

test('fixture 003: a PropType we cannot map', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture003.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(0);
	expect(component.notMappedProperties.size).toEqual(1);
	expect(component.notMappedProperties.has('custom')).toBe(true);
});

test('fixture 004: oneOf', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture004.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(2);
	expect(component.notMappedProperties.size).toEqual(0);

	const custom = component.mappedProperties.get('custom')!;
	expect(custom.tsType).toEqual(`'test' | 'thing'`);
	expect(custom.required).toBe(false);

	const requiredThing = component.mappedProperties.get('requiredThing')!;
	expect(requiredThing.tsType).toEqual(`0 | 1 | 2 | 3 | 4 | 5`);
	expect(requiredThing.required).toBe(true);
});

test('fixture 005: shape', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture005.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(1);
	expect(component.notMappedProperties.size).toEqual(0);

	const someObject = component.mappedProperties.get('someObject')!;
	expect(someObject.tsType).toContain('key');
	expect(someObject.required).toBe(false);
});

test('fixture 005: nested types', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture005.js'),
	);
	const types = createTypes(result);
	expect(types.length).toBe(1);
	const lines = types[0].split('\n');
	expect(lines[0]).toBe('type MyComponentProps = {');
	expect(lines[1]).toBe('\tsomeObject?: {');
	expect(lines[2]).toBe('\t\tkey?: string;');
	expect(lines[3]).toBe('\t};');
	expect(lines[lines.length - 1]).toBe('}');
});

test.only('fixture 006: shape array', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture006.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(1);
	expect(component.notMappedProperties.size).toEqual(0);

	const someObject = component.mappedProperties.get('someObject')!;
	expect(someObject.tsType).toContain('key');
	expect(someObject.required).toBe(false);
});
