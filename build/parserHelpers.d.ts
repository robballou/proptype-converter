import * as ts from 'typescript';
interface BinaryExpressionWithPropertyAccessExpression extends ts.BinaryExpression {
    left: ts.PropertyAccessExpression;
}
interface ExpressionStatementWithBinaryPropertyAccessExpression extends ts.ExpressionStatement {
    expression: BinaryExpressionWithPropertyAccessExpression;
}
/** Predicate function to determine if a node like `MyComponent.propTypes` exists */
export declare function isExpressionWithName(node: ts.Node, name: string): node is ExpressionStatementWithBinaryPropertyAccessExpression;
interface CallExpressionWithPropertyAccessExpression extends ts.CallExpression {
    expression: ts.PropertyAccessExpression;
}
/** Predicate function to determine if a node is a call expression with property access */
export declare function isCallExpressionWithPropertyAccess(node: ts.Node): node is CallExpressionWithPropertyAccessExpression;
export interface ArrowFunctionDeclaration extends ts.VariableDeclaration {
    initializer: ts.ArrowFunction;
}
export declare function isArrowFunction(node: ts.Node): node is ArrowFunctionDeclaration;
export {};
