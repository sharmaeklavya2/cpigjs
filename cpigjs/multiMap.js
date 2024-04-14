export class MultiMap {
    constructor() {
        this.map = new Map;
        this.map = new Map();
    }
    has(k) { return this.map.has(k); }
    getAll(k) {
        const vList = this.map.get(k);
        if (vList === undefined) {
            return [];
        }
        else {
            return vList;
        }
    }
    add(k, v) {
        const vList = this.map.get(k);
        if (vList === undefined) {
            this.map.set(k, [v]);
        }
        else {
            vList.push(v);
        }
    }
    replace(k, vList) {
        if (vList.length > 0) {
            this.map.set(k, vList);
        }
        else {
            this.map.delete(k);
        }
    }
}
//# sourceMappingURL=multiMap.js.map