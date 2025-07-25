#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import child_process from 'node:child_process';
import { SetFamily } from "../cpigjs/setFamily.js";
import { combineInputs, processInput, filterInput, serializeGraph } from "../cpigjs/main.js";
import { outputPath, outputAttrReasons } from "../cpigjs/cli.js";
import { Graph } from "../cpigjs/graph.js";
import yargs from 'yargs';

async function readAndProcessInput(args) {
    const encUtf8 = { encoding: 'utf8' };
    const sfPromise = readFile(args.sf, encUtf8)
        .then(contents => SetFamily.fromJson(JSON.parse(contents)));
    const inputsPromise = Promise.all(args.input.map(
        inputPath => readFile(inputPath, encUtf8).then(JSON.parse)));
    const sf = await sfPromise;
    const inputs = await inputsPromise;

    const input = combineInputs(inputs);
    const procInput = processInput(input, sf, []);
    if(procInput.insaneCExs.length > 0) {
        console.warn('contradictory counterexamples found!');
    }
    return [sf, procInput];
}

function getExt(fname) {
    // from https://stackoverflow.com/a/12900504
    return fname.slice((fname.lastIndexOf(".") - 1 >>> 0) + 2);
}

async function outputToFile(fname, drawOptions, filteredInput, predNames) {
    const ext = getExt(fname);
    if(ext === 'dot' || ext === 'svg' || ext === 'pdf' || ext === 'png') {
        const lines = serializeGraph(filteredInput, predNames, drawOptions, 'dot');
        if(ext === 'dot') {
            await writeFile(fname, lines.join('\n'));
        }
        else {
            await writeFile(fname + '.dot', lines.join('\n'));
            child_process.spawn('dot', ['-T' + ext, fname + '.dot', '-o', fname]);
        }
    }
    else if(ext === 'txt') {
        const lines = serializeGraph(filteredInput, predNames, drawOptions, 'txt');
        await writeFile(fname, lines.join('\n'));
    }
    else {
        throw new Error('unknown output file type ' + ext);
    }
}

function singleBuilder(parser) {
    parser.option('constraint', {alias: 'c', type: 'string', demandOption: true,
            describe: "constraint as a JSON"})
        .option('output', {alias: 'o', type: 'string'})
}

async function main() {
    return await yargs(process.argv.slice(2))
        .option('sf', {type: 'string', demandOption: true,
            describe: "path to JSON file specifying the set family"})
        .option('input', {alias: 'i', type: 'string', array: true, demandOption: true,
            describe: "path to JSON file containing predicates and implications"})
        .option('pred', {type: 'string', array: true,
            describe: "predicates to consider (default: all)"})
        .option('hide_unknown', {boolean: true, describe: "hide speculative implications"})
        .option('l2r', {boolean: true, describe: "draw left to right"})
        .command(['single', '$0'], 'run a single query', singleBuilder, singleQuery)
        .help()
        .parse();
}

async function singleQuery(args) {
    // console.log(args);
    const [sf, procInput] = await readAndProcessInput(args);
    const constraint = JSON.parse(args.constraint);
    const filteredInput = filterInput(procInput, sf, constraint);

    const predNames = args.pred ?? []
    if(predNames.length === 2) {
        const [u, v] = args.pred;
        outputPath(filteredInput, u, v, console);
        console.log();
        outputPath(filteredInput, v, u, console);
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        outputAttrReasons(filteredInput, predNames, console);
    }
    const drawOptions = {showMaybeEdges: !(args.hide_unknown), drawL2R: args.l2r};
    if(args.output) {
        outputToFile(args.output, drawOptions, filteredInput, predNames);
    }
    else {
        console.log();
        const lines = serializeGraph(filteredInput, predNames, drawOptions, 'txt');
        console.log(lines.join('\n'));
    }
}

await main();
