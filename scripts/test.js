import { Graph } from "../code/graph.js";
import { cartProdArray, cartProdObject } from "../code/cartProd.js";
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

describe('cartProd', () => {
    it('works for array of singletons', () => {
        const a = [[10], [20], ['hello']];
        const output = cartProdArray(a);
        const expected = [[10, 20, 'hello']];
        assert.deepStrictEqual(output, expected);
    });
    it('works for singleton', () => {
        const a = [[10, 20, 30]];
        const output = cartProdArray(a);
        const expected = [[10], [20], [30]];
        assert.deepStrictEqual(output, expected);
    });
    it('works for 2-by-2', () => {
        const a = [['big', 'small'], ['house', 'car']];
        const output = cartProdArray(a);
        const expected = [['big', 'house'], ['big', 'car'], ['small', 'house'], ['small', 'car']];
        assert.deepStrictEqual(output, expected);
    });
    it('works for an empty member', () => {
        const a = [['big', 'small'], [], ['house', 'car']];
        const output = cartProdArray(a);
        assert.deepStrictEqual(output, []);
    });
    it('works for objects', () => {
        const a = {'size': ['big', 'small'], 'color': 'red', 'thing': ['house', 'car']};
        const output = cartProdObject(a);
        const expected = [
            {'size': 'big', 'color': 'red', 'thing': 'house'},
            {'size': 'big', 'color': 'red', 'thing': 'car'},
            {'size': 'small', 'color': 'red', 'thing': 'house'},
            {'size': 'small', 'color': 'red', 'thing': 'car'},
        ];
        assert.deepStrictEqual(output, expected);
    });
});
