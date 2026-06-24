import { Info, SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { CpigInput, ProcessedCpigInput, FilteredCpigInput, RawTexRef } from "./main.js";
import { Implication, CounterExample, PredCond, Proof, Config } from "./main.js";
import { combineInputs, processInput, filterInput, getDotGraph } from "./main.js";
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

export async function setup(sfUrl: string, inputUrls: readonly string[], config: Config) {
    const {sf, input, texRefs} = await fetchInput(sfUrl, inputUrls, config);
    const procInput = processInput(input, sf, texRefs, config);
    if(procInput.insaneCExs.length > 0) {
        const insaneCExsHtml = getCeListHtml(procInput.insaneCExs, sf, config);
        insaneCExsHtml.setAttribute('id', 'insaneCExs');
        const setupErrorsHtml = document.getElementById('setup-errors')!;
        setupErrorsHtml.appendChild(createElement('span', undefined,
            'Counterexamples that contradict implications:'));
        setupErrorsHtml.appendChild(insaneCExsHtml);
    }

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
    const l2rParam = new f2f.Param('drawL2R', new f2f.CheckBoxWidget({defVal: false}),
        {label: 'draw left-to-right'});

    const paramGroup = new f2f.ParamGroup(undefined, [sfeParamGroup, predParamGroup, maybeParam, l2rParam]);
    f2f.createForm('form-container', paramGroup, function(f2fInput, stdout) {
        run(sf, procInput, f2fInput, config);
    });
}

class FetchError extends Error {
    constructor(public readonly response: Response) {
        const errMsgParts = ['HTTP ', response.status];
        if(response.statusText) {
            errMsgParts.push(': ');
            errMsgParts.push(response.statusText);
        }
        super(errMsgParts.join(''));
        this.name = "FetchError";
    }
}

function assertFetchOk(response: Response): Response {
    if (!response.ok) {
        throw new FetchError(response);
    }
    return response;
}

export async function fetchInput(sfUrl: string, inputUrls: readonly string[], config: Config):
        Promise<{sf: SetFamily, input: CpigInput, texRefs: RawTexRef[] | undefined}> {
    /* const pageLoadPromise = new Promise(function(resolve, reject) {
        window.addEventListener('DomContentLoaded', resolve);
    });
    */
    const sfPromise = window.fetch(sfUrl)
        .then(assertFetchOk)
        .then(response => response.json())
        .then(json => SetFamily.fromJson(json));
    const inputsPromise = Promise.all(inputUrls.map(
        inputUrl => window.fetch(inputUrl).then(assertFetchOk).then(response => response.json())));
    let texRefsPromise;
    const configSaysTexRefs = (config.texRefsUrl !== undefined && config.paperUrl !== undefined);
    if(configSaysTexRefs) {
        texRefsPromise = window.fetch(config.texRefsUrl!, {integrity: config.texRefsUrlIntegrity})
            .then(assertFetchOk)
            .then(response => response.json())
            .catch((e) => {
                if(e instanceof Error) {
                    console.warn('An error occurred while fetching config.texRefsUrl:', e);
                    return undefined;
                }
            });
    }
    const sf = await sfPromise;
    const input = combineInputs(await inputsPromise);
    let texRefs = undefined;
    if(configSaysTexRefs) {
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

function addPredParams(output: f2f.Param[], preds: readonly Info[]) {
    for(const pred of preds) {
        output.push(new f2f.Param(pred.name, new f2f.CheckBoxWidget({defVal: false}),
            {label: pred.label || pred.name}));
    }
}

function getProofHtml(proof: Proof, _: Config, className?: string): HTMLElement {
    const div = createElement('div', {'class': 'proof-info'});
    if(className !== undefined) {
        div.classList.add(className);
    }
    div.appendChild(createElement('span', {}, 'proof: '));
    if(proof.proof) {
        div.appendChild(createElement('span', {'class': 'proof-text'}, proof.proof));
    }
    else if(proof.url !== undefined) {
        if(proof.part !== undefined) {
            div.appendChild(createElement('span', {'class': 'proof-part'}, proof.part));
            // if the user wants to display part without a url, they must explicitly set url to "" or null.
            if(proof.url) {
                div.appendChild(createElement('span', {}, ' of '));
            }
        }
        if(proof.url) {
            div.appendChild(createElement('a', {'class': 'proof-link', 'href': proof.url},
                proof.linkText ?? proof.url));
        }
    }
    else {
        if(proof.part !== undefined) {
            console.warn(`Proof has 'part' but not 'url': ${JSON.stringify(proof)}.`);
        }
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

function getImplPathHtml(path: readonly Implication[], sf: SetFamily, config: Config): HTMLElement {
    const olElem = createElement('ol', {'class': 'implPath'});
    for(const e of path) {
        const liElem = createElement('li', {'class': 'proof-step'});
        const headElem = createElement('div', {'class': 'proof-step-head'})
        headElem.appendChild(createElement('span', {}, e.from));
        headElem.appendChild(createElement('span', {'class': 'implies'}, ' ⟹ '));
        headElem.appendChild(createElement('span', {}, e.to));
        liElem.appendChild(headElem);
        liElem.appendChild(getUnderHtml(e.under, sf, 'proof-step-under'));
        liElem.appendChild(getProofHtml(e, config, 'proof-step-proof'));
        olElem.appendChild(liElem);
    }
    return olElem;
}

function getCeListHtml(ceList: readonly CounterExample[], sf: SetFamily, config: Config): HTMLElement {
    const olElem = createElement('ol', {'class': 'ceList'});
    for(const ce of ceList) {
        const liElem = createElement('li', {'class': 'ce-reason'});
        const headElem = createElement('div', {'class': 'ce-reason-head'})
        headElem.appendChild(createElement('span', {}, ce.satisfies));
        headElem.appendChild(createElement('span', {'class': 'not-implies'}));
        headElem.appendChild(createElement('span', {}, ce.butNot));
        liElem.appendChild(headElem);
        liElem.appendChild(getUnderHtml(ce.under, sf, 'ce-reason-under'));
        liElem.appendChild(getProofHtml(ce, config, 'ce-reason-proof'));
        olElem.appendChild(liElem);
    }
    return olElem;
}

function showImplProofHtml(u: string, v: string, divId: string,
        input: FilteredCpigInput, sf: SetFamily, config: Config): void {
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
        container.appendChild(getImplPathHtml(path, sf, config));
    }
    if(ceList.length !== 0) {
        const pElem = createElement('p', {'class': 'edgeHead'});
        pElem.appendChild(createElement('span', {}, u));
        pElem.appendChild(createElement('span', {'class': 'not-implies'}));
        pElem.appendChild(createElement('span', {}, v));
        pElem.appendChild(createElement('span', {}, '. Counterexmaples:'));
        container.appendChild(pElem);
        container.appendChild(getCeListHtml(ceList, sf, config));
    }
}

function getAttrReasonHtml(attrName: string, sf: SetFamily, reason: PredCond, config: Config): HTMLElement {
    const liElem = createElement('li', {'class': 'attr-reason'});
    const headElem = createElement('div', {'class': 'attr-reason-head'}, `${reason.name} is ${attrName}`)
    liElem.appendChild(headElem);
    liElem.appendChild(getUnderHtml(reason.under, sf, 'attr-reason-under'));
    liElem.appendChild(getProofHtml(reason, config, 'attr-reason-proof'));
    return liElem;
}

let colorToCssClass: Record<string, string> = {
    'green': 'success',
    'red': 'danger',
};

function showExistenceProofHtml(predNames: readonly string[], input: FilteredCpigInput, sf: SetFamily, config: Config) {
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
                    olElem.appendChild(getAttrReasonHtml(attrName, sf, reason, config));
                }
                rContainer.appendChild(olElem);
                vContainer.appendChild(rContainer);
            }
        }
        verticesElem.appendChild(vContainer);
    }
}

function run(sf: SetFamily, input: ProcessedCpigInput, f2fInput: any, config: Config) {
    const predNames = f2fInput.pred;
    const filteredInput = filterInput(input, sf, f2fInput.sfe);
    setupOutput();
    if(predNames.length === 2) {
        const [u, v] = predNames;
        showImplProofHtml(u, v, 'fedge', filteredInput, sf, config);
        showImplProofHtml(v, u, 'redge', filteredInput, sf, config);
    }
    if(predNames.length <= 2 && predNames.length >= 1) {
        showExistenceProofHtml(predNames, filteredInput, sf, config);
    }
    const drawOptions = {showMaybeEdges: f2fInput.maybe, drawL2R: f2fInput.drawL2R};
    const dotLines = getDotGraph(filteredInput, predNames, drawOptions);
    drawDotGraph(dotLines.join('\n'));
}
