import { CircularQueue } from "./queue.mjs";

export interface Edge<T> {
    from: T;
    to: T;
}

export class Graph<T> {
    adj: Map<T, Edge<T>[]>;
    constructor(public edges: Edge<T>[]) {
        this.adj = new Map<T, Edge<T>[]>();
        for(const edge of edges) {
            const u = edge.from;
            const uEdges = this.adj.get(u);
            if(typeof uEdges === 'undefined') {
                this.adj.set(u, [edge]);
            }
            else {
                uEdges.push(edge);
            }
        }
    }

    getReachable(root: T): Map<T, Edge<T>> {
        // Returns all (u, e) pairs, where u is reachable from root, and e is an edge incident to u.
        const pred = new Map<T, Edge<T>>();
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
        return pred;
    }

    getTransitiveClosure(): Edge<T>[] {
        const edges: Edge<T>[] = [];
        for(const u of this.adj.keys()) {
            const uMap = this.getReachable(u);
            for(const v of uMap.keys()) {
                if(u !== v) {
                    edges.push({'from': u, 'to': v});
                }
            }
        }
        return edges;
    }
}
