# PropType Converter

A rudimentary PropType-to-TypeScript-Type-Converter that is meant to create a starting point for converting PropTypes to TypeScript Types.

## Usage

Now available on NPM:

```shell
npm install proptype-converter
```

Or manually:

```shell
# use correct node version...
nvm use

# install dependencies
npm clean-install

# run it!
node build/cli.js [path/to/file] [...]
```

The resulting TypeScript type will be outputted to `stdout`.

## Example

```JavaScript
import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ className }) {
	return <div className={className}></div>;
}

MyComponent.propTypes = {
	className: PropTypes.string.isRequired,
	something: PropTypes.bool,
	children: PropTypes.node,
};
```

Will be converted to:

```TypeScript
type MyComponentProps = {
	className: string;
	something?: boolean;
	children?: React.ReactNode;
}
```

If a PropType is too complicated or "not supported" by the script, it will add that property as `unknown`:

```TypeScript
type MyComponentProps = {
	custom: unknown; // Could not process this property
}
```

## Use as a module

This code comes with a CLI tool, but it can also be used as a dependency in other applications:

```TypeScript
import { processSourceFile } from 'proptype-converter';
import * as ts from 'typescript';

const sourceFile = ts.createSourceFile(...)
const result = processSourceFile(sourceFile);
```

## Developing

```Shell
# build changes
npm run build

# run tests
npm run test

# run prettier (without making changes)
npm run prettier

# run prettier (with changes)
npm run prettier:fix
```
