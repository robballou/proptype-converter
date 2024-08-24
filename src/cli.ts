import { parseArgs } from 'node:util';
import { createTypesForComponents } from './main';
import { processFile } from './file';

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
		createTypesForComponents(fileResults).forEach((typeResult) =>
			console.log(typeResult),
		);
	});

	process.exit(status);
}

function usage() {
	console.log(`Usage: ${__filename} [...files[]]`);
}

main(process.argv.slice(2));
