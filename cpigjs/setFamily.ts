import { Edge, Graph } from "./graph.js";

export interface Info {
    name: string;
    label?: string;
    text?: string;
    link?: string;
}

export class SetFamily {
    constructor(public info: Info) {}

    toString(): string {
        return ['SetFamily', '(', this.info.name, ')'].join('');
    }

    static fromJson(obj: any): SetFamily {
        const typeName = obj.type;
        if(typeName === 'dag') {
            return DagSetFamily.fromJson(obj as any);
        }
        else if(typeName === 'bool') {
            return BoolSetFamily.fromJson(obj as any);
        }
        else if(typeName == 'prod') {
            return ProdSetFamily.fromJson(obj as any);
        }
        else {
            throw new Error(`unrecognized type ${typeName}`);
        }
    }

    canonicalize(x: unknown): Object {
        throw new Error('SetFamily.canonicalize is not implemented');
    }

    serialize(x: unknown): string {
        throw new Error('SetFamily.serialize is not implemented');
    }

    prettify(x: unknown): unknown {
        return x;
    }

    contains(a: unknown, b: unknown): boolean {
        throw new Error('SetFamily.contains is not implemented');
    }
}

export class BoolSetFamily extends SetFamily {
    constructor(info: Info) {
        super(info);
    }

    static fromJson(obj: {info: Info}) {
        return new BoolSetFamily(obj.info);
    }

    canonicalize(x: unknown): boolean {
        if(typeof x === 'undefined' || x === null) {
            return false;
        }
        else if(typeof x === 'boolean') {
            return x;
        }
        else {
            throw new Error('expected a boolean | null | undefined');
        }
    }

    serialize(x: boolean): string {
        return x ? '1' : '0';
    }

    contains(a: boolean, b: boolean): boolean {
        return (!a) || b;
    }
}

type sspair = [string, string];

function pairToEdge(p: sspair): Edge<string> {
    return {from: p[0], to: p[1]};
}

export class DagSetFamily extends SetFamily {
    nameToValue: Map<string, Info>;
    containments: Set<string>;

    constructor(info: Info, public defVal: string, public values: Info[], containments: sspair[]) {
        super(info);
        this.nameToValue = new Map(values.map((info: Info) => [info.name, info]));
        const edges = containments.map(pairToEdge);
        const graph = Graph.fromVE(this.nameToValue.keys(), edges);
        const trEdges = graph.trClosure();
        this.containments = new Set(trEdges.map((e: Edge<string>) => e.from + ',' + e.to));
    }

    static fromJson(obj: {info: Info, default: string, values: Info[], containments: sspair[]}) {
        return new DagSetFamily(obj.info, obj.default, obj.values, obj.containments);
    }

    canonicalize(x: unknown): string {
        if(typeof x === 'undefined' || x === null) {
            return this.defVal;
        }
        else if(typeof x === 'string') {
            if(this.nameToValue.has(x)) {
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

    serialize(x: string): string {
        return x;
    }

    contains(a: string, b: string): boolean {
        return a === b || this.containments.has(a + "," + b);
    }
}

export class ProdSetFamily extends SetFamily {
    constructor(info: Info, public parts: SetFamily[]) {
        super(info);
    }

    toString(): string {
        return ['ProdSetFamily(', this.info.name, ', parts=[', this.parts ,'])'].join('');
    }

    static fromJson(obj: {info: Info, parts: unknown[]}): ProdSetFamily {
        const parts = obj.parts.map((partObj: unknown) => SetFamily.fromJson(partObj));
        return new ProdSetFamily(obj.info, parts);
    }

    canonicalize(x: any): Object[] {
        if(Array.isArray(x)) {
            if(x.length != this.parts.length) {
                throw new Error(`input to ProdSetFamily(${this.info.name}) has`
                    + ` length ${x.length} instead of ${this.parts.length}`);
            }
            return this.parts.map((part, i) => part.canonicalize(x[i]));
        }
        else if(x instanceof Object) {
            return this.parts.map((part: SetFamily) => part.canonicalize(x[part.info.name]));
        }
        else {
            throw new Error('incorrect type for ProdSetFamily');
        }
    }

    prettify(x: Array<unknown>): Object {
        const d: Record<string, unknown> = {};
        const n = this.parts.length;
        for(let i=0; i < n; ++i) {
            d[this.parts[i].info.name] = x[i];
        }
        return d;
    }

    serialize(x: Array<unknown>): string {
        return this.parts.map((part: SetFamily, i: number) => part.serialize(x[i])).join('-');
    }

    contains(a: any, b: any): boolean {
        const n = this.parts.length;
        for(let i=0; i < n; ++i) {
            if(!this.parts[i].contains(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
}
