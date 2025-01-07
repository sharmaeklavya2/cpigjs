#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import yargs from 'yargs';

function templateFill(template, context, openDelim, closeDelim) {
    const n = template.length;
    let insideVar = false;
    let i = 0;
    const parts = [];
    while(i < n) {
        if(insideVar) {
            const j = template.indexOf(closeDelim, i);
            if(j === -1) {
                throw new Error("can't find end of context variable.");
            }
            const contextVarName = template.slice(i, j);
            const contextVarValue = context[contextVarName];
            if(contextVarValue === undefined) {
                throw new Error(`variable ${contextVarName} is absent from context.`)
            }
            parts.push(contextVarValue);
            insideVar = false;
            i = j + 2;
        }
        else {
            const j = template.indexOf(openDelim, i);
            if(j === -1) {
                parts.push(template.slice(i));
                i = n;
            }
            else {
                parts.push(template.slice(i, j));
                insideVar = true;
                i = j + 2;
            }
        }
    }
    return parts;
}

async function main() {
    const args = yargs(process.argv.slice(2))
        .option('template', {alias: 't', type: 'string', demandOption: true,
            describe: "path to template file"})
        .option('context', {alias: 'c', type: 'string', demandOption: true,
            describe: "path to JSON context file"})
        .option('output', {alias: 'o', type: 'string', demandOption: true,
            describe: "path to output file"})
        .help()
        .parse();

    // console.log(args);
    const encUtf8 = {encoding: 'utf8'};
    const contextPromise = readFile(args.context, encUtf8).then(JSON.parse);
    const templatePromise = readFile(args.template, encUtf8);
    const context = await contextPromise;
    const template = await templatePromise;

    const parts = templateFill(template, context, '{{', '}}');
    const output = parts.join('');

    await writeFile(args.output, parts.join(''));
}

await main();
