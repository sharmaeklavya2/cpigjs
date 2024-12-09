#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import child_process from 'node:child_process';
import { SetFamily } from "./cpigjs/setFamily.js";
import { combineInputs, processInput, filterInput, serializeGraph } from "./cpigjs/main.js";
import { outputPath, outputAttrReasons } from "./cpigjs/cli.js";
import { Graph } from "./cpigjs/graph.js";
import yargs from 'yargs';

async function main() {
    const args = yargs(process.argv.slice(2))
        .option('sf', {type: 'string', demandOption: true,
            describe: "path to JSON file specifying the set family"})
        .option('input', {alias: 'i', type: 'string', array: true, demandOption: true,
            describe: "path to JSON file containing predicates and implications"})
        .option('constraint', {alias: 'c', type: 'string', demandOption: true,
            describe: "constraint as a JSON"})
        .option('pred', {type: 'string', array: true,
            describe: "predicates to consider (default: all)"})
        .option('output', {alias: 'o', type: 'string'})
        .option('maybe', {boolean: true, describe: "show speculative implications"})
        .help()
        .parse();

    // console.log(args);
    const encUtf8 = { encoding: 'utf8' };
    const sfPromise = readFile(args.sf, encUtf8)
        .then(contents => SetFamily.fromJson(JSON.parse(contents)));
    const inputsPromise = Promise.all(args.input.map(
        inputPath => readFile(inputPath, encUtf8).then(JSON.parse)));
    const constraint = JSON.parse(args.constraint);
    const sf = await sfPromise;
    const inputs = await inputsPromise;

    const input = combineInputs(inputs);
    const procInput = processInput(input, sf);
    const filteredInput = filterInput(procInput, sf, constraint);

    const predNames = args.pred || []
    if(predNames.length === 2) {
        const [u, v] = args.pred;
        outputPath(filteredInput, u, v, console);
        console.log();
        outputPath(filteredInput, v, u, console);
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        outputAttrReasons(filteredInput, predNames, console);
    }
    console.log();
    if(args.output) {
        const ext = getExt(args.output);
        if(ext === 'dot' || ext === 'svg' || ext === 'pdf') {
            const lines = serializeGraph(filteredInput, predNames, args.maybe, 'dot');
            if(ext === 'dot') {
                await writeFile(args.output, lines.join('\n'));
            }
            else {
                await writeFile(args.output + '.dot', lines.join('\n'));
                child_process.spawn('dot', ['-T' + ext, args.output + '.dot', '-o', args.output]);
            }
        }
        else if(ext === 'txt') {
            const lines = serializeGraph(filteredInput, predNames, args.maybe, 'txt');
            await writeFile(args.output, lines.join('\n'));
        }
        else {
            throw new Error('unknown output file type ' + ext);
        }
    }
    else {
        const lines = serializeGraph(filteredInput, predNames, args.maybe, 'txt');
        console.log(lines.join('\n'));
    }
}

function getExt(fname) {
    // from https://stackoverflow.com/a/12900504
    return fname.slice((fname.lastIndexOf(".") - 1 >>> 0) + 2);
}

await main();
