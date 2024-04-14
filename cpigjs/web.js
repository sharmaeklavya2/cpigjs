'use strict';
import { SetFamily, BoolSetFamily, DagSetFamily, ProdSetFamily } from "./setFamily.js";
import { combineInputs, processInput, filterInput, outputPath, getDotGraph, outputGoodBadReasons } from "./main.js";
export async function setup(sfUrl, inputUrls, visualizeDot) {
    const { sf, input } = await fetchInput(sfUrl, inputUrls);
    const procInput = processInput(input, sf);
    const sfParams = [];
    addSfParams(sfParams, sf);
    const sfParamGroup = new ParamGroup('sf', sfParams, null, sf.info.label);
    const predParams = [];
    addPredParams(predParams, input.predicates);
    const predParamGroup = new ParamGroup('pred', predParams, boolMapToList, 'predicates', undefined, true);
    const maybeParam = new Param('maybe', new CheckBoxWidget(true), 'show speculative edges');
    const paramGroup = new ParamGroup('myForm', [sfParamGroup, predParamGroup, maybeParam]);
    createForm('myApp', paramGroup, function (f2fInput, stdout) {
        cli(sf, procInput, f2fInput, stdout, visualizeDot);
    });
}
export async function fetchInput(sfUrl, inputUrls) {
    const pageLoadPromise = new Promise(function (resolve, reject) {
        window.addEventListener('DomContentLoaded', resolve);
    });
    const sfPromise = window.fetch(sfUrl)
        .then(response => response.json())
        .then(json => SetFamily.fromJson(json));
    const inputsPromise = Promise.all(inputUrls.map(inputUrl => window.fetch(inputUrl).then(response => response.json())));
    const sf = await sfPromise;
    const input = combineInputs(await inputsPromise);
    return { sf: sf, input: input };
}
function boolMapToList(obj) {
    const a = [];
    for (const [k, v] of Object.entries(obj)) {
        if (v) {
            a.push(k);
        }
    }
    return a;
}
function addSfParams(output, setFamily) {
    const name = setFamily.info.name;
    const label = setFamily.info.label || name;
    if (setFamily instanceof BoolSetFamily) {
        output.push(new Param(name, new CheckBoxWidget(), label));
    }
    else if (setFamily instanceof DagSetFamily) {
        output.push(new Param(name, new SelectWidget(setFamily.values.map(vInfo => new SelectOption(vInfo.name, vInfo.name, vInfo.label || vInfo.name)), setFamily.defVal), label));
    }
    else if (setFamily instanceof ProdSetFamily) {
        for (const part of setFamily.parts) {
            addSfParams(output, part);
        }
    }
}
function addPredParams(output, preds) {
    for (const pred of preds) {
        output.push(new Param(pred.name, new CheckBoxWidget(true), pred.label || pred.name));
    }
}
function cli(sf, input, f2fInput, stdout, visualizeDot) {
    const predNames = f2fInput.pred;
    const filteredInput = filterInput(input, sf, f2fInput.sf);
    if (predNames.length === 2) {
        const [u, v] = predNames;
        outputPath(filteredInput, u, v, stdout);
        stdout.log();
        outputPath(filteredInput, v, u, stdout);
    }
    if (predNames.length <= 2 && predNames.length >= 1) {
        outputGoodBadReasons(filteredInput, predNames, stdout);
    }
    const dotLines = getDotGraph(filteredInput, predNames, f2fInput.maybe);
    visualizeDot(dotLines.join('\n'));
}
//# sourceMappingURL=web.js.map