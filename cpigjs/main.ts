import { MultiMap } from "./multiMap.js";
import { Edge, Graph } from "./graph.js";
import { Info, SetFamily } from "./setFamily.js";

//=[ Read and validate input ]==================================================

export interface Proof {
    proof?: string;
    part?: string;
    url?: string;
    linkText?: string;
    texRef?: string | string[];
}
/* A proof can have one of the following types:
1.  textual proof:
    a proof (or its sketch) is given as plain text in `proof`.
    Fields `part`, `url`, `linkText`, and `texRef` will be ignored.
2.  proof in companion paper:
    `texRef` contains the TeX `\label` of the theorem/lemma/example in the companion paper.
    The url to the companion paper is given in `config.paperUrl` in `htmlContext.json`.
    `part` and `url` are empty.
    During preprocessing, `part` is populated using `texRef`, `url` is populated using `config.paperUrl`,
    and `linkText` is populated using `config.paperLinkText`, and then it is treated like an external result.
3.  proof in external paper:
    this result's proof is in the paper given by `url`.
    `part` may be empty, but if present, specifies the section/theorem/lemma/example number in the paper.
    `texRef` is ignored.
*/

export interface RawTexRef {
    readonly type: string;
    readonly texLabel: string;
    readonly outputId: string;
    readonly anchor: string
    readonly page: string
}

export interface Implication extends Edge<string>, Proof {
    under: any;
}

export interface CounterExample extends Proof {
    readonly satisfies: string;
    readonly butNot: string;
    under: any;
}

export interface PredCond extends Proof {
    readonly name: string;
    under: any;
}

export interface AttrInfo extends Info {
    readonly color?: string;
    readonly bgColor?: string;
    readonly shape?: string;
    readonly style?: string;
    readonly propgDir?: "fwd" | "rev";  // propagation direction
}

export interface CpigInput {
    predicates?: Info[];
    implications?: Implication[];
    counterExamples?: CounterExample[];
    attrs?: AttrInfo[];
    predAttrs?: Record<string, PredCond[]>;
}

export interface Config {
    readonly texRefsUrl?: string;
    readonly texRefsUrlIntegrity?: string;
    readonly paperUrl?: string;
    readonly paperLinkText?: string;
    readonly showPageNumber?: boolean;
}

