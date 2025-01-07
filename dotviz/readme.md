# viz.js

`viz.js` is a WebAssembly build of [Graphviz](https://graphviz.org/) with a simple JavaScript wrapper.
With `viz.js`, you can easily render a graph diagram as an SVG element to display it in a webpage:

```js
import { instance } from "@viz-js/viz";

instance().then(viz => {
    document.body.appendChild(viz.renderSVGElement("digraph { a -> b }"))
});
```

* Github: [`mdaines/viz-js`](https://github.com/mdaines/viz-js).
* NPM: [`@viz-js/viz`](https://www.npmjs.com/package/@viz-js/viz).
* CDN: <https://cdn.jsdelivr.net/npm/@viz-js/viz@3.4.0/lib/viz-standalone.mjs>.
