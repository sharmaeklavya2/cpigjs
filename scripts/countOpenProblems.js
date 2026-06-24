#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { main as tsMain } from "../code/countMaybeCli.js";
import yargs from 'yargs';

const encUtf8 = {encoding: 'utf8'};

const CLI_ENV = {
    'readFile': function(path) {return readFile(path, encUtf8);},
    'writeFile': writeFile,
};

function main() {
    const args = yargs(process.argv.slice(2))
        .option('sf', {type: 'string', demandOption: true,
            describe: "path to JSON file specifying the set family"})
        .option('input', {alias: 'i', type: 'string', array: true, demandOption: true,
            describe: "path to JSON file containing predicates and implications"})
        .option('constraints', {alias: 'c', type: 'string', demandOption: true,
            describe: "path to JSON file containing list of constraints"})
        .option('output', {alias: 'o', type: 'string'})
        .option('pred', {type: 'string', array: true,
            describe: "predicates to consider (default: all)"})
        .help()
        .parse();
    return tsMain({sfPath: args.sf, inputPaths: args.input, constraintsPath: args.constraints,
        outputPath: args.output, predNames: args.pred}, CLI_ENV);
}

await main();
