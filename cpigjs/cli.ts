import { SetFamily } from "./setFamily.js";
import { FilteredCpigInput, ProcessedCpigInput } from "./main.js";
import { combineInputs, processInput, filterInput, serializeGraph } from "./main.js";

interface Ostream {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
}

function outputImplPathAndCexs(input: FilteredCpigInput, u: string, v: string, stdout: Ostream): void {
    // Output the implication path from u to v and the list of counterexamples for u notimplies v.
    if(!input.predsMap.has(u)) {
        throw new Error('unknown predicate ' + u);
    }
    if(!input.predsMap.has(v)) {
        throw new Error('unknown predicate ' + v);
    }
    const path = input.impG.getPath(u, v);
    if(path === undefined) {
        stdout.log(`no path from ${u} to ${v}`);
    }
    else {
        stdout.log(`path of length ${path.length} from ${u} to ${v}`);
        for(const [i, e] of path.entries()) {
            stdout.log((i+1) + ':', JSON.stringify(e));
        }
    }

    const ceList = input.cExsMap.getAll(JSON.stringify([u, v]));
    if(ceList.length > 0) {
        for(const ce of ceList) {
            stdout.log('counterexample:', JSON.stringify(ce));
        }
    }
}

function outputAttrReasons(input: FilteredCpigInput, predNames: readonly string[], stdout: Ostream): void {
    // Output reasons for attributes (e.g., feasible, infeasible) for each predicate.
    for(const [attrName, attrReasonsMap] of input.predAttrs.entries()) {
        for(const predName of predNames) {
            if(!input.predsMap.has(predName)) {
                throw new Error('unknown predicate ' + predName);
            }
            const reasons = attrReasonsMap.getAll(predName);
            if(reasons.length > 0) {
                stdout.log('');
                stdout.log(`${predName} is ${attrName}:`);
                for(const [i, reason] of reasons.entries()) {
                    stdout.log(`${i+1}: ${JSON.stringify(reason)}`);
                }
            }
        }
    }
}

function getExt(fname: string): string {
    // from https://stackoverflow.com/a/12900504
    return fname.slice((fname.lastIndexOf(".") - 1 >>> 0) + 2);
}

export interface CliEnv {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, contents: string) => Promise<void>;
    spawn?: (command: string, args?: readonly string[], onExit?: () => Promise<void>) => void;
    mkdirP?: (path: string) => Promise<void>;
    unlink?: (path: string) => Promise<void>;
}

export async function readAndProcessInput(sfPath: string, inputPaths: readonly string[], env: CliEnv):
        Promise<[SetFamily, ProcessedCpigInput]> {
    const sfPromise = env.readFile(sfPath)
        .then(contents => SetFamily.fromJson(JSON.parse(contents)));
    const inputsPromise = Promise.all(inputPaths.map(
        inputPath => env.readFile(inputPath).then(JSON.parse)));
    const sf = await sfPromise;
    const inputs = await inputsPromise;

    const input = combineInputs(inputs);
    const procInput = processInput(input, sf);
    if(procInput.insaneCExs.length > 0) {
        console.warn('contradictory counterexamples found!');
        for(const ce of procInput.insaneCExs) {
            console.log(JSON.stringify(ce));
        }
    }
    return [sf, procInput];
}

async function outputDotToFile(fname: string, fmt: string, lines: readonly string[], env: CliEnv): Promise<void> {
    if(fmt === 'dot' || fmt === 'svg' || fmt === 'pdf' || fmt === 'png') {
        if(fmt === 'dot') {
            await env.writeFile(fname, lines.join('\n'));
        }
        else if(env.spawn !== undefined) {
            await env.writeFile(fname + '.dot', lines.join('\n'));
            const onExit = env.unlink === undefined ? undefined : async () => {await env.unlink!(fname + '.dot');}
            env.spawn('dot', ['-T' + fmt, fname + '.dot', '-o', fname], onExit);
        }
        else {
            throw new Error(`output file type ${fmt} requires 'spawn' to be implemented`);
        }
    }
    else if(fmt === 'txt') {
        await env.writeFile(fname, lines.join('\n'));
    }
    else {
        throw new Error('unknown output file type ' + fmt);
    }
}

interface QueryInput {
    readonly sfPath: string;
    readonly inputPaths: readonly string[];
    readonly predNames?: readonly string[];
    readonly hideUnknown?: boolean;
    readonly l2r?: boolean;
};

export interface SingleQueryInput extends QueryInput {
    readonly constraintStr?: string;
    readonly outputPath?: string;
}

export interface BulkQueryInput extends QueryInput {
    readonly constraintsFile: string;
    readonly outDir: string;
    readonly fmt?: string;
}

function mapExt(ext: string): string {
    return ext === 'txt' ? 'txt' : 'dot';
}

export async function singleQuery(i: SingleQueryInput, env: CliEnv): Promise<void> {
    const [sf, procInput] = await readAndProcessInput(i.sfPath, i.inputPaths, env);
    const constraint = JSON.parse(i.constraintStr ?? '{}');
    const filteredInput = filterInput(procInput, sf, constraint);

    const predNames = i.predNames ?? [];
    if(predNames.length === 2) {
        const [u, v] = predNames;
        outputImplPathAndCexs(filteredInput, u, v, console);
        console.log();
        outputImplPathAndCexs(filteredInput, v, u, console);
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        outputAttrReasons(filteredInput, predNames, console);
    }
    const drawOptions = {showMaybeEdges: !(i.hideUnknown), drawL2R: Boolean(i.l2r)};
    if(i.outputPath) {
        const ext = getExt(i.outputPath);
        const lines = serializeGraph(filteredInput, predNames, drawOptions, mapExt(ext));
        outputDotToFile(i.outputPath, ext, lines, env);
    }
    else {
        console.log();
        const lines = serializeGraph(filteredInput, predNames, drawOptions, 'txt');
        console.log(lines.join('\n'));
    }
}

export async function bulkQuery(i: BulkQueryInput, env: CliEnv): Promise<void> {
    const constraintsPromise = env.readFile(i.constraintsFile).then(JSON.parse);
    const [sf, procInput] = await readAndProcessInput(i.sfPath, i.inputPaths, env);
    const constraints = await constraintsPromise;

    const predNames = i.predNames ?? [];
    const drawOptions = {showMaybeEdges: !(i.hideUnknown), drawL2R: Boolean(i.l2r)};

    if(env.mkdirP !== undefined) {
        await env.mkdirP(i.outDir);
    }
    const ext = i.fmt ?? 'pdf'
    const mappedExt = mapExt(ext);
    for(const constraint of constraints) {
        const filteredInput = filterInput(procInput, sf, constraint);
        const constraintStr = sf.serialize(sf.canonicalize(constraint));
        const fname = i.outDir + '/' + constraintStr + '.' + ext;
        const lines = serializeGraph(filteredInput, predNames, drawOptions, mappedExt);
        outputDotToFile(fname, ext, lines, env);
    }
}
