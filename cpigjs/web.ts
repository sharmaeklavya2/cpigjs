import { Info, SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { CpigInput, ProcessedCpigInput, FilteredCpigInput } from "./main.js";
import { Implication, CounterExample, PredCond, Proof } from "./main.js";
import { combineInputs, processInput, filterInput, getDotGraph } from "./main.js";
import { Edge, Graph } from "./graph.js";
import { MultiMap } from "./multiMap.js";
import * as f2f from 'funcToForm';
import { instance as loadViz } from 'dotviz';

function drawDotGraph(dotInput: string): void {
    const graphElem = document.getElementById("graph");
    if(graphElem) {
        graphElem.innerText = '';
        loadViz().then(viz => {
            const svg = viz.renderSVGElement(dotInput);
            graphElem.appendChild(svg);
        });
    }
}

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

const predsDescription = 'Pick predicates to show. If none are selected, all are shown. If two are selected, proofs of (non-)implcation are shown. If at most two are selected, proofs of (in)feasibility are shown.';

export async function setup(sfUrl: string, inputUrls: string[], texRefsUrl: string | undefined) {
    const {sf, input, texRefs} = await fetchInput(sfUrl, inputUrls, texRefsUrl);
    const procInput = processInput(input, sf, texRefs);

    const sfeParams: f2f.Param[] = [];
    addSfeParams(sfeParams, sf);
    const sfeParamGroup = new f2f.ParamGroup('sfe', sfeParams, {converter: undefined, label: sf.info.label});
    // sfe means 'set family element'
    const predParams: f2f.Param[] = [];
    addPredParams(predParams, input.predicates!);
    const predParamGroup = new f2f.ParamGroup('pred', predParams,
        {converter: boolMapToList, label: 'predicates', description: predsDescription, compact: true});
    const maybeParam = new f2f.Param('maybe', new f2f.CheckBoxWidget({defVal: true}),
        {label: 'show open problems'});

    const paramGroup = new f2f.ParamGroup(undefined, [sfeParamGroup, predParamGroup, maybeParam]);
    f2f.createForm('form-container', paramGroup, function(f2fInput, stdout) {
        run(sf, procInput, f2fInput);
    });
}

export async function fetchInput(sfUrl: string, inputUrls: string[], texRefsUrl?: string) {
    const pageLoadPromise = new Promise(function(resolve, reject) {
        window.addEventListener('DomContentLoaded', resolve);
    });
    const sfPromise = window.fetch(sfUrl)
        .then(response => response.json())
        .then(json => SetFamily.fromJson(json));
    const inputsPromise = Promise.all(inputUrls.map(
        inputUrl => window.fetch(inputUrl).then(response => response.json())));
    let texRefsPromise;
    if(texRefsUrl !== undefined) {
        texRefsPromise = window.fetch(texRefsUrl).then(response => response.json());
    }
    const sf = await sfPromise;
    const input = combineInputs(await inputsPromise);
    let texRefs = [];
    if(texRefsPromise !== undefined) {
        texRefs = await texRefsPromise;
    }
    return {sf: sf, input: input, texRefs: texRefs};
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

function addSfeParams(output: f2f.Param[], setFamily: SetFamily) {
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
            addSfeParams(output, part);
        }
    }
}

function addPredParams(output: f2f.Param[], preds: Info[]) {
    for(const pred of preds) {
        output.push(new f2f.Param(pred.name, new f2f.CheckBoxWidget({defVal: true}),
            {label: pred.label || pred.name}));
    }
}

function getProofHtml(proof: Proof, className?: string): HTMLElement {
    const div = createElement('div', {'class': 'proof-info'});
    if(className !== undefined) {
        div.classList.add(className);
    }
    div.appendChild(createElement('span', {}, 'proof: '));
    let hasProof = false;
    if(proof.text) {
        div.appendChild(createElement('span', {'class': 'proof-text'}, proof.text));
        hasProof = true;
    }
    else {
        if(proof.part) {
            hasProof = true;
            div.appendChild(createElement('span', {'class': 'proof-part'}, proof.part));
            if(proof.link) {
                div.appendChild(createElement('span', {}, ' of '));
            }
        }
        if(proof.link) {
            hasProof = true;
            div.appendChild(createElement('a', {'class': 'proof-link', 'href': proof.link}, proof.link));
        }
        /*
        else if(proof.thmdep) {
            div.appendChild(createElement('span', {}, 'thmdep: '));
            div.appendChild(createElement('span', {'class': 'proof-thmdep '}, proof.thmdep));
        }
        */
    }
    if(!hasProof) {
        div.replaceChildren();
    }
    return div;
}

function myJsonStringify(value: unknown): string {
    if (value === null) {
        return "null";
    }
    else if (typeof value === "string") {
        return value;
    }
    else if (typeof value === "number") {
        return String(value);
    }
    else if (typeof value === "boolean") {
        return value? '✓': '✗';
    }
    else if (Array.isArray(value)) {
        const items = value.map((item) => myJsonStringify(item)).join(", ");
        return `[${items}]`;
    }
    else if (typeof value === "object") {
        const entries = Object.entries(value).map(([key, val]) => {
            const keyValue = myJsonStringify(val);
            return `${key}: ${keyValue}`;
            });
        return `{${entries.join(", ")}}`;
    }
    else {
        throw new Error('unrecognized type in JSON serialization');
    }
}

function getUnderHtml(under: any, sf: SetFamily, className?: string): HTMLElement {
    const underString = myJsonStringify(sf.prettify(under));
    const elem = createElement('div', {'class': 'under-cond'});
    elem.appendChild(createElement('span', {'class': 'under-cond-head'}, 'under: '));
    elem.appendChild(createElement('span', {'class': 'under-cond-info'}, underString));
    if(className !== undefined) {
        elem.classList.add(className);
    }
    return elem;
}

