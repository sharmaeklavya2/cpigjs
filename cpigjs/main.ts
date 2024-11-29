import { MultiMap } from "./multiMap.js";
import { Edge, Graph } from "./graph.js";
import { Info, SetFamily } from "./setFamily.js";

//=[ Read and validate input ]==================================================

export interface Implication extends Edge<string> {
    under: any;
}

export interface CounterExample {
    satisfies: string;
    butNot: string;
    under: any;
}

export interface PredAttr {
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

export function combineInputs(inputs: CpigInput[]): CpigInput {
    const preds = [], imps = [], cExs = [], goodPreds = [], badPreds = [];
    let goodnessName, badnessName;
    for(const input of inputs) {
        preds.push(...(input.predicates || []));
        imps.push(...(input.implications || []));
        cExs.push(...(input.counterExamples|| []));
        goodPreds.push(...(input.goodPredicates || []));
        badPreds.push(...(input.badPredicates || []));
        if(input.goodnessName) {
            goodnessName = input.goodnessName;
        }
        if(input.badnessName) {
            badnessName = input.badnessName;
        }
    }
    return {'predicates': preds, 'implications': imps, 'counterExamples': cExs,
        'goodPredicates': goodPreds, 'badPredicates': badPreds,
        'goodnessName': goodnessName, 'badnessName': badnessName};
}

function validateInput(input: CpigInput, sf: SetFamily): Map<string, Info> {
    const predsMap = new Map<string, Info>();
    for(const pred of input.predicates || []) {
        if(predsMap.has(pred.name)) {
            throw new Error(`predicate ${pred.name} already exists.`);
        }
        else {
            predsMap.set(pred.name, pred);
        }
    }
    for(const imp of input.implications || []) {
        for(const predName of [imp.from, imp.to]) {
            if (!predsMap.has(predName)) {
                throw new Error(`unrecognized predicate ${predName} in implication ${imp}`);
            }
        }
        imp.under = sf.canonicalize(imp.under);
    }
    for(const cEx of input.counterExamples || []) {
        for(const predName of [cEx.satisfies, cEx.butNot]) {
            if (!predsMap.has(predName)) {
                throw new Error(`unrecognized predicate ${predName} in counter-example ${cEx}`);
            }
        }
        cEx.under = sf.canonicalize(cEx.under);
    }
    for(const predAttr of input.goodPredicates || []) {
        if(!predsMap.has(predAttr.name)) {
            throw new Error(`unrecognized predicate ${predAttr.name} in goodPredicates: ${predAttr}`);
        }
        predAttr.under = sf.canonicalize(predAttr.under);
    }
    for(const predAttr of input.badPredicates || []) {
        if(!predsMap.has(predAttr.name)) {
            throw new Error(`unrecognized predicate ${predAttr.name} in badPredicates: ${predAttr}`);
        }
        predAttr.under = sf.canonicalize(predAttr.under);
    }
    return predsMap;
}

//=[ Process input ]============================================================

export class ImpGraphGen {
    predNames: string[];
    cache: Map<string, Graph<string, Implication>>;
    constructor(predNames: Iterable<string>, public sf: SetFamily, public imps: Implication[]) {
        this.predNames = Array.from(predNames);
        this.cache = new Map();
    }

