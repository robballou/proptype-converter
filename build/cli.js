"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const main_1 = require("./main");
function isFulfilled(p) {
    return p.status === 'fulfilled';
}
async function main(args) {
    const { values, positionals } = (0, util_1.parseArgs)({
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
    const promises = [];
    positionals.forEach((fileName) => {
        promises.push((0, main_1.processFile)(fileName));
    });
    const results = await Promise.allSettled(promises);
    const fulfilledFiles = results
        .filter(isFulfilled)
        .map((result) => result.value);
    fulfilledFiles.forEach((fileResults) => {
        (0, main_1.createTypes)(fileResults).forEach((typeResult) => console.log(typeResult));
    });
}
function usage() {
    console.log(`Usage: ${__filename} [...files[]]`);
}
main(process.argv.slice(2));
