#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import child_process from 'node:child_process';
import { SetFamily } from "./cpigjs/setFamily.js";
import { filterByConstraint, outputPath, getMaybeEdges, addMaybeEdgesToDot, componentStr, sccDagToStr } from "./cpigjs/main.js";
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

    const procInput = filterByConstraint(inputs, constraint, sf);

    if(args.pred.length === 2) {
        const [u, v] = args.pred;
        outputPath(procInput, u, v, console);
        console.log();
        outputPath(procInput, v, u, console);
        console.log();
    }
    const chosenPreds = args.pred.length > 0 ? args.pred : undefined;
    const {scc, dag} = procInput.impG.trCompression(chosenPreds);
    const maybeEdges = args.maybe ? getMaybeEdges(scc, procInput.impG, procInput.cExs) : [];
    if(args.output) {
        const ext = getExt(args.output);
        if(ext === 'dot' || ext === 'svg') {
            const redDag = dag.trRed();
            const dotLines = redDag.toDot(v => componentStr(scc.get(v), false));
            addMaybeEdgesToDot(dotLines, maybeEdges);
            const s = dotLines.join('\n');
            if(ext === 'dot') {
                await writeFile(args.output, s);
            }
            else {
                await writeFile(args.output + '.dot', s);
                child_process.spawn('dot', ['-Tsvg', args.output + '.dot', '-o', args.output]);
            }
        }
        else if(ext === 'txt') {
            const s = sccDagToStr(scc, dag, maybeEdges);
            await writeFile(args.output, s);
        }
        else {
            throw new Error('unknown output file type ' + ext);
        }
    }
    else {
        const s = sccDagToStr(scc, dag, maybeEdges);
        console.log(s);
    }
}

function getExt(fname) {
    // from https://stackoverflow.com/a/12900504
    return fname.slice((fname.lastIndexOf(".") - 1 >>> 0) + 2);
}

await main();
