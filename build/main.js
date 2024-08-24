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
exports.createTypesForComponents = createTypesForComponents;
const ts = __importStar(require("typescript"));
const debug_1 = __importDefault(require("debug"));
const baseDebugger = (0, debug_1.default)('proptype-converter');
const simplePropType = /^PropTypes\.(string|bool|number|node|func)\.?(isRequired)?$/;
const defaultProcessSourceFileOptions = {
    includeJSDocCommentInComponentPosition: true,
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
    const components = new Map();
    const possibleComponents = new Map();
    ts.forEachChild(sourceFile, (node) => {
        // find [Component].propTypes
        if (ts.isExpressionStatement(node) &&
            ts.isBinaryExpression(node.expression) &&
            ts.isPropertyAccessExpression(node.expression.left) &&
            node.expression.left.name.getText() === 'propTypes') {
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
                components.set(componentName, {
                    mappedProperties,
                    notMappedProperties,
                    range: [node.getStart(), node.getEnd()],
                    componentRange: possibleComponents.get(componentName) ?? null,
                });
            }
        }
        else if (ts.isFunctionDeclaration(node)) {
            const functionName = node.name?.getText();
            if (functionName) {
                possibleComponents.set(functionName, [
                    node.getStart(sourceFile, processingOptions.includeJSDocCommentInComponentPosition),
                    node.getEnd(),
                ]);
            }
        }
    });
    return components;
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
function createShapeType(args, required = false) {
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
function getObjectLiteralDetails(node) {
    return node.properties.map((argProperty) => {
        const propertyName = argProperty.name?.getText();
        if (!propertyName) {
            return null;
        }
        if (ts.isPropertyAssignment(argProperty) &&
            ts.isPropertyAccessExpression(argProperty.initializer)) {
            const result = getPropertyDetails(argProperty);
            if (result.status === 'success') {
                return `${propertyName}${result.required ? '' : '?'}: ${result.tsType}`;
            }
            else {
                return `${propertyName}: unknown // could not parse`;
            }
        }
        return null;
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
                const arrayLiteral = argument.elements.map((element) => {
                    return element.getText();
                });
                return arrayLiteral;
            }
            else if (ts.isObjectLiteralExpression(argument)) {
                return getObjectLiteralDetails(argument);
            }
            else if (ts.isCallExpression(argument) &&
                ts.isPropertyAccessExpression(argument.expression)) {
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
function getCallPropertyDetails(property) {
    const d = baseDebugger.extend('getCallPropertyDetails');
    // match most simple types
    if (ts.isCallExpression(property.initializer) &&
        ts.isPropertyAccessExpression(property.initializer.expression)) {
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
        const indentedPropertyLines = indentLines(propertyLines);
        lines.push(`\t${name}: ${indentedPropertyLines.join('\n')}`);
    });
    lines.push('}');
    return lines.join('\n');
}
function createTypesForComponents(components) {
    return Array.from(components ?? []).map(([name, component]) => {
        return createTypeForComponent(name, component);
    });
}
function semiColonLine(line) {
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
function indentLines(lines, indentLevel = 1) {
    return lines.map((line) => {
        // a line is a string that may contain its own line breaks and we want
        // to indent those lines-within-a-line...
        let expandedLine = line.split('\n');
        if (expandedLine.length > 1) {
            // nested shape, we need to indent the last line and intent the middle lines by +1
            if (expandedLine[0] === '{' &&
                expandedLine[expandedLine.length - 1].startsWith('}')) {
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
function typeToString({ tsType }) {
    return [`${tsType};`];
}
