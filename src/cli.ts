import { parseArgs } from 'util';
import { createTypes, processFile } from './main';

function isFulfilled<T>(
	p: PromiseSettledResult<T>,
): p is PromiseFulfilledResult<T> {
	return p.status === 'fulfilled';
}

async function main(args: string[]) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			help: {
				type: 'boolean',
				short: 'h',
			},
		},
		allowPositionals: true,
	});

	if (values.help || positionals.length === 0) {
		usage();
		return;
	}

	const promises: Promise<Awaited<ReturnType<typeof processFile>>>[] = [];
	positionals.forEach((fileName) => {
		promises.push(processFile(fileName));
	});

	const results = await Promise.allSettled(promises);
	const fulfilledFiles = results
		.filter(isFulfilled)
		.map((result) => result.value);

	fulfilledFiles.forEach((fileResults) => {
		createTypes(fileResults);
	});
}

function usage() {
	console.log(`Usage: ${__filename} [...files[]]`);
}

main(process.argv.slice(2));
