"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_util_1 = require("node:util");
const main_1 = require("./main");
const file_1 = require("./file");
function isFulfilled(p) {
    return p.status === 'fulfilled';
}
function isRejected(p) {
    return p.status === 'rejected';
}
async function main(args) {
    const { values, positionals: positionalArguments } = (0, node_util_1.parseArgs)({
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
    const promises = [];
    positionalArguments.forEach((fileName) => {
        promises.push((0, file_1.processFile)(fileName));
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
        (0, main_1.createTypesForComponents)(fileResults).forEach((typeResult) => console.log(typeResult));
    });
    process.exit(status);
}
function usage() {
    console.log(`Usage: ${__filename} [...files[]]`);
}
main(process.argv.slice(2));
