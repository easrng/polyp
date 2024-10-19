<h1><img src="assets/banner.png?1" alt="polyp" width="100%"></h1>
<h2 align="center">Load polyfills as needed</h2>

Polyp polyfills all stable web platform features (anything in `core-js/stable` that's shipping in at least one browser) while only addding about 4 kB of feature detection code to your bundle. This works because Polyp dynamically imports polyfills only if an out-of-date environment is detected. Polyp loads polyfills in stages. Up-to-date browsers won't load polyfills at all, and browsers that are just a few versions behind won't need to load every polyfill.

### Install

```sh
npm i polyp
```

### Usage

```js
import polyfillsReady from "polyp";
polyfillsReady.then(() => {
  // Use new web features :D
});
```
