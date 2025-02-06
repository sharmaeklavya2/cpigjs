import { MultiMap } from "./multiMap.js";
import { Edge, Graph } from "./graph.js";
import { Info, SetFamily } from "./setFamily.js";

//=[ Read and validate input ]==================================================

export interface Proof {
    text?: string;
    part?: string;
    link?: string;
    thmdep?: string;
    texRef?: string | string[];
}

export interface RawTexRef {
    type: string;
    texLabel: string;
    outputId: string;
    anchor: string
    page: string
}

export interface Implication extends Edge<string>, Proof {
    under: any;
}

export interface CounterExample extends Proof {
    satisfies: string;
    butNot: string;
    under: any;
}

export interface PredCond extends Proof {
    name: string;
    under: any;
}

export interface AttrInfo extends Info {
    color?: string;
    propgDir?: "fwd" | "rev";  // propagation direction
}

export interface CpigInput {
    predicates?: Info[];
    implications?: Implication[];
    counterExamples?: CounterExample[];
    attrs?: AttrInfo[];
    predAttrs?: Record<string, PredCond[]>;
}

export function combineInputs(inputs: CpigInput[]): CpigInput {
    const preds = [], imps = [], cExs = [], attrs = [];
    const predAttrs: Record<string, PredCond[]> = {};
    for(const input of inputs) {
        preds.push(...(input.predicates || []));
        imps.push(...(input.implications || []));
        cExs.push(...(input.counterExamples || []));
        attrs.push(...(input.attrs || []));
        for(const [attrName, predConds] of Object.entries(input.predAttrs || {})) {
            if(predAttrs.hasOwnProperty(attrName)) {
                predAttrs[attrName].push(...predConds);
            }
            else {
                predAttrs[attrName] = predConds;
            }
        }
    }
    return {'predicates': preds, 'implications': imps, 'counterExamples': cExs,
        'attrs': attrs, 'predAttrs': predAttrs};
}

function validateInput(input: CpigInput, sf: SetFamily): {'predsMap': Map<string, Info>, 'attrsMap': Map<string, AttrInfo>} {
    const predsMap = new Map<string, Info>();
    const attrsMap = new Map<string, AttrInfo>();
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
    for(const attrInfo of input.attrs || []) {
        if(attrsMap.has(attrInfo.name)) {
            throw new Error(`attribute ${attrInfo.name} already exists.`);
        }
        else {
            attrsMap.set(attrInfo.name, attrInfo);
        }
    }
    for(const [attrName, predConds] of Object.entries(input.predAttrs || {})) {
        if(!attrsMap.has(attrName)) {
            throw new Error(`unrecognized attribute ${attrName} in attrs`);
        }
        for(const predCond of predConds) {
            if(!predsMap.has(predCond.name)) {
                throw new Error(`unrecognized predicate ${predCond.name} in attrs[${attrName}]: ${JSON.stringify(predCond)}`);
            }
            predCond.under = sf.canonicalize(predCond.under);
        }
    }
    return {'predsMap': predsMap, 'attrsMap': attrsMap};
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
    attrsMap: Map<string, AttrInfo>;
    impGGen: ImpGraphGen;
    cExsMap: MultiMap<string, CounterExample>;
    fwdPredAttrs: Map<string, PredCond[]>;
    trRevPredAttrs: Map<string, MultiMap<string, PredCond>>;
}
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function processTexRefs(texRefs: RawTexRef[]): Map<string, string> {
    const refMap = new Map<string, string>();
    for(const texRef of texRefs) {
        if(refMap.has(texRef.texLabel)) {
            throw new Error(`duplicate texLabel ${texRef.texLabel} found`);
        }
        refMap.set(texRef.texLabel, `${capitalize(texRef.type)} ${texRef.outputId} (page ${texRef.page})`);
        // refMap.set(texRef.texLabel, `${capitalize(texRef.type)} ${texRef.outputId}`);
    }
    return refMap;
}

