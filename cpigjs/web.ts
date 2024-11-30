'use strict';
import { Info, SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { CpigInput, ProcessedCpigInput, FilteredCpigInput, Implication, CounterExample, PredAttr } from "./main.js";
import { combineInputs, processInput, filterInput, getDotGraph } from "./main.js";
import { Ostream } from "./cli.js";
import { Edge, Graph } from "./graph.js";
import { MultiMap } from "./multiMap.js";
import * as f2f from "https://sharmaeklavya2.github.io/funcToForm/v2.js";

type visualizeDotT = (x: string) => undefined;

function createElement(tagName: string, attrs?: Object, innerText?: string): HTMLElement {
    const elem = document.createElement(tagName);
    if(attrs !== undefined) {
        for(const [k, v] of Object.entries(attrs)) {
            elem.setAttribute(k, v);
        }
    }
    if(innerText !== undefined) {
        elem.innerText = innerText;
    }
    return elem;
}

function setupOutput(): void {
    const outputContainer = document.getElementById('output-container');
    if(outputContainer === null || outputContainer === undefined) {
        throw new Error("HTML element with id 'output-container' not found.");
    }
    outputContainer.replaceChildren();
    outputContainer.appendChild(createElement('div', {'id': 'fedge'}));
    outputContainer.appendChild(createElement('div', {'id': 'redge'}));
    outputContainer.appendChild(createElement('div', {'id': 'vertices'}));
    outputContainer.appendChild(createElement('div', {'id': 'graph'}));
}

export async function setup(sfUrl: string, inputUrls: string[], visualizeDot: visualizeDotT) {
    const {sf, input} = await fetchInput(sfUrl, inputUrls);
    const procInput = processInput(input, sf);

    const sfParams: f2f.Param[] = [];
    addSfParams(sfParams, sf);
    const sfParamGroup = new f2f.ParamGroup('sf', sfParams, {converter: undefined, label: sf.info.label});
    const predParams: f2f.Param[] = [];
    addPredParams(predParams, input.predicates!);
    const predParamGroup = new f2f.ParamGroup('pred', predParams,
        {converter: boolMapToList, label: 'predicates', description: undefined, compact: true});
    const maybeParam = new f2f.Param('maybe', new f2f.CheckBoxWidget({defVal: true}),
        {label: 'show speculative edges'});

    const paramGroup = new f2f.ParamGroup(undefined, [sfParamGroup, predParamGroup, maybeParam]);
    f2f.createForm('form-container', paramGroup, function(f2fInput, stdout) {
        run(sf, procInput, f2fInput, visualizeDot);
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

function addSfParams(output: f2f.Param[], setFamily: SetFamily) {
    const name = setFamily.info.name;
    const label = setFamily.info.label || name;
    if(setFamily instanceof BoolSetFamily) {
        output.push(new f2f.Param(name, new f2f.CheckBoxWidget(), {label: label}));
    }
    else if(setFamily instanceof DagSetFamily) {
        output.push(new f2f.Param(name, new f2f.SelectWidget(setFamily.values.map(
                vInfo => new f2f.SelectOption({name: vInfo.name, value: vInfo.name, text: vInfo.label || vInfo.name})),
            setFamily.defVal), {label: label}));
    }
    else if(setFamily instanceof ProdSetFamily) {
        for(const part of setFamily.parts) {
            addSfParams(output, part);
        }
    }
}

function addPredParams(output: f2f.Param[], preds: Info[]) {
    for(const pred of preds) {
        output.push(new f2f.Param(pred.name, new f2f.CheckBoxWidget({defVal: true}),
            {label: pred.label || pred.name}));
    }
}

function getImplPathHtml(path: Implication[]): HTMLElement {
    const olElem = createElement('ol', {'class': 'implPath'});
    for(const e of path) {
        const liElem = createElement('li', {}, JSON.stringify(e));
        olElem.appendChild(liElem);
    }
    return olElem;
}

function getCeListHtml(ceList: CounterExample[]): HTMLElement {
    const olElem = createElement('ol', {'class': 'ceList'});
    for(const ce of ceList) {
        const liElem = createElement('li', {}, JSON.stringify(ce));
        olElem.appendChild(liElem);
    }
    return olElem;
}

function showImplProofHtml(input: FilteredCpigInput, u: string, v: string, divId: string): void {
    const path = input.impG.getPath(u, v);
    const ceList = input.cExsMap.getAll(JSON.stringify([u, v]));
    const container = document.getElementById(divId)!;
    container.replaceChildren();
    if(path === undefined) {
        if(ceList.length === 0) {
            container.appendChild(createElement('p', {'class': 'edgeHead'},
                `It is not known whether ${u} implies ${v}.`));
        }
    }
    else {
        container.appendChild(createElement('p', {'class': 'edgeHead'}, `${u} ⟹ ${v}. Proof:`));
        container.appendChild(getImplPathHtml(path));
    }
    if(ceList.length !== 0) {
        container.appendChild(createElement('p', {'class': 'edgeHead'},
            `${u} does not imply ${v}. Counterexamples:`));
        container.appendChild(getCeListHtml(ceList));
    }
}

function showExistenceProofHtml(input: FilteredCpigInput, predNames: string[]) {
    const mainList: [string, MultiMap<string, PredAttr>][] =
            [[input.goodnessName, input.trGoodPreds], [input.badnessName, input.trBadPreds]];
    const verticesElem = document.getElementById('vertices')!;
    verticesElem.replaceChildren();
    for(const predName of predNames) {
        const vContainer = createElement('div', {});
        for(const [attrName, attrReasonsMap] of mainList) {
            const reasons = attrReasonsMap.getAll(predName);
            if(reasons.length > 0) {
                const rContainer = createElement('div', {});
                rContainer.appendChild(createElement('p', {}, `${predName} is ${attrName}. Reasons:`));
                const olElem = createElement('ol', {});
                for(const reason of reasons) {
                    olElem.appendChild(createElement('li', {}, JSON.stringify(reason)));
                }
                rContainer.appendChild(olElem);
                vContainer.appendChild(rContainer);
            }
        }
        verticesElem.appendChild(vContainer);
    }
}

function run(sf: SetFamily, input: ProcessedCpigInput, f2fInput: any, visualizeDot: visualizeDotT) {
    const predNames = f2fInput.pred;
    const filteredInput = filterInput(input, sf, f2fInput.sf);
    setupOutput();
    if(predNames.length === 2) {
        const [u, v] = predNames;
        showImplProofHtml(filteredInput, u, v, 'fedge');
        showImplProofHtml(filteredInput, v, u, 'redge');
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        showExistenceProofHtml(filteredInput, predNames);
    }
    const dotLines = getDotGraph(filteredInput, predNames, f2fInput.maybe);
    visualizeDot(dotLines.join('\n'));
}