export function combineInputs(inputs: readonly CpigInput[]): CpigInput {
    const preds: Info[] = [], imps: Implication[] = [], cExs: CounterExample[] = [], attrs: AttrInfo[] = [];
    const predAttrs: Record<string, PredCond[]> = {};
    for(const input of inputs) {
        preds.push(...(input.predicates || []));
        attrs.push(...(input.attrs || []));
        for(const imp of input.implications || []) {
            const fromList = imp.from.split('|');
            const toList = imp.to.split('+');
            if(fromList.length === 1 && toList.length === 1) {
                imps.push(imp);
            }
            else {
                for(const from of fromList) {
                    for(const to of toList) {
                        const imp2 = Object.assign({}, imp, {from: from, to: to}) as Implication;
                        imps.push(imp2);
                    }
                }
            }
        }
        for(const cex of input.counterExamples || []) {
            const satList = cex.satisfies.split('+');
            const butNotList = cex.butNot.split('|');
            if(satList.length === 1 && butNotList.length === 1) {
                cExs.push(cex);
            }
            else {
                for(const sat of satList) {
                    for(const butNot of butNotList) {
                        const cex2 = Object.assign({}, cex, {satisfies: sat, butNot: butNot}) as CounterExample;
                        cExs.push(cex2);
                    }
                }
            }
        }
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
    constructor(predNames: Iterable<string>, public sf: SetFamily, public imps: readonly Implication[]) {
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
    impGGen: ImpGraphGen;  // implication graph generator
    cExsMap: MultiMap<string, CounterExample>;
    fwdPredAttrs: Map<string, PredCond[]>;
    trRevPredAttrs: Map<string, MultiMap<string, PredCond>>;
    insaneCExs: CounterExample[];
}
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function processTexRefs(texRefs: readonly RawTexRef[], config: Config): Map<string, string> {
    const refMap = new Map<string, string>();
    for(const texRef of texRefs) {
        if(refMap.has(texRef.texLabel)) {
            throw new Error(`duplicate texLabel ${texRef.texLabel} found`);
        }
        const valueParts = [capitalize(texRef.type), texRef.outputId];
        if(config.showPageNumber) {
            valueParts.push(`(page ${texRef.page})`);
        }
        refMap.set(texRef.texLabel, valueParts.join(' '));
    }
    return refMap;
}

function getTexRef(texLabel: string, texRefMap: Map<string, string>): string | undefined {
    const texRef = texRefMap.get(texLabel);
    if(texRef === undefined) {
        console.warn(`Could not find texRef ${JSON.stringify(texLabel)}.`);
    }
    return texRef;
}

function standardizeUrl(url: string): string {
    if(url.toLowerCase().startsWith('doi:')) {
        const doi = url.slice(4);
        return `https://doi.org/${doi}`;
    }
    else if(url.toLowerCase().startsWith('arxiv:')) {
        const arxivId = url.slice(6);
        return `https://arxiv.org/abs/${arxivId}`;
    }
    else {
        return url;
    }
}

export function processInput(input: CpigInput, sf: SetFamily, texRefs?: readonly RawTexRef[], config: Config = {}): ProcessedCpigInput {
    const {predsMap, attrsMap} = validateInput(input, sf);
    const impGGen = new ImpGraphGen(predsMap.keys(), sf, input.implications || []);

    // collect all proofs
    const proofs: Proof[] = [];
    proofs.push(...(input.implications ?? []));
    proofs.push(...(input.counterExamples ?? []));
    for(const [_, predConds] of Object.entries(input.predAttrs ?? {})) {
        proofs.push(...predConds);
    }

    // change 'companion paper proofs' to 'external paper proofs'
    if(texRefs !== undefined) {
        const texRefMap = processTexRefs(texRefs, config);
        for(const proof of proofs) {
            if(proof.part === undefined && proof.url === undefined && proof.texRef !== undefined) {
                if(Array.isArray(proof.texRef)) {
                    const parts = proof.texRef.map(texLabel => getTexRef(texLabel, texRefMap) || texLabel);
                    proof.part = parts.join(', ');
                }
                else {
                    const newPart = getTexRef(proof.texRef, texRefMap);
                    if(newPart !== undefined) {
                        proof.part = newPart;
                    }
                }
                if(proof.part !== undefined) {
                    proof.url = config.paperUrl;
                    if(config.paperLinkText !== undefined) {
                        proof.linkText = config.paperLinkText;
                    }
                }
            }
        }
    }

    // standardize urls in proofs
    for(const proof of proofs) {
        if(proof.linkText === undefined && proof.url !== undefined) {
            const stdUrl = standardizeUrl(proof.url);
            if(stdUrl !== proof.url) {
                proof.linkText = proof.url;
                proof.url = stdUrl;
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
    const insaneCExs: CounterExample[] = [];
    for(const cEx of input.counterExamples || []) {
        const u = cEx.satisfies, v = cEx.butNot;
        const impG = impGGen.get(cEx.under);
        if(impG.hasPath(u, v)) {
            insaneCExs.push(cEx);
        }
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
        fwdPredAttrs: fwdPredAttrs, trRevPredAttrs: trRevPredAttrs, insaneCExs: insaneCExs};
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

export function filterInput(input: ProcessedCpigInput, sf: SetFamily, rawConstraint: any, computePredAttrs: boolean = true): FilteredCpigInput {
    const constraint = sf.canonicalize(rawConstraint);
    const impG = input.impGGen.get(constraint);

    const cExsMap = new MultiMap<string, CounterExample>();
    for(const [key, vList] of input.cExsMap.map.entries()) {
        const vList2 = vList.filter((cEx) => sf.contains(constraint, cEx.under));
        cExsMap.replace(key, vList2);
    }

    const predAttrs = new Map<string, MultiMap<string, PredCond>>();
    const predAttrsSummary = new MultiMap<string, string>();
    if(computePredAttrs) {
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

        for(const [attrName, predCondMap] of predAttrs.entries()) {
            for(const predName of predCondMap.map.keys()) {
                predAttrsSummary.add(predName, attrName);
            }
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

function componentStr(S: readonly string[], parens: boolean, predsMap?: Map<string, Info>): string {
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
    'red':   '#660a0a',
    'green': '#0d400d',
};

const borderColors: Record<string, string> = {
    'red':   '#a36262',
    'green': '#648c64',
};

const bgColors: Record<string, string> = {
    'red':   '#ffe8e8',
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

export function serializeGraph(input: FilteredCpigInput, predNames: readonly string[], drawOptions: DrawOptions,
        format: string): string[] {
    if(format === 'txt') {
        const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
        const redDag = dag.trRed();
        const maybeEdges = drawOptions.showMaybeEdges ? getMaybeEdges(scc, input.impG, input.cExsMap) : [];
        return sccDagToStr(scc, redDag, maybeEdges);
    }
    else if(format === 'dot') {
        return getDotGraph(input, predNames, drawOptions);
    }
    else {
        throw new Error('unknown format ' + format);
    }
}

export interface DrawOptions {
    readonly showMaybeEdges?: boolean;
    readonly drawL2R: boolean;
}

export function getDotGraph(input: FilteredCpigInput, predNames: readonly string[], drawOptions: DrawOptions): string[] {
    const {scc, dag} = input.impG.trCompression(predNames.length > 0 ? predNames : undefined);
    const redDag = dag.trRed();
    const rankdir = drawOptions.drawL2R ? 'LR' : 'TB';
    const lines = ['digraph G {',
        `graph [margin=0, rankdir="${rankdir}", ranksep=0.3, nodesep=0.15];`,
        'edge [arrowhead=vee, arrowsize=0.75];',
        'node [shape=box, margin="0.05,0.015", width=0, height=0, style=filled];'];
    for(const u of redDag.adj.keys()) {
        const uAttrs: Record<string, string> = {'label': componentStr(scc.get(u)!, false, input.predsMap)};
        for(const attrName of input.predAttrsSummary.getAll(u)) {
            const attrInfo = input.attrsMap.get(attrName)!;
            if(attrInfo.color !== undefined) {
                uAttrs.fontcolor = textColors[attrInfo.color] ?? attrInfo.color;
                uAttrs.color = borderColors[attrInfo.color] ?? attrInfo.color;
                if(bgColors.hasOwnProperty(attrInfo.color)) {
                    uAttrs.fillcolor = bgColors[attrInfo.color];
                }
            }
            if(attrInfo.bgColor !== undefined) {
                uAttrs.fillcolor = attrInfo.bgColor;
            }
            if(attrInfo.shape !== undefined) {
                uAttrs.shape = attrInfo.shape;
            }
            if(attrInfo.style !== undefined) {
                uAttrs.style = attrInfo.style;
            }
        }
        if(uAttrs.fillcolor === undefined) {
            uAttrs.fillcolor = '#eeeeee';
            uAttrs.fontcolor = '#000000';
            uAttrs.color = '#666666';
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
