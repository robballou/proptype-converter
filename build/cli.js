"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_util_1 = require("node:util");
const main_1 = require("./main");
const file_1 = require("./file");
const debug_1 = __importDefault(require("debug"));
const debug = (0, debug_1.default)('proptype-converter:cli');
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
        debug('results for file', fileResults);
        if (!values.noTypes) {
            (0, main_1.createTypesForComponents)(fileResults).forEach((typeResult) => console.log(typeResult));
        }
        if (values.props) {
            fileResults.forEach((value, key) => {
                const propsValue = (0, main_1.createPropsForComponent)(value);
                if (propsValue) {
                    console.log(`${propsValue}: ${key}Props`);
                }
            });
        }
    });
    process.exit(status);
}
function usage() {
    console.log(`Usage: ${__filename} [--version|-v] [--noTypes|-t] [--props|-p] [...files[]]`);
    console.log(`\t--noTypes, -t\tDo not output type information`);
    console.log(`\t--version, -v\tOutput version`);
    console.log(`\t--props, -p\tInclude props information`);
}
main(process.argv.slice(2));
