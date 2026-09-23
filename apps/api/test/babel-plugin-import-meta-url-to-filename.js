// Replaces `import.meta.url` with plain `__filename` (NOT a `require('url')...` call, unlike
// babel-plugin-transform-import-meta's default). This project's own dependencies only use
// `import.meta.url` for one thing -- `const require = createRequire(import.meta.url)`, an
// optional-peer-dependency loader that several @nestjs/* packages ship (swagger's swagger-ui.js,
// mapped-types' type-helpers.utils.js, ...) now that Nest 12 is pure ESM. Node's `createRequire`
// accepts a plain absolute path string just as well as a file:// URL (see Node docs:
// `filename <string> | <URL>`), so this is behaviorally equivalent for that one call site.
//
// Using a text-substitution plugin that emits a fresh `require(...)` call there is what breaks:
// after @babel/plugin-transform-modules-commonjs renames the source's own `const require = ...`
// to avoid shadowing the CJS-injected `require`, the SAME rename sweeps up that inserted
// `require('url')` call too (same identifier, same scope, same pass), producing a
// self-referential `const _require = fn(_require('url')...)` -- "Cannot access before
// initialization". `__filename` shares no identifier with `require`, so it can't collide.
//
// Scoped to `createRequire(import.meta.url)` specifically (cross-model review finding, 2026-09-23):
// `__filename` and a real `import.meta.url` (a `file://...` URL, not a plain path) aren't
// interchangeable in general -- `new URL("./x", import.meta.url)` or `fileURLToPath(import.meta.url)`
// would silently misbehave under this substitution. `createRequire` is the one call this project's
// dependencies are confirmed to use `import.meta.url` for (verified against the actual source of
// every @nestjs/* package this un-ignores), and it's documented to accept a plain absolute path
// string just as well as a file:// URL -- so only that specific call site is rewritten, and
// anything else keeps using the real `import.meta.url` untouched (and would surface its own clear
// "Cannot use import.meta outside a module" error if a future dependency needs it, rather than
// silently getting a wrong value).
module.exports = function importMetaUrlToFilename({ types: t }) {
  return {
    visitor: {
      MemberExpression(path) {
        const { object, property } = path.node;
        if (
          object.type !== "MetaProperty" ||
          object.meta.name !== "import" ||
          object.property.name !== "meta" ||
          property.name !== "url"
        ) {
          return;
        }
        const call = path.parentPath;
        const isSoleArgOfCreateRequire =
          call.isCallExpression() &&
          call.node.callee.type === "Identifier" &&
          call.node.callee.name === "createRequire" &&
          call.node.arguments.length === 1 &&
          call.node.arguments[0] === path.node;
        if (!isSoleArgOfCreateRequire) return;
        path.replaceWith(t.identifier("__filename"));
      },
    },
  };
};
