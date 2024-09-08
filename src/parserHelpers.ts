import * as ts from 'typescript';

interface BinaryExpressionWithPropertyAccessExpression
	extends ts.BinaryExpression {
	left: ts.PropertyAccessExpression;
}

interface ExpressionStatementWithBinaryPropertyAccessExpression
	extends ts.ExpressionStatement {
	expression: BinaryExpressionWithPropertyAccessExpression;
}

/** Predicate function to determine if a node like `MyComponent.propTypes` exists */
export function isExpressionWithName(
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

interface CallExpressionWithPropertyAccessExpression extends ts.CallExpression {
	expression: ts.PropertyAccessExpression;
}

/** Predicate function to determine if a node is a call expression with property access */
export function isCallExpressionWithPropertyAccess(
	node: ts.Node,
): node is CallExpressionWithPropertyAccessExpression {
	return (
		ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
	);
}

export interface ArrowFunctionDeclaration extends ts.VariableDeclaration {
	initializer: ts.ArrowFunction;
}

export function isArrowFunction(
	node: ts.Node,
): node is ArrowFunctionDeclaration {
	return Boolean(
		ts.isVariableDeclaration(node) &&
			node.initializer &&
			ts.isArrowFunction(node.initializer),
	);
}
