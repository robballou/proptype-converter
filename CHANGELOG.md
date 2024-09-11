# Change Log

All notable changes to the "vscode-pt-converter" extension will be documented in this file.

## [v1.10.0]

- Add support for PropTypes with JSDocs. These will now be included when generating the TypeScript types.

## [v1.9.0]

- Add support for finding unknown props that appear only in a component's function arguments. There are times where components will
  have props specified and used in their arguments that were not properly setup in the `propTypes`. You can now optionally include
	those when processing files via the new `includeUnknownFunctionArgumentProps` option. These show up in the props information.
- Some refactoring and code documentation.

## [v1.8.0]

- Fix some indent issues
- Add support for `instanceOf` PropTypes.

## [v1.7.0]

- `createPropsForComponent` now works without default props. Note that it will not create a default value for non-required props so
  that will still need to be applied separately.

## [v1.6.1]

- Add support for function expressions/arrow functions

## [v1.5.0]

- Add support for parsing `defaultProps` and creating a props parameter
- CLI now has options for `--noTypes` (`-t`) (do not generate type information), `--props` (`-p`) (generate prop information)
