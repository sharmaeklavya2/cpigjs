export class MultiMap<K, V> {
    map = new Map<K, V[]>;
    constructor() {
        this.map = new Map();
    }

    has(k: K): boolean {return this.map.has(k);}

    getAll(k: K): V[] {
        const vList = this.map.get(k);
        if(vList === undefined) {
            return [];
        }
        else {
            return vList;
        }
    }

    add(k: K, v: V): void {
        const vList = this.map.get(k);
        if(vList === undefined) {
            this.map.set(k, [v]);
        }
        else {
            vList.push(v);
        }
    }

    replace(k: K, vList: V[]): void {
        if(vList.length > 0) {
            this.map.set(k, vList);
        }
        else {
            this.map.delete(k);
        }
    }
}
