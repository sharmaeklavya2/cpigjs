'use strict';
import { Info, SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { CpigInput, ProcessedCpigInput, FilteredCpigInput, Implication, CounterExample } from "./main.js";
import { combineInputs, processInput, filterInput, getDotGraph } from "./main.js";
import { Ostream, outputPath, outputGoodBadReasons } from "./cli.js";
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
    const procInput = processInput(input, sf);

    const sfParams: Param[] = [];
    addSfParams(sfParams, sf);
    const sfParamGroup = new ParamGroup('sf', sfParams, null, sf.info.label);
    const predParams: Param[] = [];
    addPredParams(predParams, input.predicates!);
    const predParamGroup = new ParamGroup('pred', predParams, boolMapToList, 'predicates', undefined, true);
    const maybeParam = new Param('maybe', new CheckBoxWidget(true), 'show speculative edges');

    const paramGroup = new ParamGroup('myForm', [sfParamGroup, predParamGroup, maybeParam]);
    createForm('myApp', paramGroup, function (f2fInput, stdout) {
        cli(sf, procInput, f2fInput, stdout, visualizeDot);
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

function cli(sf: SetFamily, input: ProcessedCpigInput, f2fInput: any, stdout: Ostream, visualizeDot: visualizeDotT) {
    const predNames = f2fInput.pred;
    const filteredInput = filterInput(input, sf, f2fInput.sf);
    if(predNames.length === 2) {
        const [u, v] = predNames;
        outputPath(filteredInput, u, v, stdout);
        stdout.log();
        outputPath(filteredInput, v, u, stdout);
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        outputGoodBadReasons(filteredInput, predNames, stdout);
    }
    const dotLines = getDotGraph(filteredInput, predNames, f2fInput.maybe);
    visualizeDot(dotLines.join('\n'));
}