export function processInput(input: CpigInput, sf: SetFamily, texRefs: RawTexRef[]): ProcessedCpigInput {
    const {predsMap, attrsMap} = validateInput(input, sf);
    const texRefMap = processTexRefs(texRefs);
    const impGGen = new ImpGraphGen(predsMap.keys(), sf, input.implications || []);

    // replace texRef by part
    const proofs: Proof[] = [];
    proofs.push(...(input.implications || []));
    proofs.push(...(input.counterExamples || []));
    for(const [attrName, predConds] of Object.entries(input.predAttrs || {})) {
        proofs.push(...predConds);
    }
    for(const proof of proofs) {
        if(proof.part === undefined && proof.texRef !== undefined) {
            if(Array.isArray(proof.texRef)) {
                const parts = proof.texRef.map(texLabel => texRefMap.get(texLabel) || texLabel);
                proof.part = parts.join(', ');
            }
            else {
                const newPart = texRefMap.get(proof.texRef);
                if(newPart !== undefined) {
                    proof.part = newPart;
                }
            }
        }
    }

    const fwdPredAttrs = new Map<string, PredCond[]>();
    const trRevPredAttrs = new Map<string, MultiMap<string, PredCond>>();
    for(const attrInfo of input.attrs || []) {
        if(attrInfo.propgDir === 'fwd') {
            fwdPredAttrs.set(attrInfo.name, []);
        }
        else if(attrInfo.propgDir === 'rev') {
            trRevPredAttrs.set(attrInfo.name, new MultiMap<string, PredCond>());
        }
    }

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

    for(const [attrName, predConds] of Object.entries(input.predAttrs || {})) {
        const attrInfo = attrsMap.get(attrName)!;
        if(attrInfo.propgDir === 'fwd') {
            fwdPredAttrs.set(attrInfo.name, predConds);
        }
        else if(attrInfo.propgDir === 'rev') {
            const trPredConds = trRevPredAttrs.get(attrInfo.name)!;
            for(const predCond of predConds) {
                trPredConds.add(predCond.name, predCond);
            }
            for(const predCond of predConds) {
                const impG = impGGen.get(predCond.under);
                const allPredNames = impG.getInTree(predCond.name).keys();
                for(const predName of allPredNames) {
                    trPredConds.add(predName, predCond);
                }
            }
        }
    }
    return {predsMap: predsMap, attrsMap: attrsMap, impGGen: impGGen, cExsMap: cExsMap,
        fwdPredAttrs: fwdPredAttrs, trRevPredAttrs: trRevPredAttrs};
}

//=[ answer queries ]===========================================================

export interface FilteredCpigInput {
    predsMap: Map<string, Info>;
    attrsMap: Map<string, AttrInfo>;
    impG: Graph<string, Implication>;
    cExsMap: MultiMap<string, CounterExample>;
    predAttrs: Map<string, MultiMap<string, PredCond>>;  // outer key is attribute, inner key is predicate
    predAttrsSummary: MultiMap<string, string>;  // key is predicate, value is attribute
}

