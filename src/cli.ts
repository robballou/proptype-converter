import { parseArgs } from 'node:util';
import { createPropsForComponent, createTypesForComponents } from './main';
import { processFile } from './file';
import createDebugger from 'debug';

const debug = createDebugger('proptype-converter:cli');

function isFulfilled<T>(
	p: PromiseSettledResult<T>,
): p is PromiseFulfilledResult<T> {
	return p.status === 'fulfilled';
}

function isRejected<T>(p: PromiseSettledResult<T>): p is PromiseRejectedResult {
	return p.status === 'rejected';
}

async function main(args: string[]) {
	const { values, positionals: positionalArguments } = parseArgs({
		args,
		options: {
			help: {
				type: 'boolean',
				short: 'h',
				default: false,
			},
			noTypes: {
				type: 'boolean',
				short: 't',
			},
			props: {
				type: 'boolean',
				short: 'p',
				default: false,
			},
		},
		allowPositionals: true,
	});

	if (values.help || positionalArguments.length === 0) {
		usage();
		return;
	}

	const promises: Promise<Awaited<ReturnType<typeof processFile>>>[] = [];
	positionalArguments.forEach((fileName) => {
		promises.push(processFile(fileName));
	});

	const results = await Promise.allSettled(promises);
	const fulfilledFiles = results
		.filter(isFulfilled)
		.map((result) => result.value);

	let status = 0;

	const failedFiles = results.filter(isRejected);
	if (failedFiles.length > 0) {
		status = 1;
		failedFiles.forEach((fileResult) => {
			console.error(fileResult.reason);
		});
	}

	fulfilledFiles.forEach((fileResults) => {
		if (!fileResults) {
			return;
		}
		debug('results for file', fileResults);

		if (!values.noTypes) {
			createTypesForComponents(fileResults).forEach((typeResult) =>
				console.log(typeResult),
			);
		}

		if (values.props) {
			fileResults.forEach((value, key) => {
				const propsValue = createPropsForComponent(value);
				if (propsValue) {
					console.log(`${propsValue}: ${key}Props`);
				}
			});
		}
	});

	process.exit(status);
}

function usage() {
	console.log(
		`Usage: ${__filename} [--version|-v] [--noTypes|-t] [--props|-p] [...files[]]`,
	);
	console.log(`\t--noTypes, -t\tDo not output type information`);
	console.log(`\t--version, -v\tOutput version`);
	console.log(`\t--props, -p\tInclude props information`);
}

main(process.argv.slice(2));
