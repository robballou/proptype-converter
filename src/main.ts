// import * as fs from 'fs/promises';
import { readFileSync } from 'fs';
import * as ts from 'typescript';

const simplePropType =
	/^PropTypes\.(string|bool|number|node|func)\.?(isRequired)?$/;

export async function processFile(fileName: string): Promise<Map<
	string,
	{
		mappedProperties: Map<string, { tsType: string; required: boolean }>;
		notMappedProperties: Map<string, string>;
	}
> | null> {
	const sourceFile = ts.createSourceFile(
		fileName,
		readFileSync(fileName).toString(),
		ts.ScriptTarget.ES2015,
		true,
	);

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
			if (ts.isObjectLiteralExpression(node.expression.right)) {
				const mappedProperties = new Map();
				const notMappedProperties = new Map();
				node.expression.right.properties.forEach((property) => {
					const name = property.name?.getText();
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
	const simpleResult = getSimplePropertyDetails(property);
	if (simpleResult.status === 'success') {
		return simpleResult;
	}

	const callResult = getCallPropertyDetails(property);
	if (callResult.status === 'success') {
		return callResult;
	}

	return {
		status: 'notMatched',
		propertyText: property.getText(),
	};
}

function createOneOfType(
	args: ReturnType<typeof getCallExpressionArgs>,
	required = false,
): PropertyDetailsResult {
	if (!args) {
		return {
			status: 'notMatched',
			propertyText: '',
		};
	}

	if (Array.isArray(args)) {
		return {
			status: 'success',
			tsType: `${args.join(' | ')}`,
			required,
		};
	}

	const { callType, args: nestedArgs } = args;
	if (callType === 'shape') {
		return {
			status: 'success',
			tsType: `{\n${nestedArgs.map((arg) => `\t${arg}`).join('\n')}\n}`,
			required: false,
		};
	}

	return {
		status: 'notMatched',
		propertyText: '',
	};
}

function getObjectLiteralDetails(node: ts.ObjectLiteralExpression) {
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
	});
}

/**
 * Get types for PropTypes that represent a call expression...
 */
function getCallExpressionArgs(node: ts.CallExpression) {
	if (ts.isPropertyAccessExpression(node.expression)) {
		const callType = node.expression.name.getText();
		const args = node.arguments
			.map((argument) => {
				if (ts.isArrayLiteralExpression(argument)) {
					return argument.elements.map((element) => {
						return element.getText();
					});
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
					});
					return {
						callType,
						args: nestedArgs,
					};
				}
			})
			.flat();
		return { callType, args };
	}

	return null;
}

function getCallPropertyDetails(
	property: ts.PropertyAssignment,
): PropertyDetailsResult {
	// match most simple types
	if (
		ts.isCallExpression(property.initializer) &&
		ts.isPropertyAccessExpression(property.initializer.expression)
	) {
		const argDetails = getCallExpressionArgs(property.initializer);
		if (argDetails) {
			const { callType, args } = argDetails;
			if (callType === 'oneOf') {
				return createOneOfType(argDetails);
			} else if (callType === 'shape') {
				return {
					status: 'success',
					tsType: `{\n${args.map((arg) => `\t${arg}`).join('\n')}\n}`,
					required: false,
				};
			} else if (callType === 'arrayOf') {
				const types = args.map((arg) => {
					if (typeof arg === 'string') {
						return arg;
					}
					if (arg?.callType === 'shape') {
						return `{\n${arg.args.map((arg) => `\t${arg}`).join('\n')}\n}`;
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
	} else if (
		ts.isPropertyAccessExpression(property.initializer) &&
		ts.isCallExpression(property.initializer.expression) &&
		ts.isPropertyAccessExpression(property.initializer.expression.expression)
	) {
		const callType = property.initializer.expression.expression.name.getText();
		const args = property.initializer.expression.arguments
			.map((argument) => {
				if (ts.isArrayLiteralExpression(argument)) {
					return argument.elements.map((element) => {
						return element.getText();
					});
				}
			})
			.flat();
		if (callType === 'oneOf') {
			return createOneOfType(
				{ callType, args },
				property.initializer.name.getText() === 'isRequired',
			);
		}
	}
	return {
		status: 'notMatched',
		propertyText: property.getText(),
	};
}

function getArgumentDetails() {}

function getSimplePropertyDetails(
	property: ts.PropertyAssignment,
	indentLevel = 0,
): PropertyDetailsResult {
	// glance at the type and see if it is a common/simple thing we can convert without much hassle:
	const propertyText = property.initializer.getText().trim();
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

export function indentLines(lines: string[], indentLevel = 1): string[] {
	return lines.map((line) => {
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
					let modifiedLine = `\t${nestedLine}`;
					if (!modifiedLine.endsWith(';')) {
						modifiedLine += ';';
					}
					return modifiedLine;
				});
			}
			return expandedLine.join('\n');
		}

		if (!line.endsWith(';')) {
			return `${line};`;
		}
		return line;
	});
}

export function typeToString({
	tsType,
	required,
}: {
	tsType: string;
	required: boolean;
}) {
	return [`${tsType};`];
}
