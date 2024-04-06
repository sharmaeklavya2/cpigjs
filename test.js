import { Graph } from "./cpigjs/graph.js";
import assert from 'assert';

function pairsToEdges(pairs) {
    return pairs.map(function([x, y]) {return {from: x, to: y};});
}

describe('Graph', () => {
    it('trCompression', () => {
        const graph = Graph.fromVE([0, 1, 2, 3, 4, 5], pairsToEdges([
            [0, 1], [1, 0], [1, 3],
            [2, 3], [3, 2], [2, 4],
            [4, 5], [5, 4]]));
        const {scc, dag} = graph.trCompression([4, 5, 0, 1]);
        assert.deepStrictEqual(Array.from(scc.keys()), [0, 4]);
        assert.deepStrictEqual(scc, new Map([[0, [0, 1]], [4, [4, 5]]]));
        assert.deepStrictEqual(dag.edges, pairsToEdges([[0, 4]]));
    });

    it('trRed', () => {
        const graph = Graph.fromVE(["a", "b", "c", "d", "e", "f"], pairsToEdges([
            ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"],
            ["b", "d"], ["b", "e"], ["c", "d"], ["d", "e"]]));
        const redGraph = graph.trRed();
        assert.deepStrictEqual(redGraph.edges, pairsToEdges([
            ["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"], ["d", "e"]]));
    });
});
