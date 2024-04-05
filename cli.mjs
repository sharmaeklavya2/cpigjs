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
        .option('from', {type: 'string', describe: "source predicate"})
        .option('to', {type: 'string', describe: "target predicate"})
        .implies('from', 'to')
        .implies('to', 'from')
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

    if(args.from) {
        const path = procInput.impG.getPath(args.from, args.to);
        if(path === undefined) {
            console.log(`no path from ${args.from} to ${args.to}`);
        }
        else {
            console.log(`path of length ${path.length}`);
            for(const [i, e] of path.entries()) {
                console.log((i+1) + ':', e);
            }
        }
    }
    else {
        const {scc, dag} = procInput.impG.trCompression();
        for(const edge of dag.edges) {
            const uS = scc.get(edge.from), vS = scc.get(edge.to);
            console.log(componentStr(uS), '==>', componentStr(vS));
        }
    }
}

function componentStr(S) {
    return S.length === 1 ? S[0] : '( ' + S.join(' = ') + ' )';
}

await main();
