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

    getTransitiveCompression(S: Iterable<T> | undefined): {scc: Map<T, T[]>, dag: Graph<T, Edge<T>>} {
        // equivalent to doing the following sequence of operations:
        // 1.  compute the transitive closure
        // 2.  get the subgraph induced on S (the entire graph if S === undefined)
        // 3.  do a strongly-connected-component compression
        const v2i = new Map<T, number>();
        const sccLeader = new Map<T, T>();
        if(S === undefined) {
            S = this.adj.keys();
        }
        let i=0;
        for(const u of S) {
            v2i.set(u, i);
            sccLeader.set(u, u);
            i++;
        }

        // The following block computes sccLeader correctly because when the first member u
        // of an SCC is considered, each member v of the SCC gets u as their leader.
        for(const u of v2i.keys()) {
            if(sccLeader.get(u) === u) {
                const rFromU = this.getOutTree(u);
                for(const v of rFromU.keys()) {
                    const ui = v2i.get(u)!, vi = v2i.get(v)!;
                    const rFromV = this.getOutTree(v);
                    if(rFromV.has(u)) {
                        sccLeader.set(v, u);
                    }
                }
            }
        }

        const sccMap = new Map<T, T[]>();
        for(const [follower, leader] of sccLeader.entries()) {
            const fList = sccMap.get(leader);
            if(fList === undefined) {
                sccMap.set(leader, [follower]);
            }
            else {
                fList.push(follower);
            }
        }

        const newEdges = [];
        for(const u of sccMap.keys()) {
            const rFromU = this.getOutTree(u);
            for(const v of sccMap.keys()) {
                if(rFromU.has(v)) {
                    newEdges.push({'from': u, 'to': v});
                }
            }
        }
        return {scc: sccMap, dag: new Graph(sccMap.keys(), newEdges)};
    }
}
