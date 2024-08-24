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
export declare function processSourceFile(sourceFile: ts.SourceFile): Map<string, ComponentPropTypes>;
export declare function createTypeForComponent(name: string, component: ComponentPropTypes): string;
export declare function createTypesForComponents(components: Awaited<ReturnType<typeof processSourceFile>>): string[];
export {};
