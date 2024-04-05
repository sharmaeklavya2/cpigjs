import { CircularQueue } from "./queue.mjs";

export interface Edge<T> {
    from: T;
    to: T;
}

export class Graph<T, ET extends Edge<T>> {
    adj: Map<T, ET[]>;
    radj: Map<T, ET[]>;
    outTreeCache: Map<T, Map<T, ET>>;

    constructor(vertices: Iterable<T>, public edges: ET[]) {
        this.adj = new Map();
        this.radj = new Map();
        this.outTreeCache = new Map();
        for(const v of vertices) {
            this.adj.set(v, []);
            this.radj.set(v, []);
        }
        for(const edge of edges) {
            const u = edge.from, v = edge.to;
            const uEdges = this.adj.get(u);
            if(typeof uEdges === 'undefined') {
                throw new Error(`unknown vertex ${u} in edge ${edge}`);
            }
            else {
                uEdges.push(edge);
            }
            const vEdges = this.radj.get(v);
            if(typeof vEdges === 'undefined') {
                throw new Error(`unknown vertex ${v} in edge ${edge}`);
            }
            else {
                vEdges.push(edge);
            }
        }
    }

    getOutTree(root: T): Map<T, ET> {
        // Returns all (u, e) pairs, where u is reachable from root, and e is an edge incident to u.
        let pred = this.outTreeCache.get(root);
        if(pred !== undefined) {
            return pred;
        }
        pred = new Map<T, ET>();
        const queue = new CircularQueue<T>(this.adj.size);
        queue.push(root);
        while(queue.size > 0) {
            const u = queue.pop();
            const uEdges = this.adj.get(u);
            if(typeof uEdges !== 'undefined') {
                for(const edge of uEdges) {
                    const v = edge.to;
                    if(v !== root && !pred.has(v)) {
                        pred.set(v, edge);
                        queue.push(v);
                    }
                }
            }
        }
        this.outTreeCache.set(root, pred);
        return pred;
    }

    getPath(u: T, v: T): ET[] | undefined {
        if (u === v) {
            return [];
        }
        const outTree = this.getOutTree(u);
        if(!outTree.has(v)) {
            return undefined;
        }
        let w = v;
        const edges: ET[] = [];
        while(w !== u) {
            const e = outTree.get(w)!;
            edges.push(e);
            w = e.from;
        }
        return edges.reverse();
    }

    getTransitiveClosure(): Edge<T>[] {
        const edges: Edge<T>[] = [];
        for(const u of this.adj.keys()) {
            const uMap = this.getOutTree(u);
            for(const v of uMap.keys()) {
                if(u !== v) {
                    edges.push({'from': u, 'to': v});
                }
            }
        }
        return edges;
    }
}
