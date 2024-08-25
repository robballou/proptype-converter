import * as ts from 'typescript';
export type ComponentPropTypes = {
    mappedProperties: Map<string, {
        tsType: string;
        required: boolean;
    }>;
    notMappedProperties: Map<string, string>;
    range: [number, number];
    componentRange: [number, number] | null;
    parameterRange: [number, number] | null;
    defaultProps: Map<string, string> | null;
};
type ProcessSourceFileOptions = {
    includeJSDocCommentInComponentPosition: boolean;
};
/**
 * Given a source file, process it to find PropTypes and components.
 *
 * This function returns a `Map` of components with their matching component PropType
 * details.
 */
export declare function processSourceFile(sourceFile: ts.SourceFile, options?: Partial<ProcessSourceFileOptions>): Map<string, ComponentPropTypes>;
export declare function createTypeForComponent(name: string, component: ComponentPropTypes): string;
/** Create a props based on mapped types and default props */
export declare function createPropsForComponent(component: ComponentPropTypes): string | null;
export declare function createTypesForComponents(components: Awaited<ReturnType<typeof processSourceFile>>): string[];
export {};
