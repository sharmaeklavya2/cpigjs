import { Graph } from "./cpigjs/graph.mjs";
import assert from 'assert';

function pairsToEdges(pairs) {
    return pairs.map(function([x, y]) {return {from: x, to: y};});
}

describe('Graph.getTransitiveCompression', () => {
    it('test1', () => {
        const graph = new Graph([0, 1, 2, 3, 4, 5], pairsToEdges([
            [0, 1], [1, 0], [1, 3],
            [2, 3], [3, 2], [2, 4],
            [4, 5], [5, 4]]));
        const {scc, dag} = graph.getTransitiveCompression([0, 1, 4, 5]);
        assert.deepStrictEqual(scc, new Map([[0, [0, 1]], [4, [4, 5]]]));
        assert.deepStrictEqual(dag.edges, pairsToEdges([[0, 4]]));
    });
});
