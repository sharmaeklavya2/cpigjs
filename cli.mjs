#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { SetFamily } from "./cpigjs/setFamily.mjs";
import { filterByConstraint } from "./cpigjs/main.mjs";
import { Graph } from "./cpigjs/graph.mjs";
import yargs from 'yargs';

async function main() {
    const args = yargs(process.argv.slice(2))
        .option('sf', {type: 'string', demandOption: true,
            describe: "path to JSON file specifying the set family"})
        .option('input', {alias: 'i', type: 'string', array: true, demandOption: true,
            describe: "path to JSON file containing predicates and implications"})
        .option('constraint', {alias: 'c', type: 'string', demandOption: true,
            describe: "constraint as a JSON"})
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

    const procInput = filterByConstraint(inputs, constraint, sf);
    // console.log('implications:', filteredInput.implications);
    const newEdges = procInput.impG.getTransitiveClosure();
    for(const edge of newEdges) {
        console.log(edge.from, '==>', edge.to);
    }
}

await main();
