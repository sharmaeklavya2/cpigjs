import { Graph } from "./graph.js";
export class SetFamily {
    constructor(info) {
        this.info = info;
    }
    toString() {
        return ['SetFamily', '(', this.info.name, ')'].join('');
    }
    static fromJson(obj) {
        const typeName = obj.type;
        if (typeName === 'dag') {
            return DagSetFamily.fromJson(obj);
        }
        else if (typeName === 'bool') {
            return BoolSetFamily.fromJson(obj);
        }
        else if (typeName == 'prod') {
            return ProdSetFamily.fromJson(obj);
        }
        else {
            throw new Error(`unrecognized type ${typeName}`);
        }
    }
    canonicalize(x) {
        throw new Error('SetFamily.canonicalize is not implemented');
    }
    prettify(x) {
        return x;
    }
    contains(a, b) {
        throw new Error('SetFamily.contains is not implemented');
    }
}
export class BoolSetFamily extends SetFamily {
    constructor(info) {
        super(info);
    }
    static fromJson(obj) {
        return new BoolSetFamily(obj.info);
    }
    canonicalize(x) {
        if (typeof x === 'undefined' || x === null) {
            return false;
        }
        else if (typeof x === 'boolean') {
            return x;
        }
        else {
            throw new Error('expected a boolean | null | undefined');
        }
    }
    contains(a, b) {
        return (!a) || b;
    }
}
function pairToEdge(p) {
    return { from: p[0], to: p[1] };
}
export class DagSetFamily extends SetFamily {
    constructor(info, defVal, values, containments) {
        super(info);
        this.defVal = defVal;
        this.values = values;
        this.nameToValue = new Map(values.map((info) => [info.name, info]));
        const edges = containments.map(pairToEdge);
        const graph = Graph.fromVE(this.nameToValue.keys(), edges);
        const trEdges = graph.trClosure();
        this.containments = new Set(trEdges.map((e) => e.from + ',' + e.to));
    }
    static fromJson(obj) {
        return new DagSetFamily(obj.info, obj.default, obj.values, obj.containments);
    }
    canonicalize(x) {
        if (typeof x === 'undefined' || x === null) {
            return this.defVal;
        }
        else if (typeof x === 'string') {
            if (this.nameToValue.has(x)) {
                return x;
            }
            else {
                throw new Error(`unknown value ${x} for DagSetFamily(${this.info.name})`);
            }
        }
        else {
            throw new Error('expected a string | null | undefined');
        }
    }
    contains(a, b) {
        return a === b || this.containments.has(a + "," + b);
    }
}
export class ProdSetFamily extends SetFamily {
    constructor(info, parts) {
        super(info);
        this.parts = parts;
    }
    toString() {
        return ['ProdSetFamily(', this.info.name, ', parts=[', this.parts, '])'].join('');
    }
    static fromJson(obj) {
        const parts = obj.parts.map((partObj) => SetFamily.fromJson(partObj));
        return new ProdSetFamily(obj.info, parts);
    }
    canonicalize(x) {
        if (Array.isArray(x)) {
            if (x.length != this.parts.length) {
                throw new Error(`input to ProdSetFamily(${this.info.name}) has`
                    + ` length ${x.length} instead of ${this.parts.length}`);
            }
            return this.parts.map((part, i) => part.canonicalize(x[i]));
        }
        else if (x instanceof Object) {
            return this.parts.map((part) => part.canonicalize(x[part.info.name]));
        }
        else {
            throw new Error('incorrect type for ProdSetFamily');
        }
    }
    prettify(x) {
        const d = {};
        const n = this.parts.length;
        for (let i = 0; i < n; ++i) {
            d[this.parts[i].info.name] = x[i];
        }
        return d;
    }
    contains(a, b) {
        const n = this.parts.length;
        for (let i = 0; i < n; ++i) {
            if (!this.parts[i].contains(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
}
//# sourceMappingURL=setFamily.js.map