export function filterInput(input: ProcessedCpigInput, sf: SetFamily, rawConstraint: any): FilteredCpigInput {
    const constraint = sf.canonicalize(rawConstraint);
    const impG = input.impGGen.get(constraint);

    const cExsMap = new MultiMap<string, CounterExample>();
    for(const [key, vList] of input.cExsMap.map.entries()) {
        const vList2 = vList.filter((cEx) => sf.contains(constraint, cEx.under));
        cExsMap.replace(key, vList2);
    }

    const predAttrs = new Map<string, MultiMap<string, PredCond>>();
    for(const [attrName, attrInfo] of input.attrsMap.entries()) {
        if(attrInfo.propgDir === 'fwd') {
            const oldPredConds = input.fwdPredAttrs.get(attrName)!;
            const newPredConds = new MultiMap<string, PredCond>();
            for(const predCond of oldPredConds) {
                if(sf.contains(predCond.under, constraint)) {
                    newPredConds.add(predCond.name, predCond);
                }
            }
            for(const predCond of oldPredConds) {
                if(sf.contains(predCond.under, constraint)) {
                    for(const predName of impG.getOutTree(predCond.name).keys()) {
                        newPredConds.add(predName, predCond);
                    }
                }
            }
            predAttrs.set(attrName, newPredConds);
        }
        else if(attrInfo.propgDir === 'rev') {
            const oldPredConds = input.trRevPredAttrs.get(attrName)!;
            const newPredConds = new MultiMap<string, PredCond>();
            for(const [predName, reasons] of oldPredConds.map.entries()) {
                for(const reason of reasons) {
                    if(sf.contains(constraint, reason.under)) {
                        newPredConds.add(predName, reason);
                    }
                }
            }
            predAttrs.set(attrName, newPredConds);
        }
    }

    const predAttrsSummary = new MultiMap<string, string>();
    for(const [attrName, predCondMap] of predAttrs.entries()) {
        for(const predName of predCondMap.map.keys()) {
            predAttrsSummary.add(predName, attrName);
        }
    }

    return {predsMap: input.predsMap, attrsMap: input.attrsMap, impG: impG, cExsMap: cExsMap,
        predAttrs: predAttrs, predAttrsSummary: predAttrsSummary};
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

function componentStr(S: string[], parens: boolean, predsMap?: Map<string, Info>) {
    const begDelim = parens ? '( ' : '';
    const endDelim = parens ? ' )' : '';
    let labels = S;
    if(predsMap !== undefined) {
        labels = S.map((x: string) => (predsMap.get(x)!.label ?? x));
    }
    return S.length === 1 ? labels[0] : begDelim + labels.join(' = ') + endDelim;
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

const textColors: Record<string, string> = {
    'red': '#660a0a',
    'green': '#0d400d',
};

const bgColors: Record<string, string> = {
    'red': '#ffe8e8',
    'green': '#e8ffe8',
};

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

export function serializeGraph(input: FilteredCpigInput, predNames: string[], drawOptions: DrawOptions,
        format: string): string[] {
    if(format === 'txt') {
        const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
        const redDag = dag.trRed();
        const maybeEdges = drawOptions.showMaybeEdges ? getMaybeEdges(scc, input.impG, input.cExsMap) : [];
        return sccDagToStr(scc, dag, maybeEdges);
    }
    else if(format === 'dot') {
        return getDotGraph(input, predNames, drawOptions);
    }
    else {
        throw new Error('unknown format ' + format);
    }
}

interface DrawOptions {
    showMaybeEdges?: boolean;
    drawL2R: boolean;
}

export function getDotGraph(input: FilteredCpigInput, predNames: string[], drawOptions: DrawOptions): string[] {
    const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
    const redDag = dag.trRed();
    const rankdir = drawOptions.drawL2R ? 'LR' : 'TB';
    const lines = ['digraph G {',
        `graph [margin=0, rankdir="${rankdir}"];`,
        'edge [arrowhead=vee, arrowsize=0.75];',
        'node [shape=box, margin="0.1,0.03", width=0, height=0, style=filled];'];
    for(const u of redDag.adj.keys()) {
        const uAttrs: Record<string, string> = {'label': componentStr(scc.get(u)!, false, input.predsMap)};
        for(const attrName of input.predAttrsSummary.getAll(u)) {
            const attrInfo = input.attrsMap.get(attrName)!;
            if(attrInfo.color !== undefined) {
                uAttrs.fontcolor = textColors[attrInfo.color] ?? attrInfo.color;
                uAttrs.color = textColors[attrInfo.color] ?? attrInfo.color;
                if(bgColors.hasOwnProperty(attrInfo.color)) {
                    uAttrs.fillcolor = bgColors[attrInfo.color];
                }
            }
        }
        if(uAttrs.fillcolor === undefined) {
            uAttrs.fillcolor = '#eeeeee';
        }
        lines.push(`"${u}"${toDotAttrs(uAttrs)};`);
    }
    if(drawOptions.showMaybeEdges) {
        const maybeEdges = getMaybeEdges(scc, input.impG, input.cExsMap);
        for(const e of maybeEdges) {
            const eAttrs = {'style': 'dashed', 'constraint': 'false', 'color': 'gray',
                'penwidth': '0.6', 'arrowsize': '0.5'};
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
