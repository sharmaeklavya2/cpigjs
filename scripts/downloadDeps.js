#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const externalDir = join(__dirname, '..', 'external');
const recursiveTrue = {recursive: true};

async function download(url, fpath) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(fpath));
}

async function downloadDir(url, dirPath, fnames) {
    await mkdir(dirPath, recursiveTrue);
    for(const fname of fnames) {
        await download(url + fname, join(dirPath, fname));
    }
}

async function main() {
    await mkdir(externalDir, recursiveTrue);
    await downloadDir('https://sharmaeklavya2.github.io/funcToForm/',
        join(externalDir, 'funcToForm'),
        ['v2.js', 'funcToForm.css']);
    await download('https://cdn.jsdelivr.net/npm/@viz-js/viz@3.4.0/lib/viz-standalone.mjs',
        join(externalDir, 'graphviz.js'));
    await downloadDir('https://sharmaeklavya2.github.io/fd-impls/',
        join(externalDir, 'fd-impls'),
        ['paper.pdf', 'texRefs.json']);
}

await main()
