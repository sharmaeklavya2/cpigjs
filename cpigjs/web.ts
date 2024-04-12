'use strict';
import { Info, SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { filterByConstraint, combineInputs, Ostream, CpigInput, outputPath, getMaybeEdges, addMaybeEdgesToDot, componentStr } from "./main.js";
import { Edge, Graph } from "./graph.js";

declare class Param {
    constructor(name: string, widget: any, label?: string, description?: string);
}
declare class ParamGroup {
    constructor(name: string, paramList: Param[], converter?: any, label?: string,
        description?: string, compact?: boolean);
}
declare var CheckBoxWidget: any;
declare var SelectWidget: any;
declare var SelectOption: any;
declare function createForm(wrapperId: string, paramGroup: ParamGroup,
    func: (input: string, stdout: Ostream) => any, clearOutput?: boolean): any;
type visualizeDotT = (x: string) => undefined;

export async function setup(sfUrl: string, inputUrls: string[], visualizeDot: visualizeDotT) {
    const {sf, input} = await fetchInput(sfUrl, inputUrls);

    const sfParams: Param[] = [];
    addSfParams(sfParams, sf);
    const sfParamGroup = new ParamGroup('sf', sfParams, null, sf.info.label);
    const predParams: Param[] = [];
    addPredParams(predParams, input.predicates!);
    const predParamGroup = new ParamGroup('pred', predParams, boolMapToList, 'predicates', undefined, true);
    const maybeParam = new Param('maybe', new CheckBoxWidget(true), 'show speculative edges');

    const paramGroup = new ParamGroup('myForm', [sfParamGroup, predParamGroup, maybeParam]);
    createForm('myApp', paramGroup, function (f2fInput, stdout) {
        cli(sf, input, f2fInput, stdout, visualizeDot);
    });
}

export async function fetchInput(sfUrl: string, inputUrls: string[]) {
    const pageLoadPromise = new Promise(function(resolve, reject) {
        window.addEventListener('DomContentLoaded', resolve);
    });
    const sfPromise = window.fetch(sfUrl)
        .then(response => response.json())
        .then(json => SetFamily.fromJson(json));
    const inputsPromise = Promise.all(inputUrls.map(
        inputUrl => window.fetch(inputUrl).then(response => response.json())));
    const sf = await sfPromise;
    const input = combineInputs(await inputsPromise);
    return {sf: sf, input: input};
}

function boolMapToList(obj: Object): string[] {
    const a = [];
    for(const [k, v] of Object.entries(obj)) {
        if(v) {
            a.push(k);
        }
    }
    return a;
}

function addSfParams(output: Param[], setFamily: SetFamily) {
    const name = setFamily.info.name;
    const label = setFamily.info.label || name;
    if(setFamily instanceof BoolSetFamily) {
        output.push(new Param(name, new CheckBoxWidget(), label));
    }
    else if(setFamily instanceof DagSetFamily) {
        output.push(new Param(name, new SelectWidget(setFamily.values.map( vInfo => new SelectOption(
            vInfo.name, vInfo.name, vInfo.label || vInfo.name)), setFamily.defVal), label));
    }
    else if(setFamily instanceof ProdSetFamily) {
        for(const part of setFamily.parts) {
            addSfParams(output, part);
        }
    }
}

function addPredParams(output: Param[], preds: Info[]) {
    for(const pred of preds) {
        output.push(new Param(pred.name, new CheckBoxWidget(true), pred.label || pred.name));
    }
}

function cli(sf: SetFamily, input: CpigInput, f2fInput: any, stdout: Ostream, visualizeDot: visualizeDotT) {
    const preds = f2fInput.pred;
    const procInput = filterByConstraint([input], f2fInput.sf, sf);
    if(preds.length === 2) {
        const [u, v] = preds;
        outputPath(procInput, u, v, stdout);
        stdout.log();
        outputPath(procInput, v, u, stdout);
        stdout.log();
    }
    const {scc, dag} = procInput.impG.trCompression(preds.length > 0 ? preds : undefined);
    const redDag = dag.trRed();
    // const s = sccDagToStr(scc, redDag);
    // stdout.log(s);
    const dotLines = redDag.toDot(v => componentStr(scc.get(v)!, false));
    if(f2fInput.maybe) {
        const maybeEdges = getMaybeEdges(scc, procInput.impG, procInput.cExs);
        addMaybeEdgesToDot(dotLines, maybeEdges);
    }
    visualizeDot(dotLines.join('\n'));
}
