function cartProdArrayHelper(a: readonly unknown[][], prefix: readonly unknown[], output: (readonly unknown[])[]): void {
    // Compute the cartesian product of a[prefix.length:].
    // Then add suffix to each of them and append them to output.
    const n = prefix.length;
    if(prefix.length === a.length) {
        output.push(prefix);
    }
    else {
        for(const x of a[n]) {
            const prefix2 = [...prefix, x];
            cartProdArrayHelper(a, prefix2, output);
        }
    }
}

export function cartProdArray(a: readonly unknown[][]): unknown[][] {
    const output: any[][] = [];
    cartProdArrayHelper(a, [], output);
    return output;
}

export function cartProdObject(a: Record<string, unknown>): Record<string, unknown>[] {
    const keys: string[] = [], values: unknown[][] = [];
    for(const [k, v] of Object.entries(a)) {
        keys.push(k);
        if(Array.isArray(v)) {
            values.push(v);
        }
        else {
            values.push([v]);
        }
    }
    const cArr = cartProdArray(values);
    const output: Record<string, unknown>[] = [];
    for(const b of cArr) {
        const kvPairs = b.map((x, i) => [keys[i], x]);
        output.push(Object.fromEntries(kvPairs));
    }
    return output;
}
