import * as ts from 'typescript';
type ComponentPropTypes = {
    mappedProperties: Map<string, {
        tsType: string;
        required: boolean;
    }>;
    notMappedProperties: Map<string, string>;
    range: [number, number];
    componentRange: [number, number] | null;
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
export declare function createTypesForComponents(components: Awaited<ReturnType<typeof processSourceFile>>): string[];
export {};
