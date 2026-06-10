import { SetFamily } from "./setFamily.js";
import { ProcessedCpigInput } from "./main.js";
import { countMaybeEdges, filterInput } from "./main.js";
import { readAndProcessInput, CliEnv } from "./cli.js";

function countMaybeAll(input: ProcessedCpigInput, sf: SetFamily, rawConstraints: readonly unknown[],
        predNames?: readonly string[]): [unknown, number][] {
    const output: [unknown, number][] = [];
    for(const rawConstraint of rawConstraints) {
        const fInput = filterInput(input, sf, rawConstraint, false);
        const nOpen = countMaybeEdges(fInput, predNames);
        output.push([rawConstraint, nOpen]);
    }
    output.sort(([_1, xOpen], [_2, yOpen]) => yOpen - xOpen);
    return output;
}

interface QueryInput {
    readonly sfPath: string;
    readonly inputPaths: readonly string[];
    readonly constraintsPath: string;
    readonly predNames?: readonly string[];
    readonly outputPath?: string;
};

function constrCountsToStr(constrCounts: readonly [unknown, number][]): string {
    const lines = [];
    lines.push('[');
    let i = 0;
    for(const [constraint, nOpen] of constrCounts) {
        ++i;
        const j = JSON.stringify([nOpen, constraint]);
        lines.push(i !== constrCounts.length ? j + ',' : j);
    }
    lines.push(']');
    return lines.join('\n');
}

export async function main(i: QueryInput, env: CliEnv): Promise<void> {
    const [[sf, procInput], constraints] = await Promise.all([
        readAndProcessInput(i.sfPath, i.inputPaths, env),
        env.readFile(i.constraintsPath).then(JSON.parse),
        ]);
    const constrCounts = countMaybeAll(procInput, sf, constraints, i.predNames);
    if(constrCounts.length === 0) {
        console.warn('Empty output.');
    }
    else {
        const [constraint, nOpen] = constrCounts[0];
        console.log('Setting with most open problems:', constraint);
        console.log('Open problems:', nOpen);
    }
    if(i.outputPath !== undefined) {
        env.writeFile(i.outputPath, constrCountsToStr(constrCounts));
    }
}
