// import * as fs from 'fs/promises';
import { readFileSync } from 'fs';
import * as ts from 'typescript';
import createDebugger from 'debug';

const baseDebugger = createDebugger('proptype-converter');
const simplePropType =
	/^PropTypes\.(string|bool|number|node|func)\.?(isRequired)?$/;

/**
 * Parse a TS/JS file for PropTypes
 */
export async function processFile(fileName: string): Promise<Map<
	string,
	{
		mappedProperties: Map<string, { tsType: string; required: boolean }>;
		notMappedProperties: Map<string, string>;
	}
> | null> {
	const d = baseDebugger.extend('processFile');

	d('reading file');
	const sourceFile = ts.createSourceFile(
		fileName,
		readFileSync(fileName).toString(),
		ts.ScriptTarget.ES2015,
		true,
	);
	d('file read', { wasSuccessful: Boolean(sourceFile) });

	if (!sourceFile) {
		console.error('No sourceFile');
		return null;
	}

	const components = new Map();

	ts.forEachChild(sourceFile, (node) => {
		// find [Component].propTypes
		if (
			ts.isExpressionStatement(node) &&
			ts.isBinaryExpression(node.expression) &&
			ts.isPropertyAccessExpression(node.expression.left) &&
			node.expression.left.name.getText() === 'propTypes'
		) {
			const componentName = node.expression.left.expression.getText();
			d('found PropTypes for component', componentName);
			if (ts.isObjectLiteralExpression(node.expression.right)) {
				const mappedProperties = new Map();
				const notMappedProperties = new Map();
				node.expression.right.properties.forEach((property) => {
					const name = property.name?.getText();
					if (!name) {
						return;
					}
					let tsType = null;
					let required = false;
					if (ts.isPropertyAssignment(property)) {
						// check if this is a simple PropType that we can match via
						// a simple regex rather than parsing.
						const result = getPropertyDetails(property);
						if (result.status === 'success') {
							tsType = result.tsType;
							required = result.required;
						} else {
							// could not match property
						}
					}

					if (tsType) {
						mappedProperties.set(name, { tsType, required });
					} else {
						notMappedProperties.set(name, property.getFullText());
					}
				});

				components.set(componentName, {
					mappedProperties,
					notMappedProperties,
				});
			}
		}
	});

	return components;
}

type PropertyDetailsResult =
	| {
			status: 'success';
			tsType: string | null;
			required: boolean;
	  }
	| { status: 'notMatched'; propertyText: string };

function getPropertyDetails(
	property: ts.PropertyAssignment,
): PropertyDetailsResult {
	const d = baseDebugger.extend('getPropertyDetails');

	const simpleResult = getSimplePropertyDetails(property);
	if (simpleResult.status === 'success') {
		d('found simple PropType match for property', simpleResult);
		return simpleResult;
	}

	const callResult = getCallPropertyDetails(property);
	if (callResult.status === 'success') {
		d('found call PropType match for property', callResult);
		return callResult;
	}

	d('could not match property', property.getText());
	return {
		status: 'notMatched',
		propertyText: property.getText(),
	};
}

function createOneOfType(
	args: ReturnType<typeof getCallExpressionArgs>,
	required = false,
): PropertyDetailsResult {
	const d = baseDebugger.extend('createOneOfType');
	if (!args) {
		d('no args, not matched');
		return {
			status: 'notMatched',
			propertyText: '',
		};
	}

	if (Array.isArray(args.args)) {
		return {
			status: 'success',
			tsType: `${args.args.join(' | ')}`,
			required,
		};
	}

	d('could not match any oneOf type we could understand...');
	return {
		status: 'notMatched',
		propertyText: '',
	};
}

function createShapeType(
	args: ReturnType<typeof getCallExpressionArgs>,
	required = false,
): PropertyDetailsResult {
	if (!args) {
		return {
			status: 'notMatched',
			propertyText: '',
		};
	}

	const typeText = `{\n${args.args.map((arg) => `\t${arg}`).join('\n')}\n}`;
	return {
		status: 'success',
		tsType: typeText,
		required,
	};
}