    get(constraint: any) {
        const cJson = JSON.stringify(constraint);
        let impG = this.cache.get(cJson);
        if(impG !== undefined) {
            return impG;
        }
        const newImps = this.imps.filter((imp) => this.sf.contains(imp.under, constraint));
        impG = Graph.fromVE(this.predNames, newImps);
        this.cache.set(cJson, impG);
        return impG;
    }
}

export interface ProcessedCpigInput {
    predsMap: Map<string, Info>;
    impGGen: ImpGraphGen;
    cExsMap: MultiMap<string, CounterExample>;
    goodPreds: PredAttr[];
    trBadPreds: MultiMap<string, PredAttr>;
    goodnessName: string;
    badnessName: string;
}

export function processInput(input: CpigInput, sf: SetFamily): ProcessedCpigInput {
    const predsMap = validateInput(input, sf);
    const impGGen = new ImpGraphGen(predsMap.keys(), sf, input.implications || []);
    const goodPreds = input.goodPredicates || [];

    const cExsMap = new MultiMap<string, CounterExample>();
    for(const cEx of input.counterExamples || []) {
        const key = JSON.stringify([cEx.satisfies, cEx.butNot]);
        cExsMap.add(key, cEx);
    }
    for(const cEx of input.counterExamples || []) {
        const u = cEx.satisfies, v = cEx.butNot;
        const impG = impGGen.get(cEx.under);
        const uAll = [u, ...impG.getOutTree(u).keys()];
        const vAll = [v, ...impG.getInTree(v).keys()];
        for(const u2 of uAll) {
            for(const v2 of vAll) {
                if(u2 !== u || v2 !== v) {
                    const key = JSON.stringify([u2, v2]);
                    cExsMap.add(key, cEx);
                }
            }
        }
    }

    const trBadPreds = new MultiMap<string, PredAttr>();
    for(const badPred of input.badPredicates || []) {
        trBadPreds.add(badPred.name, badPred);
    }
    for(const badPred of input.badPredicates || []) {
        const impG = impGGen.get(badPred.under);
        const allPredNames = impG.getInTree(badPred.name).keys();
        for(const predName of allPredNames) {
            trBadPreds.add(predName, badPred);
        }
    }
    return {predsMap: predsMap, impGGen: impGGen, cExsMap: cExsMap,
        goodPreds: goodPreds, trBadPreds: trBadPreds,
        goodnessName: input.goodnessName || 'good', badnessName: input.badnessName || 'bad'};
}

//=[ answer queries ]===========================================================

export interface FilteredCpigInput {
    predsMap: Map<string, Info>;
    impG: Graph<string, Implication>;
    cExsMap: MultiMap<string, CounterExample>;
    trGoodPreds: MultiMap<string, PredAttr>;
    trBadPreds: MultiMap<string, PredAttr>;
    goodnessName: string;
    badnessName: string;
}

export function filterInput(input: ProcessedCpigInput, sf: SetFamily, rawConstraint: any): FilteredCpigInput {
    const constraint = sf.canonicalize(rawConstraint);
    const impG = input.impGGen.get(constraint);

    const trGoodPreds = new MultiMap<string, PredAttr>();
    for(const predAttr of input.goodPreds) {
        if(sf.contains(predAttr.under, constraint)) {
            trGoodPreds.add(predAttr.name, predAttr);
        }
    }
    for(const predAttr of input.goodPreds) {
        if(sf.contains(predAttr.under, constraint)) {
            for(const predName of impG.getOutTree(predAttr.name).keys()) {
                trGoodPreds.add(predName, predAttr);
            }
        }
    }

    const trBadPreds = new MultiMap<string, PredAttr>();
    for(const [predName, reasons] of input.trBadPreds.map.entries()) {
        for(const reason of reasons) {
            if(sf.contains(constraint, reason.under)) {
                trBadPreds.add(predName, reason);
            }
        }
    }

    const cExsMap = new MultiMap<string, CounterExample>();
    for(const [key, vList] of input.cExsMap.map.entries()) {
        const vList2 = vList.filter((cEx) => sf.contains(constraint, cEx.under));
        cExsMap.replace(key, vList2);
    }

    return {predsMap: input.predsMap, impG: impG, cExsMap: cExsMap,
        trGoodPreds: trGoodPreds, trBadPreds: trBadPreds,
        goodnessName: input.goodnessName || 'good', badnessName: input.badnessName || 'bad'};
}

function getMaybeEdges(scc: Map<string, string[]>, impG: Graph<string, Implication>,
        cExsMap: MultiMap<string, CounterExample>): Edge<string>[] {
    const maybeEdges = [];
    for(const u of scc.keys()) {
        for(const v of scc.keys()) {
            if(!impG.hasPath(u, v) && !cExsMap.has(JSON.stringify([u, v]))) {
                maybeEdges.push({'from': u, 'to': v});
            }
        }
    }
    return maybeEdges;
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

export function serializeGraph(input: FilteredCpigInput, predNames: string[], showMaybeEdges: boolean,
        format: string): string[] {
    if(format === 'txt') {
        const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
        const redDag = dag.trRed();
        const maybeEdges = showMaybeEdges ? getMaybeEdges(scc, input.impG, input.cExsMap) : [];
        return sccDagToStr(scc, dag, maybeEdges);
    }
    else if(format === 'dot') {
        return getDotGraph(input, predNames, showMaybeEdges);
    }
    else {
        throw new Error('unknown format ' + format);
    }
}

export function getDotGraph(input: FilteredCpigInput, predNames: string[], showMaybeEdges: boolean): string[] {
    const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
    const redDag = dag.trRed();
    const lines = ['digraph G {', 'edge [arrowhead=vee];'];
    for(const u of redDag.adj.keys()) {
        const uAttrs: any = {'label': componentStr(scc.get(u)!, false)};
        if(input.trGoodPreds.has(u)) {
            uAttrs['fontcolor'] = 'green';
            if(input.trBadPreds.has(u)) {
                uAttrs.color = 'red';
            }
            else {
                uAttrs.color = 'green';
            }
        }
        else if(input.trBadPreds.has(u)) {
            uAttrs.fontcolor = 'red';
            uAttrs.color = 'red';
        }
        lines.push(`"${u}"${toDotAttrs(uAttrs)};`);
    }
    if(showMaybeEdges) {
        const maybeEdges = getMaybeEdges(scc, input.impG, input.cExsMap);
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
