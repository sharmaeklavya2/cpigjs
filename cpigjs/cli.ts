import { MultiMap } from "./multiMap.js";
import { CpigInput, ProcessedCpigInput, FilteredCpigInput, Implication, PredCond, CounterExample } from "./main.js";

export interface Ostream {
    log: (...args: any[]) => undefined;
    error: (...args: any[]) => undefined;
}

export function outputPath(input: FilteredCpigInput, u: string, v: string, stdout: Ostream): void {
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

export function outputAttrReasons(input: FilteredCpigInput, predNames: string[], stdout: Ostream) {
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
