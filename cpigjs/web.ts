'use strict';
import { Info, SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { filterByConstraint, combineInputs, Ostream, CpigInput, outputPath } from "./main.js";
import { Edge, Graph } from "./graph.js";

declare class Param {
    constructor(name: string, widget: any, label?: string, description?: string);
}
declare class ParamGroup {
    constructor(name: string, paramList: Param[], converter?: any, description?: string);
}
declare var CheckBoxWidget: any;
declare var SelectWidget: any;
declare var SelectOption: any;
declare function createForm(wrapperId: string, paramGroup: ParamGroup,
    func: (input: string, stdout: Ostream) => any, clearOutput?: boolean): any;

export async function setup(sfUrl: string, inputUrls: string[]) {
    const {sf, input} = await fetchInput(sfUrl, inputUrls);
    const params: Param[] = [];
    addSfParams(params, sf);
    addPredParams(params, input.predicates!);
    const paramGroup = new ParamGroup('myForm', params);
    createForm('myApp', paramGroup, function (f2fInput, stdout) {
        cli(sf, input, f2fInput, stdout);
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
    console.log(sf);
    console.log(input);
    return {sf: sf, input: input};
}

function addSfParams(output: Param[], setFamily: SetFamily) {
    const name = setFamily.info.name;
    if(setFamily instanceof BoolSetFamily) {
        output.push(new Param(name, new CheckBoxWidget()));
    }
    else if(setFamily instanceof DagSetFamily) {
        output.push(new Param(name, new SelectWidget(setFamily.values.map(
            vInfo => new SelectOption(vInfo.name, vInfo.name, vInfo.label || vInfo.name)), setFamily.defVal)));
    }
    else if(setFamily instanceof ProdSetFamily) {
        for(const part of setFamily.parts) {
            addSfParams(output, part);
        }
    }
}

function addPredParams(output: Param[], preds: Info[]) {
    for(const pred of preds) {
        output.push(new Param('pred.' + pred.name, new CheckBoxWidget(), pred.name));
    }
}

function cli(sf: SetFamily, input: CpigInput, f2fInput: any, stdout: Ostream) {
    const chosenPreds = [];
    for(const pred of input.predicates!) {
        if(f2fInput['pred.'+pred.name]) {
            chosenPreds.push(pred.name);
        }
    }
    const procInput = filterByConstraint([input], f2fInput, sf);

    if(chosenPreds.length === 2) {
        const [u, v] = chosenPreds;
        outputPath(procInput.impG, u, v, stdout);
        outputPath(procInput.impG, v, u, stdout);
    }
    const {scc, dag} = procInput.impG.trCompression(chosenPreds.length > 0 ? chosenPreds : undefined);
    const redDag = dag.trRed();
    const s = sccDagToStr(scc, redDag);
    stdout.log(s);
}

function componentStr(S: string[], parens: boolean) {
    const begDelim = parens ? '( ' : '';
    const endDelim = parens ? ' )' : '';
    return S.length === 1 ? S[0] : begDelim + S.join(' = ') + endDelim;
}

function sccDagToStr(scc: Map<string, string[]>, dag: Graph<string, Edge<string>>) {
    const lines = [];
    for(const edge of dag.edges) {
        const uS = scc.get(edge.from)!, vS = scc.get(edge.to)!;
        lines.push(componentStr(uS, true) + ' ==> ' + componentStr(vS, true));
    }
    return lines.join('\n');
}
