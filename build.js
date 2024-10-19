// @ts-check
import compat from "core-js-compat";
import { rollup } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import virtual from "@rollup/plugin-virtual";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import pkg from "./package.json" assert { type: "json" };
import * as pathSafe from "./pathEncode.js";
import { parse } from "acorn";
import assert from "node:assert";
import { generate } from "astring";
import terser from "@rollup/plugin-terser";

rmSync("dist", { recursive: true, force: true });

const allStable = compat({ modules: ["core-js/stable"] }).list.filter((e) => {
  const compatData = compat.data[e];
  const keep =
    e === "web.structured-clone" ||
    // this is the only thing making modern chrome need a polyfill,
    // skip it
    (e !== "web.dom-exception.stack" &&
      // only polyfill things that a browser has shipped pls thx
      Boolean(
        compatData.chrome ||
          compatData.firefox ||
          compatData.safari ||
          compatData.edge ||
          compatData.ios ||
          compatData["chrome-android"] ||
          compatData["firefox-android"],
      ));
  if (!keep) console.warn("skipping", e);
  return keep;
});
const modern = compat({
  targets:
    "last 4 years and not dead and not chrome > 0 and not opera > 0 and not firefox > 0 and not samsung > 0 and not and_chr > 0 and not and_ff > 0 and not edge > 0, last 5 chrome versions, last 5 opera versions, last 5 firefox versions, last 5 samsung versions, last 5 and_chr versions, last 5 and_ff versions, last 5 edge versions, firefox esr",
}).list.filter((e) => allStable.includes(e));
const legacy = allStable.filter((e) => !modern.includes(e));

let tests;
{
  const testUrl = `https://raw.githubusercontent.com/zloirock/core-js/refs/tags/v${pkg.devDependencies["core-js"]}/tests/compat/tests.js`;
  const cacheUrl = new URL(
    "node_modules/.cache/polyp/" + encodeURIComponent(pathSafe.encode(testUrl)),
    import.meta.url,
  );
  if (statSync(cacheUrl, { throwIfNoEntry: false })?.isFile()) {
    tests = readFileSync(cacheUrl, "utf-8");
  } else {
    tests = await (await fetch(testUrl)).text();
    mkdirSync(new URL(".", cacheUrl), { recursive: true });
    writeFileSync(cacheUrl, tests, "utf-8");
  }
}

const testAst = parse(tests, {
  ecmaVersion: "latest",
});
const checks = {};
testAst.body = testAst.body.flatMap((node) => {
  if (
    node.type === "VariableDeclaration" &&
    node.declarations.length === 1 &&
    node.declarations[0].id.type === "Identifier" &&
    node.declarations[0].id.name === "GLOBAL"
  ) {
    return [];
  }
  if (
    node.type === "ExpressionStatement" &&
    node.expression.type === "AssignmentExpression" &&
    node.expression.operator === "=" &&
    node.expression.left.type === "MemberExpression" &&
    node.expression.left.object.type === "Identifier" &&
    node.expression.left.object.name === "GLOBAL" &&
    node.expression.left.property.type === "Identifier" &&
    node.expression.left.property.name === "tests"
  ) {
    const object = node.expression.right;
    assert(object.type === "ObjectExpression");
    for (const prop of object.properties) {
      assert(prop.type === "Property");
      assert(prop.key.type === "Literal");
      assert(typeof prop.key.value === "string");
      const module = prop.key.value;
      const check = prop.value;
      checks[module] =
        check.type === "ArrayExpression"
          ? check.elements.flatMap((check) => {
              if (!check) return [];
              let code = generate(check);
              return code;
            })
          : [generate(check)];

      if (module === "web.structured-clone") {
        checks[module] = checks[module].map((code) =>
          code
            .replace(
              "checkErrorsCloning(structuredClone, DOMException)",
              "true",
            )
            .replace("checkNewErrorsCloningSemantic(structuredClone)", "true"),
        );
      }
    }
    return [];
  }
  return node;
});
const detectionPrefix = generate(testAst);
const checkMap = {};
for (const module of allStable) {
  if (checks[module]) {
    checkMap[module] = [checks[module]].flat();
  } else {
    checkMap[module] = Object.keys(checks)
      .filter((key) => key.startsWith(module + "."))
      .flatMap((module) => checks[module]);
  }
}

const imports = (e) => e.map((e) => `import "core-js/modules/${e}";`).join("");
const checkFile = (modules, toImport) => `
  import GLOBAL from "core-js/internals/global-this"
  ${detectionPrefix}
  function needsPolyfill(tests) {
    for(var i = 0; i < tests.length; i++) {
      var test = tests[i];
      try {
        if(!(typeof test == 'function' ? !!test() : test.every(function (subTest) {
          return subTest();
        }))) {
          return true;
        }
      } catch (error) {
        return true
      }
    }
  }
  export default needsPolyfill([${[
    ...new Set(modules.flatMap((module) => checkMap[module])),
  ].join(
    ",",
  )}]) ? import("./${toImport}").then(function(module){return module.default}) : Promise.resolve()
`;
const a = await rollup({
  input: ["index.js"],
  plugins: [
    virtual({
      "index.js": checkFile(modern, "modern.js"),
      "modern.js": imports(modern) + checkFile(legacy, "legacy.js"),
      "legacy.js": imports(legacy),
    }),
    nodeResolve(),
    commonjs({
      strictRequires: false,
    }),
    terser(),
  ],
});

await a.write({
  format: "esm",
  dir: "dist",
  entryFileNames: (a) => (a.facadeModuleId || "").split(":")[1],
  chunkFileNames: "chunk-[hash].js",
});
/*await writeFile(
  "dist/snippet.html",
  String.raw`<script type="module">await import("").catch((_=>_)),window.__full_esm__=!0;</script><script>document.addEventListener("DOMContentLoaded",(function(){if(window.__full_esm__&&!function(){var e="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof DataView&&!(!Object.setPrototypeOf&&!("__proto__"in{}));function n(e){try{return!!e()}catch(e){return!0}}if(!Function.prototype.bind)return!0;var t=Function.prototype.call,r=t.bind(t);if(n((function(){return!Array(1).includes()})))return!0;var o=globalThis.Int8Array,u=o&&o.prototype,i=u&&u.set;return!!n((function(){var e=0;return new o(2).fill({valueOf:function(){return e++}}),1!==e}))||(!!n((function(){var e=new Uint8ClampedArray(2);return r(i,e,{length:1,0:3},1),3!==e[1]}))||!(!e||!n((function(){var e=new o(2);return e.set(1),e.set("2",1),0!==e[0]||2!==e[1]}))))}()){delete window.__full_esm__;const e=document.createElement("script");e.type="module",e.src="__MODERN__",document.head.appendChild(e)}else{const e=document.createElement("script");e.src="__LEGACY__",document.head.appendChild(e)}}));</script>`,
  "utf-8"
);*/
