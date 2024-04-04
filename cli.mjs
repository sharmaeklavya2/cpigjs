import { readFile } from 'node:fs/promises';
import { SetFamily } from "./cpigjs/setFamily.mjs";
import { filterByConstraint } from "./cpigjs/main.mjs";
import { Graph } from "./cpigjs/graph.mjs";

function parseArgv() {
    const shortMsg = 'usage: node cli.js <setFamily> <input> <constraint>';
    const longMsg = ('\tsetFamily: path to JSON file describing the set family.\n'
        + '\tinput: path to JSON file describing predicates and implications.\n'
        + '\tconstraint: constraint as a JSON.');
    if(process.argv.length === 3) {
        const x = process.argv[2];
        if(x === '--help' || x === '-h') {
            console.log(shortMsg);
            console.log(longMsg);
            process.exit(0);
        }
        else {
            console.log(shortMsg);
            process.exit(2);
        }
    }
    else if(process.argv.length !== 5) {
        console.log(shortMsg);
        process.exit(2);
    }
    else {
        return [process.argv[2], process.argv[3], process.argv[4]];
    }
}

try {
    const args = parseArgv();
    const sfContents = await readFile(args[0], { encoding: 'utf8' });
    const sf = SetFamily.fromJson(JSON.parse(sfContents));
    const inputContents = await readFile(args[1], { encoding: 'utf8' });
    const input = JSON.parse(inputContents);
    const constraint = JSON.parse(args[2]);

    const filteredInput = filterByConstraint(input, constraint, sf);
    // console.log('implications:', filteredInput.implications);
    const graph = new Graph(filteredInput.implications);
    const newEdges = graph.getTransitiveClosure();
    for(const edge of newEdges) {
        console.log(edge.from, '==>', edge.to);
    }
} catch (err) {
    console.error(err.message);
}
