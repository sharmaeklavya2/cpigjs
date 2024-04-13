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

interface PredAttr {
    name: string;
    under: any;
}

export interface CpigInput {
    predicates?: Info[];
    implications?: Implication[];
    counterExamples?: CounterExample[];
    goodPredicates?: PredAttr[];
    badPredicates?: PredAttr[];
    goodnessName?: string;
    badnessName?: string;
}

interface ProcessedCpigInput {
    preds: Map<string, Info>;
    impG: Graph<string, Implication>;
    cExs: CounterExample[];
    goodPreds: Map<string, PredAttr[]>;
    badPreds: Map<string, PredAttr[]>;
    goodnessName: string;
    badnessName: string;
}

export interface Ostream {
    log: (...args: any[]) => undefined;
    error: (...args: any[]) => undefined;
}

export function combineInputs(inputs: CpigInput[]): CpigInput {
    const preds = [], imps = [], cExs = [], goodPreds = [], badPreds = [];
    let goodnessName, badnessName;
    for(const input of inputs) {
        preds.push(...(input.predicates || []));
        imps.push(...(input.implications || []));
        cExs.push(...(input.counterExamples|| []));
        goodPreds.push(...(input.goodPredicates || []));
        badPreds.push(...(input.badPredicates || []));
        goodnessName = input.goodnessName;
        badnessName = input.badnessName;
    }
    return {'predicates': preds, 'implications': imps, 'counterExamples': cExs,
        'goodPredicates': goodPreds, 'badPredicates': badPreds,
        'goodnessName': goodnessName, 'badnessName': badnessName};
}

export function filterByConstraint(inputs: CpigInput[], constraint: unknown, sf: SetFamily): ProcessedCpigInput {
    const newConstr = sf.validateInput(constraint);
    const preds = new Map<string, Info>(), imps = [], cExs = [];
    const origGoodPreds = [], origBadPreds = [];
    let goodnessName, badnessName;
    for(const input of inputs) {
        goodnessName = input.goodnessName;
        badnessName = input.badnessName;
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
        for(const predAttr of input.goodPredicates || []) {
            if(!preds.has(predAttr.name)) {
                throw new Error(`unrecognized predicate ${predAttr.name} in goodPredicates: ${predAttr}`);
            }
            if(sf.contains(predAttr.under, newConstr)) {
                origGoodPreds.push(predAttr);
            }
        }
        for(const predAttr of input.badPredicates || []) {
            if(!preds.has(predAttr.name)) {
                throw new Error(`unrecognized predicate ${predAttr.name} in badPredicates: ${predAttr}`);
            }
            if(sf.contains(newConstr, predAttr.under)) {
                origBadPreds.push(predAttr);
            }
        }
    }
    const impG = Graph.fromVE(preds.keys(), imps);
    const goodPreds = new Map<string, PredAttr[]>(), badPreds = new Map<string, PredAttr[]>();
    for(const v of preds.keys()) {
        const vAttrs: PredAttr[] = [];
        for(const predAttr of origGoodPreds) {
            const u = predAttr.name;
            if(impG.hasPath(u, v)) {
                vAttrs.push(predAttr);
            }
        }
        if(vAttrs.length > 0) {
            goodPreds.set(v, vAttrs);
        }
    }
    for(const u of preds.keys()) {
        const uAttrs: PredAttr[] = [];
        for(const predAttr of origBadPreds) {
            const v = predAttr.name;
            if(impG.hasPath(u, v)) {
                uAttrs.push(predAttr);
            }
        }
        if(uAttrs.length > 0) {
            badPreds.set(u, uAttrs);
        }
    }
    return {preds: preds, impG: impG, cExs: cExs, goodPreds: goodPreds, badPreds: badPreds,
        goodnessName: goodnessName || 'good', badnessName: badnessName || 'bad'};
}