function getObjectLiteralDetails(
	node: ts.ObjectLiteralExpression,
): (string | null)[] {
	return node.properties.map((argProperty) => {
		const propertyName = argProperty.name?.getText();
		if (!propertyName) {
			return null;
		}
		if (
			ts.isPropertyAssignment(argProperty) &&
			ts.isPropertyAccessExpression(argProperty.initializer)
		) {
			const result = getPropertyDetails(argProperty);
			if (result.status === 'success') {
				return `${propertyName}${result.required ? '' : '?'}: ${result.tsType}`;
			} else {
				return `${propertyName}: unknown // could not parse`;
			}
		}
		return null;
	});
}

type CallTypeDetails = {
	callType: string;
	args: (string | null | CallTypeDetails | (string | null)[])[];
};

/**
 * Get types for PropTypes that represent a call expression...
 */
function getCallExpressionArgs(
	node: ts.CallExpression,
): CallTypeDetails | null {
	const d = baseDebugger.extend('getCallExpressionArgs');
	if (ts.isPropertyAccessExpression(node.expression)) {
		const callType = node.expression.name.getText();
		d('found callType', callType);
		const args = node.arguments
			.map((argument) => {
				if (ts.isArrayLiteralExpression(argument)) {
					const arrayLiteral = argument.elements.map((element) => {
						return element.getText();
					});
					return arrayLiteral;
				} else if (ts.isObjectLiteralExpression(argument)) {
					return getObjectLiteralDetails(argument);
				} else if (
					ts.isCallExpression(argument) &&
					ts.isPropertyAccessExpression(argument.expression)
				) {
					const callType = argument.expression.name.getText();
					const nestedArgs = argument.arguments.map((nestedArg) => {
						if (ts.isObjectLiteralExpression(nestedArg)) {
							return getObjectLiteralDetails(nestedArg);
						}
						return null;
					});
					return {
						callType,
						args: nestedArgs,
					};
				}
				return null;
			})
			.flat();
		d('found CallExpression args', {
			callType,
			args,
		});
		return { callType, args };
	}

	return null;
}

function getCallPropertyDetails(
	property: ts.PropertyAssignment,
): PropertyDetailsResult {
	const d = baseDebugger.extend('getCallPropertyDetails');

	// match most simple types
	if (
		ts.isCallExpression(property.initializer) &&
		ts.isPropertyAccessExpression(property.initializer.expression)
	) {
		d('is CallExpression with PropertyAccessExpression');
		const argDetails = getCallExpressionArgs(property.initializer);
		if (argDetails) {
			const { callType, args } = argDetails;
			d('found callType', callType);
			if (callType === 'oneOf') {
				const result = createOneOfType(argDetails);
				d('oneOf result', result);
				return result;
			} else if (callType === 'shape') {
				return createShapeType(argDetails);
			} else if (callType === 'arrayOf') {
				const types = args.map((arg) => {
					if (typeof arg === 'string') {
						return arg;
					}
					if (
						typeof arg === 'object' &&
						arg &&
						'callType' in arg &&
						arg?.callType === 'shape'
					) {
						const result = createShapeType(arg);
						return result.status === 'success' ? result.tsType : null;
					}
					return null;
				});
				return {
					status: 'success',
					tsType: `${types.join(' ')}[]`,
					required: false,
				};
			}
		} else {
			console.warn('Could not getCallExpressionArgs');
		}
	}
	// typically matches a call expression with .isRequired tacked on
	else if (
		ts.isPropertyAccessExpression(property.initializer) &&
		ts.isCallExpression(property.initializer.expression) &&
		ts.isPropertyAccessExpression(property.initializer.expression.expression)
	) {
		const callType = property.initializer.expression.expression.name.getText();
		const result = getCallExpressionArgs(property.initializer.expression);
		const args = result ? result.args : [];
		if (callType === 'oneOf') {
			return createOneOfType(
				{ callType, args },
				property.initializer.name.getText() === 'isRequired',
			);
		} else if (callType === 'shape') {
			d('Found shape', { args });
			return {
				status: 'success',
				tsType: `{\n${args.map((arg) => `\t${arg}`).join('\n')}\n}`,
				required: property.initializer.name.getText() === 'isRequired',
			};
		}
	}
	return {
		status: 'notMatched',
		propertyText: property.getText(),
	};
}

