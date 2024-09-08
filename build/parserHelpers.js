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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExpressionWithName = isExpressionWithName;
exports.isCallExpressionWithPropertyAccess = isCallExpressionWithPropertyAccess;
exports.isArrowFunction = isArrowFunction;
const ts = __importStar(require("typescript"));
/** Predicate function to determine if a node like `MyComponent.propTypes` exists */
function isExpressionWithName(node, name) {
    return (ts.isExpressionStatement(node) &&
        ts.isBinaryExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.left) &&
        node.expression.left.name.getText() === name);
}
/** Predicate function to determine if a node is a call expression with property access */
function isCallExpressionWithPropertyAccess(node) {
    return (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression));
}
function isArrowFunction(node) {
    return Boolean(ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isArrowFunction(node.initializer));
}
