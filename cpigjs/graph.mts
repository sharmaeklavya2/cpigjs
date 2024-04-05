import { CircularQueue } from "./queue.mjs";

export interface Edge<T> {
    from: T;
    to: T;
}

export class Graph<T, ET extends Edge<T>> {
    outTreeCache: Map<T, Map<T, ET>>;

    constructor(public adj: Map<T, ET[]>, public radj: Map<T, ET[]>, public edges: ET[]) {
        this.outTreeCache = new Map();
    }

    static fromVE<T, ET extends Edge<T>>(vertices: Iterable<T>, edges: ET[]): Graph<T, ET> {
        const adj = new Map<T, ET[]>();
        const radj = new Map<T, ET[]>();
        for(const v of vertices) {
            adj.set(v, []);
            radj.set(v, []);
        }
        for(const edge of edges) {
            const u = edge.from, v = edge.to;
            const uEdges = adj.get(u);
            if(typeof uEdges === 'undefined') {
                throw new Error(`unknown vertex ${u} in edge ${edge}`);
            }
            else {
                uEdges.push(edge);
            }
            const vEdges = radj.get(v);
            if(typeof vEdges === 'undefined') {
                throw new Error(`unknown vertex ${v} in edge ${edge}`);
            }
            else {
                vEdges.push(edge);
            }
        }
        return new Graph(adj, radj, edges);
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

    trClosure(): Edge<T>[] {
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

    trCompression(S: Iterable<T> | undefined, toposort: boolean = true):
            {scc: Map<T, T[]>, dag: Graph<T, Edge<T>>} {
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

        let sccMap = new Map<T, T[]>();
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
        const newAdj = new Map<T, T[]>();
        for(const u of sccMap.keys()) {
            const uAdj: T[] = [];
            newAdj.set(u, uAdj);
            const rFromU = this.getOutTree(u);
            for(const v of sccMap.keys()) {
                if(rFromU.has(v)) {
                    newEdges.push({'from': u, 'to': v});
                    uAdj.push(v);
                }
            }
        }

        const vertices = Array.from(newAdj.keys());
        if(toposort) {
            const endTime = new Map<T, number>();
            for(const u of vertices) {
                endTime.set(u, -1);
            }
            let time = 0;
            function visit(u: T) {
                if(endTime.get(u)! < 0) {
                    for(const v of newAdj.get(u)!) {
                        visit(v);
                    }
                    endTime.set(u, time++);
                }
            }
            for(const u of vertices) {
                visit(u);
            }
            vertices.sort((u: T, v: T) => endTime.get(v)! - endTime.get(u)!);
            const newSccMap = new Map();
            for(const u of vertices) {
                newSccMap.set(u, sccMap.get(u));
            }
            sccMap = newSccMap;
        }

        return {scc: sccMap, dag: Graph.fromVE(vertices, newEdges)};
    }

    trRed(): Graph<T, ET> {
        // compute the transitive reduction of `this` assuming `this` is a toposorted DAG.
        const vertices = Array.from(this.adj.keys());
        const n = vertices.length;
        const redEdges = [];
        for(let i=0; i<n; ++i) {
            const u = vertices[i];
            const dist = new Map<T, number>();
            for(let j=0; j<n; ++j) {
                dist.set(vertices[j], -Infinity);
            }
            dist.set(u, 0);
            for(let j=i+1; j<n; ++j) {
                const v = vertices[j];
                for(const e of this.radj.get(v)!) {
                    dist.set(v, Math.max(dist.get(v)!, dist.get(e.from)! + 1));
                }
            }
            for(const e of this.adj.get(u)!) {
                if(dist.get(e.to) === 1) {
                    redEdges.push(e);
                }
            }
        }
        return Graph.fromVE(vertices, redEdges);
    }
}
