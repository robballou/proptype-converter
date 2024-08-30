# Change Log

All notable changes to the "vscode-pt-converter" extension will be documented in this file.

## [v1.7.0]

- `createPropsForComponent` now works without default props. Note that it will not create a default value for non-required props so
  that will still need to be applied separately.

## [v1.6.1]

- Add support for function expressions/arrow functions

## [v1.5.0]

- Add support for parsing `defaultProps` and creating a props parameter
- CLI now has options for `--noTypes` (`-t`) (do not generate type information), `--props` (`-p`) (generate prop information)