/**
 * Try to match a property to very simple PropTypes.
 *
 * Uses a crude regex check to see if the text matches something easy.
 */
function getSimplePropertyDetails(
	property: ts.PropertyAssignment,
	indentLevel = 0,
): PropertyDetailsResult {
	const d = baseDebugger.extend('getSimplePropertyDetails');
	// glance at the type and see if it is a common/simple thing we can convert without much hassle:
	const propertyText = property.initializer.getText().trim();
	d('testing property for simple PropType match', propertyText);
	if (simplePropType.test(propertyText)) {
		const result = simplePropType.exec(propertyText);
		if (!result) {
			return { status: 'notMatched', propertyText: property.getText() };
		}
		const tsType = mapPropTypeTypeToTSType(result[1]);
		const required = Boolean(result[2]);
		return {
			status: 'success',
			tsType,
			required,
		};
	}
	return {
		status: 'notMatched',
		propertyText: property.getText(),
	};
}

function mapPropTypeTypeToTSType(propTypeType: string) {
	switch (propTypeType) {
		case 'string':
		case 'number':
			return propTypeType;
		case 'bool':
			return 'boolean';
		case 'func':
			return 'CallableFunction';
		case 'node':
			return 'React.ReactNode';
		default:
			return null;
	}
}

export function indent(text: string, indentLevel = 0) {
	return `\n`.repeat(indentLevel) + text;
}

export function createTypes(
	components: Awaited<ReturnType<typeof processFile>>,
): string[] {
	return Array.from(components ?? []).map(([name, component]) => {
		const propsTypeName = `${name}Props`;
		const lines = [`type ${propsTypeName} = {`];

		const allProperties = new Map<string, string[]>();

		component.mappedProperties.forEach((property, name) => {
			allProperties.set(
				`${name}${!property.required ? '?' : ''}`,
				typeToString(property),
			);
		});

		component.notMappedProperties.forEach((property, name) => {
			allProperties.set(name, ['unknown; // Could not process this property']);
		});

		allProperties.forEach((propertyLines, name) => {
			const indentedPropertyLines = indentLines(propertyLines);
			lines.push(`\t${name}: ${indentedPropertyLines.join('\n')}`);
		});

		lines.push('}');

		return lines.join('\n');
	});
}

function semiColonLine(line: string) {
	if (line.includes('// ')) {
		const [lineWithoutComment, comment] = line.split('//');
		if (!lineWithoutComment.trim().endsWith(';')) {
			return `${lineWithoutComment.trim()}; // ${comment}`;
		}
		return line;
	}
	if (!line.endsWith(';')) {
		return `${line};`;
	}
	return line;
}

function indentLines(lines: string[], indentLevel = 1): string[] {
	return lines.map((line) => {
		// a line is a string that may contain its own line breaks and we want
		// to indent those lines-within-a-line...
		let expandedLine = line.split('\n');

		if (expandedLine.length > 1) {
			// nested shape, we need to indent the last line and intent the middle lines by +1
			if (
				expandedLine[0] === '{' &&
				expandedLine[expandedLine.length - 1].startsWith('}')
			) {
				expandedLine = expandedLine.map((nestedLine, index) => {
					if (index === 0) {
						return nestedLine;
					}
					let modifiedLine = semiColonLine(`\t${nestedLine}`);
					return modifiedLine;
				});
			}
			return expandedLine.join('\n');
		}
		return semiColonLine(line);
	});
}

function typeToString({ tsType }: { tsType: string }) {
	return [`${tsType};`];
}