function getMaybeEdges(scc: Map<string, string[]>, impG: Graph<string, Implication>,
        cExs: CounterExample[]): Edge<string>[] {
    const maybeEdges = [];
    for(const u of scc.keys()) {
        for(const v of scc.keys()) {
            if(!impG.hasPath(u, v)) {
                let isMaybeEdge = true;
                for(const cEx of cExs) {
                    const uc = cEx.satisfies, vc = cEx.butNot;
                    if(impG.hasPath(uc, u) && impG.hasPath(v, vc)) {
                        isMaybeEdge = false;
                    }
                }
                if(isMaybeEdge) {
                    maybeEdges.push({'from': u, 'to': v});
                }
            }
        }
    }
    return maybeEdges;
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

export function outputGoodBadReasons(input: ProcessedCpigInput, predNames: string[], stdout: Ostream) {
    const mainList: [string, Map<string, PredAttr[]>][] =
            [[input.goodnessName, input.goodPreds], [input.badnessName, input.badPreds]];
    for(const [attrName, attrReasonsMap] of mainList) {
        for(const predName of predNames) {
            const reasons = attrReasonsMap.get(predName);
            if(reasons !== undefined) {
                stdout.log('');
                stdout.log(`${predName} is ${attrName}:`);
                for(const [i, reason] of reasons.entries()) {
                    stdout.log(`${i+1}: ${JSON.stringify(reason)}`);
                }
            }
        }
    }
}

function componentStr(S: string[], parens: boolean) {
    const begDelim = parens ? '( ' : '';
    const endDelim = parens ? ' )' : '';
    return S.length === 1 ? S[0] : begDelim + S.join(' = ') + endDelim;
}

function sccDagToStr(scc: Map<string, string[]>, dag: Graph<string, Edge<string>>, maybeEdges: Edge<string>[]): string[] {
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
    return lines;
}

function toDotAttrs(d: object): string {
    const parts = [];
    for(const [k, v] of Object.entries(d)) {
        parts.push(`${k}="${v}"`);
    }
    if(parts.length > 0) {
        return ' [' + parts.join(',') + ']';
    }
    else {
        return '';
    }
}

export function serializeGraph(input: ProcessedCpigInput, predNames: string[], showMaybeEdges: boolean,
        format: string): string[] {
    if(format === 'txt') {
        const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
        const redDag = dag.trRed();
        const maybeEdges = showMaybeEdges ? getMaybeEdges(scc, input.impG, input.cExs) : [];
        return sccDagToStr(scc, dag, maybeEdges);
    }
    else if(format === 'dot') {
        return getDotGraph(input, predNames, showMaybeEdges);
    }
    else {
        throw new Error('unknown format ' + format);
    }
}

export function getDotGraph(input: ProcessedCpigInput, predNames: string[], showMaybeEdges: boolean): string[] {
    const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
    const redDag = dag.trRed();
    const lines = ['digraph G {', 'rankdir=LR;', 'edge [arrowhead=vee];'];
    for(const u of redDag.adj.keys()) {
        const uAttrs: any = {'label': componentStr(scc.get(u)!, false)};
        if(input.goodPreds.has(u)) {
            uAttrs['fontcolor'] = 'green';
            if(input.badPreds.has(u)) {
                uAttrs.color = 'red';
            }
            else {
                uAttrs.color = 'green';
            }
        }
        else if(input.badPreds.has(u)) {
            uAttrs.fontcolor = 'red';
            uAttrs.color = 'red';
        }
        lines.push(`"${u}"${toDotAttrs(uAttrs)};`);
    }
    if(showMaybeEdges) {
        const maybeEdges = getMaybeEdges(scc, input.impG, input.cExs);
        for(const e of maybeEdges) {
            const eAttrs = {'style': 'dashed', 'constraint': 'false', 'color': 'gray', 'penwidth': '0.6'};
            lines.push(`"${e.from}" -> "${e.to}"${toDotAttrs(eAttrs)};`);
        }
    }
    for(const u of redDag.adj.keys()) {
        for(const e of redDag.adj.get(u)!) {
            const eAttrs = {};
            lines.push(`"${u}" -> "${e.to}"${toDotAttrs(eAttrs)};`);
        }
    }
    lines.push('}');
    return lines;
}