function getImplPathHtml(path: Implication[], sf: SetFamily): HTMLElement {
    const olElem = createElement('ol', {'class': 'implPath'});
    for(const e of path) {
        const liElem = createElement('li', {'class': 'proof-step'});
        const headElem = createElement('div', {'class': 'proof-step-head'})
        headElem.appendChild(createElement('span', {}, e.from));
        headElem.appendChild(createElement('span', {'class': 'implies'}, ' ⟹ '));
        headElem.appendChild(createElement('span', {}, e.to));
        liElem.appendChild(headElem);
        liElem.appendChild(getUnderHtml(e.under, sf, 'proof-step-under'));
        liElem.appendChild(getProofHtml(e, 'proof-step-proof'));
        olElem.appendChild(liElem);
    }
    return olElem;
}

function getCeListHtml(ceList: CounterExample[], sf: SetFamily): HTMLElement {
    const olElem = createElement('ol', {'class': 'ceList'});
    for(const ce of ceList) {
        const liElem = createElement('li', {'class': 'ce-reason'});
        const headElem = createElement('div', {'class': 'ce-reason-head'})
        headElem.appendChild(createElement('span', {}, ce.satisfies));
        headElem.appendChild(createElement('span', {'class': 'not-implies'}));
        headElem.appendChild(createElement('span', {}, ce.butNot));
        liElem.appendChild(headElem);
        liElem.appendChild(getUnderHtml(ce.under, sf, 'ce-reason-under'));
        liElem.appendChild(getProofHtml(ce, 'ce-reason-proof'));
        olElem.appendChild(liElem);
    }
    return olElem;
}

function showImplProofHtml(input: FilteredCpigInput, sf: SetFamily, u: string, v: string, divId: string): void {
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
        const pElem = createElement('p', {'class': 'edgeHead'});
        pElem.appendChild(createElement('span', {}, u));
        pElem.appendChild(createElement('span', {'class': 'implies'}, ' ⟹ '));
        pElem.appendChild(createElement('span', {}, v));
        pElem.appendChild(createElement('span', {}, '. Proof:'));
        container.appendChild(pElem);
        container.appendChild(getImplPathHtml(path, sf));
    }
    if(ceList.length !== 0) {
        const pElem = createElement('p', {'class': 'edgeHead'});
        pElem.appendChild(createElement('span', {}, u));
        pElem.appendChild(createElement('span', {'class': 'not-implies'}));
        pElem.appendChild(createElement('span', {}, v));
        pElem.appendChild(createElement('span', {}, '. Counterexmaples:'));
        container.appendChild(pElem);
        container.appendChild(getCeListHtml(ceList, sf));
    }
}

function getAttrReasonHtml(attrName: string, sf: SetFamily, reason: PredCond): HTMLElement {
    const liElem = createElement('li', {'class': 'attr-reason'});
    const headElem = createElement('div', {'class': 'attr-reason-head'}, `${reason.name} is ${attrName}`)
    liElem.appendChild(headElem);
    liElem.appendChild(getUnderHtml(reason.under, sf, 'attr-reason-under'));
    liElem.appendChild(getProofHtml(reason, 'attr-reason-proof'));
    return liElem;
}

let colorToCssClass: Record<string, string> = {
    'green': 'success',
    'red': 'danger',
};

function showExistenceProofHtml(input: FilteredCpigInput, sf: SetFamily, predNames: string[]) {
    const verticesElem = document.getElementById('vertices')!;
    verticesElem.replaceChildren();
    for(const predName of predNames) {
        const vContainer = createElement('div', {});
        for(const [attrName, attrReasonsMap] of input.predAttrs.entries()) {
            const reasons = attrReasonsMap.getAll(predName);
            const attrInfo = input.attrsMap.get(attrName)!;
            if(reasons.length > 0) {
                const rContainer = createElement('div', {});
                const pElem = createElement('p', {'class': 'vAttrHead'});
                pElem.appendChild(createElement('span', {}, predName));
                pElem.appendChild(createElement('span', {}, ' is '));
                const tagAttrs: Record<string, string> = {};
                if(attrInfo.color !== undefined) {
                    const cssClass = colorToCssClass[attrInfo.color];
                    if(cssClass !== undefined) {
                        tagAttrs['class'] = cssClass;
                    }
                }
                pElem.appendChild(createElement('span', tagAttrs, attrName));
                pElem.appendChild(createElement('span', {}, '. Reasons:'));
                rContainer.appendChild(pElem);
                const olElem = createElement('ol', {});
                for(const reason of reasons) {
                    olElem.appendChild(getAttrReasonHtml(attrName, sf, reason));
                }
                rContainer.appendChild(olElem);
                vContainer.appendChild(rContainer);
            }
        }
        verticesElem.appendChild(vContainer);
    }
}

function run(sf: SetFamily, input: ProcessedCpigInput, f2fInput: any) {
    const predNames = f2fInput.pred;
    const filteredInput = filterInput(input, sf, f2fInput.sfe);
    setupOutput();
    if(predNames.length === 2) {
        const [u, v] = predNames;
        showImplProofHtml(filteredInput, sf, u, v, 'fedge');
        showImplProofHtml(filteredInput, sf, v, u, 'redge');
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        showExistenceProofHtml(filteredInput, sf, predNames);
    }
    const dotLines = getDotGraph(filteredInput, predNames, f2fInput.maybe);
    drawDotGraph(dotLines.join('\n'));
}
