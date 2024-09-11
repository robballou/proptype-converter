import { expect, test } from 'vitest';
import {
	createPropsForComponent,
	createTypeForComponent,
	createTypesForComponents,
} from './main';
import { processFile } from './file';
import path from 'path';
import fs from 'fs/promises';

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

	expect(createTypesForComponents(result!)).toMatchSnapshot();
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

	expect(createTypesForComponents(result!)).toMatchSnapshot();
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

	expect(createTypesForComponents(result!)).toMatchSnapshot();
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

	expect(createTypesForComponents(result!)).toMatchSnapshot();
});

test('fixture 005: shape', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture005.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.mappedProperties.size).toEqual(2);
	expect(component.notMappedProperties.size).toEqual(0);

	const someObject = component.mappedProperties.get('someObject')!;
	expect(someObject.tsType).toContain('key');
	expect(someObject.required).toBe(false);

	const requiredProp = component.mappedProperties.get('requiredProp')!;
	expect(requiredProp.tsType).toContain('key');
	expect(requiredProp.required).toBe(true);

	expect(createTypesForComponents(result!)).toMatchSnapshot();
});

test('fixture 006: shape array', async () => {
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

	expect(createTypesForComponents(result!)).toMatchSnapshot();
	expect(createPropsForComponent(component!)).toMatchSnapshot();
});

test('fixture 007: jsdoc', async () => {
	const fixturePath = path.resolve(__dirname, './fixtures/fixture007.js');
	const fixtureData = fs.readFile(fixturePath, 'utf-8');
	const result = await processFile(fixturePath);
	const component = result!.get('MyComponent');
	const text = (await fixtureData).substring(
		component!.componentRange![0],
		component!.componentRange![1],
	);
	expect(text.startsWith('/**')).toBe(true);
	expect(createPropsForComponent(component!)).not.toBeNull();
	expect(createPropsForComponent(component!)).toMatchSnapshot();
});

test('fixture 008: defaultProps', async () => {
	const result = await processFile(
		path.resolve(__dirname, './fixtures/fixture008.js'),
	);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.defaultProps).not.toBe(null);
	expect(component.defaultPropsRange).not.toBe(null);
	expect(component.defaultProps!.has('optional')).toBe(true);

	expect(createTypesForComponents(result!)).toMatchSnapshot();
	expect(createPropsForComponent(component)).toMatchSnapshot();
});

test('fixture 009: function expression defaultProps', async () => {
	const fixturePath = path.resolve(__dirname, './fixtures/fixture009.js');
	const fixtureData = fs.readFile(fixturePath, 'utf-8');
	const result = await processFile(fixturePath);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.defaultProps).not.toBe(null);
	expect(component.defaultPropsRange).not.toBe(null);
	expect(component.defaultProps!.has('optional')).toBe(true);
	expect(component.parameterRange).not.toBeNull();
	expect(component.componentRange).not.toBeNull();

	const text = (await fixtureData).substring(
		component.componentRange![0],
		component.componentRange![1],
	);
	expect(text.startsWith('const')).toBe(true);

	expect(createTypesForComponents(result!)).toMatchSnapshot();
	expect(createPropsForComponent(component)).toMatchSnapshot();
});

test('fixture 010: function expression defaultProps', async () => {
	const fixturePath = path.resolve(__dirname, './fixtures/fixture010.js');
	const result = await processFile(fixturePath);
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;

	expect(createTypesForComponents(result!)).toMatchSnapshot();
	expect(createPropsForComponent(component)).toMatchSnapshot();
});

test('fixture 011: component arguments contain a prop not in propTypes/defaultProps', async () => {
	const fixturePath = path.resolve(__dirname, './fixtures/fixture011.js');
	const result = await processFile(fixturePath, {
		includeUnknownFunctionArgumentProps: true,
	});
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.notMappedProperties.has('notInPropTypes')).toBe(true);
	expect(component.notMappedProperties.has('anotherWithDefault')).toBe(true);
	const props = createPropsForComponent(component);
	expect(props).toContain('notInPropTypes');
	const typeDefinition = createTypeForComponent('MyComponent', component);
	expect(typeDefinition).toContain('notInPropTypes');

	expect(createTypesForComponents(result!)).toMatchSnapshot();
	expect(createPropsForComponent(component)).toMatchSnapshot();
});

test('fixture 012: arrow component arguments contain a prop not in propTypes/defaultProps', async () => {
	const fixturePath = path.resolve(__dirname, './fixtures/fixture012.js');
	const result = await processFile(fixturePath, {
		includeUnknownFunctionArgumentProps: true,
	});
	expect(result).not.toBe(null);
	expect(result!.has('MyComponent')).toBe(true);

	const component = result!.get('MyComponent')!;
	expect(component.notMappedProperties.has('notInPropTypes')).toBe(true);
	expect(component.notMappedProperties.has('anotherWithDefault')).toBe(true);
	const props = createPropsForComponent(component);
	expect(props).toContain('notInPropTypes');

	expect(createTypesForComponents(result!)).toMatchSnapshot();
	expect(createPropsForComponent(component)).toMatchSnapshot();
});
