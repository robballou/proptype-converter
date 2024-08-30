import * as ts from 'typescript';
import createDebugger from 'debug';

const baseDebugger = createDebugger('proptype-converter');
const simplePropType =
	/^PropTypes\.(string|bool|number|node|func)\.?(isRequired)?$/;

export type ComponentPropTypes = {
	mappedProperties: Map<string, { tsType: string; required: boolean }>;
	notMappedProperties: Map<string, string>;
	range: [number, number];
	componentRange: [number, number] | null;
	parameterRange: [number, number] | null;
	defaultProps: Map<string, string> | null;
	defaultPropsRange: [number, number] | null;
};

type ProcessSourceFileOptions = {
	includeJSDocCommentInComponentPosition: boolean;
};

const defaultProcessSourceFileOptions: ProcessSourceFileOptions = {
	includeJSDocCommentInComponentPosition: true,
};

/**
 * Given a source file, process it to find PropTypes and components.
 *
 * This function returns a `Map` of components with their matching component PropType
 * details.
 */
export function processSourceFile(
	sourceFile: ts.SourceFile,
	options: Partial<ProcessSourceFileOptions> = {},
): Map<string, ComponentPropTypes> {
	const processingOptions: ProcessSourceFileOptions = {
		...defaultProcessSourceFileOptions,
		...options,
	};
	const d = baseDebugger.extend('processSourceFile');
	const components = new Map<string, ComponentPropTypes>();
	const componentDefaultProps = new Map<
		string,
		{ position: [number, number]; props: Map<string, string> }
	>();
	const possibleComponents = new Map<
		string,
		{
			functionPosition: [number, number];
			parameterPosition: [number, number] | null;
		}
	>();
	ts.forEachChild(sourceFile, (node) => {
		// find [Component].propTypes
		if (isExpressionWithName(node, 'propTypes')) {
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
					range: [node.getStart(), node.getEnd()],
					componentRange:
						possibleComponents.get(componentName)?.functionPosition ?? null,
					parameterRange:
						possibleComponents.get(componentName)?.parameterPosition ?? null,
					defaultProps: componentDefaultProps.get(componentName)?.props ?? null,
					defaultPropsRange:
						componentDefaultProps.get(componentName)?.position ?? null,
				});
			}
		} else if (isExpressionWithName(node, 'defaultProps')) {
			// found [ComponentName].defaultProps = {}
			const componentName = node.expression.left.expression.getText();
			if (ts.isObjectLiteralExpression(node.expression.right)) {
				const defaultProps = new Map();
				node.expression.right.properties.forEach((property) => {
					const name = property.name?.getText();
					let value: string | null = null;
					if (!name) {
						return;
					}
					if (ts.isPropertyAssignment(property)) {
						value = property.initializer.getText();
					}
					defaultProps.set(name, value);
				});
				if (defaultProps.size > 0) {
					componentDefaultProps.set(componentName, {
						props: defaultProps,
						position: [node.getStart(), node.getEnd()],
					});
				}
			}
		} else if (ts.isFunctionDeclaration(node)) {
			// found a potential function component
			const functionName = node.name?.getText();
			if (
				functionName &&
				functionName[0] === functionName[0].toLocaleUpperCase()
			) {
				possibleComponents.set(functionName, {
					functionPosition: [
						node.getStart(
							sourceFile,
							processingOptions.includeJSDocCommentInComponentPosition,
						),
						node.getEnd(),
					],
					parameterPosition: node.parameters[0]
						? [node.parameters[0].getStart(), node.parameters[0].getEnd()]
						: null,
				});
			}
		} else if (ts.isVariableStatement(node)) {
			// possible function expression/arrow function
			const arrowFunction = node.declarationList.declarations.find(
				(declaration) => {
					if (
						ts.isVariableDeclaration(declaration) &&
						declaration.initializer &&
						ts.isArrowFunction(declaration.initializer)
					) {
						return declaration;
					}
				},
			);

			// found an arrow function
			if (arrowFunction) {
				const functionName = arrowFunction.name.getText();
				if (
					arrowFunction.initializer &&
					functionName[0] === functionName[0].toLocaleUpperCase()
				) {
					let parameterPosition: [number, number] | null = null;

					if (ts.isArrowFunction(arrowFunction.initializer)) {
						parameterPosition = [
							arrowFunction.initializer.parameters[0].getStart(),
							arrowFunction.initializer.parameters[0].getEnd(),
						];
					}

					possibleComponents.set(functionName, {
						functionPosition: [
							node.getStart(
								sourceFile,
								processingOptions.includeJSDocCommentInComponentPosition,
							),
							arrowFunction.initializer.getEnd(),
						],
						parameterPosition,
					});
				}
			}
		}
	});

	// we may have picked up possibleComponents or componentDefaultProps after
	// we parsed the component, so let's add any we missed...
	possibleComponents.forEach((value, key) => {
		const component = components.get(key);
		if (component) {
			component.componentRange = value.functionPosition;
			component.parameterRange = value.parameterPosition;
			components.set(key, component);
		}
	});

	componentDefaultProps.forEach((value, key) => {
		const component = components.get(key);
		if (component) {
			component.defaultProps = value.props;
			component.defaultPropsRange = value.position;
			components.set(key, component);
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

interface BinaryExpressionWithPropertyAccessExpression
	extends ts.BinaryExpression {
	left: ts.PropertyAccessExpression;
}

interface ExpressionStatementWithBinaryPropertyAccessExpression
	extends ts.ExpressionStatement {
	expression: BinaryExpressionWithPropertyAccessExpression;
}

function isExpressionWithName(
	node: ts.Node,
	name: string,
): node is ExpressionStatementWithBinaryPropertyAccessExpression {
	return (
		ts.isExpressionStatement(node) &&
		ts.isBinaryExpression(node.expression) &&
		ts.isPropertyAccessExpression(node.expression.left) &&
		node.expression.left.name.getText() === name
	);
}

/**
 * Try to get details of what kind of PropType this property represents.
 */
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

/**
 * Convert a `oneOf` PropType to its correlated Type.
 */
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

/**
 * Convert a `shape` PropType to its correlated Type.
 */
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

/**
 * Return details about an object literal PropType.
 *
 * Often matches `shape` PropTypes.
 */
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

export function createTypeForComponent(
	name: string,
	component: ComponentPropTypes,
): string {
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
}

/** Create a props based on mapped types and default props (if available) */
export function createPropsForComponent(component: ComponentPropTypes): string | null {
	const props = ['{'];
	const propsWithValues = new Map<string, string | null>();

	component.mappedProperties.forEach((value, key) => {
		propsWithValues.set(key, null);
	});

	component.notMappedProperties.forEach((value, key) => {
		propsWithValues.set(key, null);
	});

	component.defaultProps?.forEach((value, key) => {
		propsWithValues.set(key, value);
	});

	const sortedKeys = Array.from(propsWithValues.keys()).sort();

	for (const key of sortedKeys) {
		const value = propsWithValues.get(key) ?? null;
		props.push(value ? `${key} = ${value},` : `${key},`);
	}

	props.push('}');

	return props.join(' ');
}

export function createTypesForComponents(
	components: Awaited<ReturnType<typeof processSourceFile>>,
): string[] {
	return Array.from(components ?? []).map(([name, component]) => {
		return createTypeForComponent(name, component);
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
