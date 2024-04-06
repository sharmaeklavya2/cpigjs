import { Edge, Graph } from "./graph.js";
import { Info, SetFamily } from "./setFamily.js";

interface Implication extends Edge<string> {
    under: any;
}

interface CpigInput {
    predicates?: Info[];
    implications?: Implication[];
}

interface ProcessedCpigInput {
    preds: Map<string, Info>;
    impG: Graph<string, Implication>;
}

interface Ostream {
    log: (...args: any[]) => undefined;
    error: (...args: any[]) => undefined;
}

export function filterByConstraint(inputs: CpigInput[], constraint: unknown, sf: SetFamily): ProcessedCpigInput {
    const newConstr = sf.validateInput(constraint);
    const imps = [], preds = new Map<string, Info>();
    for(const input of inputs) {
        for(const pred of input.predicates || []) {
            if(preds.has(pred.name)) {
                throw new Error(`predicate ${pred.name} already exists.`);
            }
            else {
                preds.set(pred.name, pred);
            }
        }
        for(const imp of input.implications || []) {
            for(const predName of [imp.from, imp.to]) {
                if (!preds.has(predName)) {
                    throw new Error(`unrecognized predicate ${predName} in implication ${imp}`);
                }
            }
            if (sf.contains(imp.under, newConstr)) {
                imps.push(imp);
            }
        }
    }
    return {preds: preds, impG: Graph.fromVE(preds.keys(), imps)};
}

export function outputPath(impG: Graph<string, Implication>, u: string, v: string, stdout: Ostream): undefined {
    const path = impG.getPath(u, v);
    if(path === undefined) {
        stdout.log(`no path from ${u} to ${v}`);
    }
    else {
        stdout.log(`path of length ${path.length} from ${u} to ${v}`);
        for(const [i, e] of path.entries()) {
            stdout.log((i+1) + ':', e);
        }
    }
}
