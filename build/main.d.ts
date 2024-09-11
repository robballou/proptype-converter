import * as ts from 'typescript';
/** Tuple that indicates place within a source file/string */
type Position = [number, number];
export type ComponentPropTypes = {
    /** Properties that were parsed and have a TypeScript type */
    mappedProperties: Map<string, PropertyDetail>;
    /** Properties that were not parsed and we don't know what they are... */
    notMappedProperties: Map<string, string>;
    /** Position of the entire `propTypes` definition */
    range: Position;
    /** Position of the entire React component, if found */
    componentRange: Position | null;
    /** Position of the arguments for the React component, if found */
    parameterRange: Position | null;
    /** The defined `defaultProps` for this component if any */
    defaultProps: Map<string, string | null> | null;
    /** The position of the `defaultProps` definition in the file */
    defaultPropsRange: Position | null;
};
type ProcessSourceFileOptions = {
    /** Include the JSDoc comment position when figuring out function component position */
    includeJSDocCommentInComponentPosition: boolean;
    /**
     * When creating props for a React Component, include ones found in the function's arguments
     * that are not in the `propTypes` or `defaultProps`.
     */
    includeUnknownFunctionArgumentProps: boolean;
};
/**
 * Given a source file, process it to find PropTypes and components.
 *
 * This function returns a `Map` of components with their matching component PropType
 * details.
 */
export declare function processSourceFile(sourceFile: ts.SourceFile, options?: Partial<ProcessSourceFileOptions>): Map<string, ComponentPropTypes>;
type PropertyDetail = {
    tsType: string | null;
    comment: string | null;
    required: boolean;
};
export declare function createTypeForComponent(name: string, component: ComponentPropTypes): string;
/** Create a props based on mapped types and default props (if available) */
export declare function createPropsForComponent(component: ComponentPropTypes): string | null;
export declare function createTypesForComponents(components: Awaited<ReturnType<typeof processSourceFile>>): string[];
export {};
