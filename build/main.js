"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSourceFile = processSourceFile;
exports.createTypeForComponent = createTypeForComponent;
exports.createPropsForComponent = createPropsForComponent;
exports.createTypesForComponents = createTypesForComponents;
const ts = __importStar(require("typescript"));
const debug_1 = __importDefault(require("debug"));
const lines_1 = require("./lines");
const parserHelpers_1 = require("./parserHelpers");
const baseDebugger = (0, debug_1.default)('proptype-converter');
/** For very simple prop types, save some time and just regex it */
const simplePropType = /^PropTypes\.(string|bool|number|node|func)\.?(isRequired)?$/;
const defaultProcessSourceFileOptions = {
    includeJSDocCommentInComponentPosition: true,
    includeUnknownFunctionArgumentProps: false,
};
/**
 * Given a source file, process it to find PropTypes and components.
 *
 * This function returns a `Map` of components with their matching component PropType
 * details.
 */
function processSourceFile(sourceFile, options = {}) {
    const processingOptions = {
        ...defaultProcessSourceFileOptions,
        ...options,
    };
    const d = baseDebugger.extend('processSourceFile');
    /** Map of components and their `propTypes` */
    const components = new Map();
    /** Map of `defaultProps` by component name. */
    const componentDefaultProps = new Map();
    /**
     * Map of functions that might be a React component that will be referenced later by `propTypes` or `defaultProps`
     */
    const possibleComponents = new Map();
    ts.forEachChild(sourceFile, (node) => {
        // find [Component].propTypes
        if ((0, parserHelpers_1.isExpressionWithName)(node, 'propTypes')) {
            const componentName = node.expression.left.expression.getText();
            d('found PropTypes for component', componentName);
            if (ts.isObjectLiteralExpression(node.expression.right)) {
                const { mappedProperties, notMappedProperties } = processPropTypeProperties(node.expression.right.properties);
                const possibleComponent = possibleComponents.get(componentName);
                const defaultProps = componentDefaultProps.get(componentName);
                components.set(componentName, {
                    mappedProperties,
                    notMappedProperties,
                    range: [node.getStart(), node.getEnd()],
                    componentRange: possibleComponent?.functionPosition ?? null,
                    parameterRange: possibleComponent?.parameterPosition ?? null,
                    defaultProps: defaultProps?.props ?? null,
                    defaultPropsRange: defaultProps?.position ?? null,
                });
            }
        }
        else if ((0, parserHelpers_1.isExpressionWithName)(node, 'defaultProps')) {
            // found [ComponentName].defaultProps = {}
            const componentName = node.expression.left.expression.getText();
            if (ts.isObjectLiteralExpression(node.expression.right)) {
                const defaultProps = processDefaultProps(node.expression.right.properties);
                if (defaultProps.size > 0) {
                    componentDefaultProps.set(componentName, {
                        props: defaultProps,
                        position: [node.getStart(), node.getEnd()],
                    });
                }
            }
        }
        else if (ts.isFunctionDeclaration(node)) {
            const result = processFunctionDeclarationForReactComponent(node, sourceFile, processingOptions);
            if (result) {
                possibleComponents.set(result.functionName, {
                    functionPosition: result.functionPosition,
                    parameterPosition: result.parameterPosition,
                    functionPropArguments: result.functionPropArguments,
                });
            }
        }
        else if (ts.isVariableStatement(node)) {
            // possible function expression/arrow function
            const arrowFunction = node.declarationList.declarations.find(parserHelpers_1.isArrowFunction) ?? null;
            // found an arrow function
            if (arrowFunction) {
                const result = processArrowFunctionForReactComponent(arrowFunction, node, sourceFile, processingOptions);
                if (result) {
                    possibleComponents.set(result.functionName, {
                        functionPosition: result.functionPosition,
                        functionPropArguments: result.functionPropArguments,
                        parameterPosition: result.parameterPosition,
                    });
                }
            }
        }
    });
    // we may have picked up possibleComponents or componentDefaultProps after
    // we parsed the component, so let's add any we missed...
    possibleComponents.forEach((possibleComponent, key) => {
        const component = components.get(key);
        if (component) {
            component.componentRange = possibleComponent.functionPosition;
            component.parameterRange = possibleComponent.parameterPosition;
            components.set(key, component);
            if (possibleComponent.functionPropArguments.size > 0 &&
                processingOptions.includeUnknownFunctionArgumentProps) {
                // check if there are any props we haven't found in parsing the component's
                // defaultProps/propTypes
                possibleComponent.functionPropArguments.forEach((defaultValue, argumentName) => {
                    if (!component.mappedProperties.has(argumentName) &&
                        !component.notMappedProperties.has(argumentName)) {
                        d('Found unknown prop argument, adding to notMappedProperties', argumentName, defaultValue);
                        component.notMappedProperties.set(argumentName, defaultValue ? `${defaultValue}` : '');
                    }
                });
            }
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
function functionNameStartsWithCapitalLetter(functionName) {
    return functionName[0] === functionName[0].toLocaleUpperCase();
}
function processDefaultProps(properties) {
    const defaultProps = new Map();
    properties.forEach((property) => {
        const name = property.name?.getText();
        let value = null;
        if (!name) {
            return;
        }
        if (ts.isPropertyAssignment(property)) {
            value = property.initializer.getText();
        }
        defaultProps.set(name, value);
    });
    return defaultProps;
}
function processArrowFunctionForReactComponent(arrowFunction, parentNode, sourceFile, processingOptions) {
    const functionName = arrowFunction.name.getText();
    if (functionNameStartsWithCapitalLetter(functionName)) {
        let parameterPosition = null;
        const functionPropArguments = new Map();
        if (ts.isArrowFunction(arrowFunction.initializer) &&
            arrowFunction.initializer.parameters.length > 0) {
            const firstParameter = arrowFunction.initializer.parameters[0];
            parameterPosition = [firstParameter.getStart(), firstParameter.getEnd()];
            const firstParameterPropArguments = processFirstArgumentForPropArguments(firstParameter);
            if (firstParameterPropArguments.size) {
                firstParameterPropArguments.forEach((value, key) => functionPropArguments.set(key, value));
            }
        }
        return {
            functionName,
            functionPosition: [
                parentNode.getStart(sourceFile, processingOptions.includeJSDocCommentInComponentPosition),
                arrowFunction.initializer.getEnd(),
            ],
            functionPropArguments,
            parameterPosition,
        };
    }
    return null;
}
/** Found a function declaration that could be a React component. */
function processFunctionDeclarationForReactComponent(node, sourceFile, processingOptions) {
    const d = baseDebugger.extend('processFunctionDeclarationForReactComponent');
    // found a potential function component
    const functionName = node.name?.getText();
    // check that the first letter is a capital letter
    if (functionName && functionNameStartsWithCapitalLetter(functionName)) {
        d('Found possible React functional component. Function arguments', functionName);
        let parameterPosition = null;
        const functionPropArguments = new Map();
        if (node.parameters.length > 0) {
            const firstParameter = node.parameters[0];
            parameterPosition = [firstParameter.getStart(), firstParameter.getEnd()];
            const firstParameterPropArguments = processFirstArgumentForPropArguments(firstParameter);
            if (firstParameterPropArguments.size) {
                firstParameterPropArguments.forEach((value, key) => functionPropArguments.set(key, value));
            }
        }
        return {
            functionName,
            functionPosition: [
                node.getStart(sourceFile, processingOptions.includeJSDocCommentInComponentPosition),
                node.getEnd(),
            ],
            parameterPosition,
            functionPropArguments,
        };
    }
    return null;
}
function processFirstArgumentForPropArguments(firstParameter) {
    const functionPropArguments = new Map();
    if (ts.isObjectBindingPattern(firstParameter.name)) {
        const d = baseDebugger.extend('processFunctionDeclarationForReactComponent');
        firstParameter.name.elements.forEach((element) => {
            d('found argument prop', element.name.getText());
            functionPropArguments.set(element.name.getText(), element.initializer?.getText() ?? null);
        });
    }
    return functionPropArguments;
}
function processPropTypeProperties(properties) {
    const mappedProperties = new Map();
    const notMappedProperties = new Map();
    properties.forEach((property) => {
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
            }
            else {
                // could not match property
            }
        }
        if (tsType) {
            mappedProperties.set(name, { tsType, required });
        }
        else {
            notMappedProperties.set(name, property.getFullText());
        }
    });
    return { mappedProperties, notMappedProperties };
}
/**
 * Try to get details of what kind of PropType this property represents.
 */
function getPropertyDetails(property) {
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
function createOneOfType(args, required = false) {
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
function createShapeType(shape, required = false) {
    const d = baseDebugger.extend('createShapeType');
    if (!shape) {
        d('no args');
        return {
            status: 'notMatched',
            propertyText: '',
        };
    }
    // create the shape's type
    const typeText = ['{'];
    shape.args.forEach((thisArg) => {
        if (Array.isArray(thisArg)) {
            thisArg.forEach((subArg) => {
                typeText.push(`\t${subArg}`);
            });
        }
        else {
            typeText.push(`\t${thisArg}`);
        }
    });
    typeText.push('}');
    return {
        status: 'success',
        tsType: typeText.join('\n'),
        required,
    };
}
/**
 * Return details about an object literal PropType.
 *
 * Often matches `shape` PropTypes.
 */
function getObjectLiteralDetails(node) {
    const d = baseDebugger.extend('getObjectLiteralDetails');
    return node.properties.map((argProperty) => {
        const propertyName = argProperty.name?.getText();
        if (!propertyName) {
            return null;
        }
        d('found', propertyName);
        if (ts.isPropertyAssignment(argProperty) &&
            ts.isPropertyAccessExpression(argProperty.initializer)) {
            const result = getPropertyDetails(argProperty);
            if (result.status === 'success') {
                return `${propertyName}${result.required ? '' : '?'}: ${result.tsType}`;
            }
        }
        else if (ts.isPropertyAssignment(argProperty) &&
            ts.isCallExpression(argProperty.initializer)) {
            const result = getPropertyDetails(argProperty);
            if (result.status === 'success') {
                d('got result back', result);
                return `${propertyName}${result.required ? '' : '?'}: ${result.tsType}`;
            }
        }
        return `${propertyName}: unknown // could not parse`;
    });
}
/**
 * Get types for PropTypes that represent a call expression...
 */
function getCallExpressionArgs(node) {
    const d = baseDebugger.extend('getCallExpressionArgs');
    if (ts.isPropertyAccessExpression(node.expression)) {
        const callType = node.expression.name.getText();
        d('found callType', callType);
        const args = node.arguments
            .map((argument) => {
            if (ts.isArrayLiteralExpression(argument)) {
                d('found ArrayLiteralExpression argument');
                const arrayLiteral = argument.elements.map((element) => {
                    return element.getText();
                });
                return arrayLiteral;
            }
            else if (ts.isObjectLiteralExpression(argument)) {
                d('found ObjectLiteralExpression argument');
                return getObjectLiteralDetails(argument);
            }
            else if ((0, parserHelpers_1.isCallExpressionWithPropertyAccess)(argument)) {
                const callType = argument.expression.name.getText();
                d('found CallExpression argument', callType);
                const nestedArgs = argument.arguments.map((nestedArg) => {
                    if (ts.isObjectLiteralExpression(nestedArg)) {
                        return getObjectLiteralDetails(nestedArg);
                    }
                    else if (ts.isIdentifier(nestedArg)) {
                        return nestedArg.getText();
                    }
                    return null;
                });
                return {
                    callType,
                    args: nestedArgs,
                };
            }
            else if (ts.isIdentifier(argument)) {
                return argument.getText();
            }
            else {
                d('unknown argument', {
                    argument,
                });
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
    else {
        d('Unknown node/expression', node);
    }
    return null;
}
function getCallPropertyDetails(property) {
    const d = baseDebugger.extend('getCallPropertyDetails');
    // match most simple types
    if ((0, parserHelpers_1.isCallExpressionWithPropertyAccess)(property.initializer)) {
        d('is CallExpression with PropertyAccessExpression');
        const argDetails = getCallExpressionArgs(property.initializer);
        if (argDetails) {
            const { callType, args } = argDetails;
            d('found callType', callType);
            if (callType === 'oneOf') {
                const result = createOneOfType(argDetails);
                d('oneOf result', result);
                return result;
            }
            else if (callType === 'shape') {
                return createShapeType(argDetails);
            }
            else if (callType === 'arrayOf') {
                const types = args.map((arg) => {
                    if (typeof arg === 'string') {
                        return arg;
                    }
                    if (typeof arg === 'object' &&
                        arg &&
                        'callType' in arg &&
                        arg?.callType === 'shape') {
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
            else if (callType === 'instanceOf') {
                d('instanceOf', args);
                return {
                    status: 'success',
                    tsType: Array.isArray(args) ? args.join(' | ') : args,
                    required: false,
                };
            }
        }
        else {
            console.warn('Could not getCallExpressionArgs');
        }
    }
    // typically matches a call expression with .isRequired tacked on
    else if (ts.isPropertyAccessExpression(property.initializer) &&
        ts.isCallExpression(property.initializer.expression) &&
        ts.isPropertyAccessExpression(property.initializer.expression.expression)) {
        const callType = property.initializer.expression.expression.name.getText();
        const result = getCallExpressionArgs(property.initializer.expression);
        const args = result ? result.args : [];
        if (callType === 'oneOf') {
            return createOneOfType({ callType, args }, property.initializer.name.getText() === 'isRequired');
        }
        else if (callType === 'shape') {
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
function getSimplePropertyDetails(property, indentLevel = 0) {
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
function mapPropTypeTypeToTSType(propTypeType) {
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
function createTypeForComponent(name, component) {
    const propsTypeName = `${name}Props`;
    const lines = [`type ${propsTypeName} = {`];
    const allProperties = new Map();
    component.mappedProperties.forEach((property, name) => {
        allProperties.set(`${name}${!property.required ? '?' : ''}`, typeToString(property));
    });
    component.notMappedProperties.forEach((property, name) => {
        allProperties.set(name, ['unknown; // Could not process this property']);
    });
    allProperties.forEach((propertyLines, name) => {
        const indentedPropertyLines = (0, lines_1.indentLines)(propertyLines);
        lines.push(`\t${name}: ${indentedPropertyLines.join('\n')}`);
    });
    lines.push('}');
    return lines.join('\n');
}
/** Create a props based on mapped types and default props (if available) */
function createPropsForComponent(component) {
    const props = ['{'];
    const propsWithValues = new Map();
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
function createTypesForComponents(components) {
    return Array.from(components ?? []).map(([name, component]) => {
        return createTypeForComponent(name, component);
    });
}
function typeToString({ tsType }) {
    return [`${tsType};`];
}
