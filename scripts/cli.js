#!/usr/bin/env node

import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import child_process from 'node:child_process';
import { singleQuery, bulkQuery } from "../cpigjs/cli.js";
import yargs from 'yargs';

const encUtf8 = {encoding: 'utf8'};
const recursiveTrue = {recursive: true};

const CLI_ENV = {
    'readFile': function(path) {
            return readFile(path, encUtf8);
        },
    'writeFile': writeFile,
    'spawn': function(command, args, onExit) {
            const child = child_process.spawn(command, args);
            if(onExit !== undefined) {
                child.on('exit', onExit);
            }
        },
    'mkdirP': function(path) {
            return mkdir(path, recursiveTrue);
        },
    'unlink': unlink,
};

function singleBuilder(parser) {
    parser.option('constraint', {alias: 'c', type: 'string', demandOption: true,
            describe: "constraint as a JSON"})
        .option('output', {alias: 'o', type: 'string'})
}

function getCommonArgs(args) {
    return {sfPath: args.sf, inputPaths: args.input,
        predNames: args.pred, hideUnknown: args.hideUnknown, l2r: args.l2r};
}

function singleQueryYargs(args) {
    return singleQuery(Object.assign(getCommonArgs(args),
        {constraintStr: args.constraint, outputPath: args.output}), CLI_ENV);
}

function bulkBuilder(parser) {
    parser.option('constraintsFile', {alias: 'c', type: 'string', demandOption: true,
            describe: "JSON file containing a list of constraints"})
        .option('outDir', {alias: 'o', type: 'string', demandOption: true,
            describe: "path to output directory"})
        .option('fmt', {type: 'string', 'default': 'pdf',
            choices: ['pdf', 'svg', 'png', 'dot', 'txt']})
}

function bulkQueryYargs(args) {
    return bulkQuery(Object.assign(getCommonArgs(args),
        {constraintsFile: args.constraintsFile, outDir: args.outDir, fmt: args.fmt}), CLI_ENV);
}

async function main() {
    await yargs(process.argv.slice(2))
        .option('sf', {type: 'string', demandOption: true,
            describe: "path to JSON file specifying the set family"})
        .option('input', {alias: 'i', type: 'string', array: true, demandOption: true,
            describe: "path to JSON file containing predicates and implications"})
        .option('pred', {type: 'string', array: true,
            describe: "predicates to consider (default: all)"})
        .option('hideUnknown', {boolean: true, describe: "hide speculative implications"})
        .option('l2r', {boolean: true, describe: "draw left to right"})
        .command(['single', '$0'], 'run a single query', singleBuilder, singleQueryYargs)
        .command('bulk', 'run multiple queries', bulkBuilder, bulkQueryYargs)
        .help()
        .parse();
}

await main();
