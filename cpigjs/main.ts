import { Edge, Graph } from "./graph.js";
import { Info, SetFamily } from "./setFamily.js";

interface Implication extends Edge<string> {
    under: any;
}

interface CounterExample {
    satisfies: string;
    butNot: string;
    under: any;
}

export interface CpigInput {
    predicates?: Info[];
    implications?: Implication[];
    counterExamples?: CounterExample[];
}

interface ProcessedCpigInput {
    preds: Map<string, Info>;
    impG: Graph<string, Implication>;
    cExs: CounterExample[];
}

export interface Ostream {
    log: (...args: any[]) => undefined;
    error: (...args: any[]) => undefined;
}

export function combineInputs(inputs: CpigInput[]): CpigInput {
    const preds = [], imps = [], cExs = [];
    for(const input of inputs) {
        preds.push(...(input.predicates || []));
        imps.push(...(input.implications || []));
        cExs.push(...(input.counterExamples|| []));
    }
    return {'predicates': preds, 'implications': imps, 'counterExamples': cExs};
}

export function filterByConstraint(inputs: CpigInput[], constraint: unknown, sf: SetFamily): ProcessedCpigInput {
    const newConstr = sf.validateInput(constraint);
    const preds = new Map<string, Info>(), imps = [], cExs = [];
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
        for(const cEx of input.counterExamples || []) {
            for(const predName of [cEx.satisfies, cEx.butNot]) {
                if (!preds.has(predName)) {
                    throw new Error(`unrecognized predicate ${predName} in counter-example ${cEx}`);
                }
            }
            if (sf.contains(newConstr, cEx.under)) {
                cExs.push(cEx);
            }
        }
    }
    return {preds: preds, impG: Graph.fromVE(preds.keys(), imps), cExs: cExs};
}

export function getMaybeEdges(scc: Map<string, string[]>, impG: Graph<string, Implication>,
        cExs: CounterExample[]): Edge<string>[] {
    const maybeEdges = [];
    for(const u of scc.keys()) {
        for(const v of scc.keys()) {
            if(!impG.hasPath(u, v)) {
                for(const cEx of cExs) {
                    const uc = cEx.satisfies, vc = cEx.butNot;
                    if(!(impG.hasPath(uc, u) && impG.hasPath(v, vc))) {
                        maybeEdges.push({'from': u, 'to': v});
                    }
                }
            }
        }
    }
    return maybeEdges;
}

export function addMaybeEdgesToDot(dotLines: string[], maybeEdges: Edge<string>[]) {
    dotLines.pop();
    for(const e of maybeEdges) {
        dotLines.push(`"${e.from}" -> "${e.to}" [style=dashed, constraint=false];`);
    }
    dotLines.push('}');
}

export function outputPath(input: ProcessedCpigInput, u: string, v: string, stdout: Ostream): undefined {
    const impG = input.impG, cExs = input.cExs;
    const path = impG.getPath(u, v);
    if(path === undefined) {
        stdout.log(`no path from ${u} to ${v}`);
    }
    else {
        stdout.log(`path of length ${path.length} from ${u} to ${v}`);
        for(const [i, e] of path.entries()) {
            stdout.log((i+1) + ':', JSON.stringify(e));
        }
    }

    for(const cEx of cExs) {
        const uc = cEx.satisfies, vc = cEx.butNot;
        if(impG.hasPath(uc, u) && impG.hasPath(v, vc)) {
            stdout.log('counterexample:', JSON.stringify(cEx));
        }
    }
}

export function componentStr(S: string[], parens: boolean) {
    const begDelim = parens ? '( ' : '';
    const endDelim = parens ? ' )' : '';
    return S.length === 1 ? S[0] : begDelim + S.join(' = ') + endDelim;
}

export function sccDagToStr(scc: Map<string, string[]>, dag: Graph<string, Edge<string>>, maybeEdges: Edge<string>[]) {
    const lines = [];
    for(const edge of dag.edges) {
        const uS = scc.get(edge.from)!, vS = scc.get(edge.to)!;
        lines.push(componentStr(uS, true) + ' ==> ' + componentStr(vS, true));
    }
    if(maybeEdges.length > 0) {
        lines.push('');
        lines.push('speculative implications:')
        for(const edge of maybeEdges) {
            const uS = scc.get(edge.from)!, vS = scc.get(edge.to)!;
            lines.push(componentStr(uS, true) + ' ==> ' + componentStr(vS, true));
        }
    }
    return lines.join('\n');
}
