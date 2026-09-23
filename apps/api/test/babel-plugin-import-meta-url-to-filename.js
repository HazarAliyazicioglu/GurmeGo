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
module.exports = function importMetaUrlToFilename({ types: t }) {
  return {
    visitor: {
      MemberExpression(path) {
        const { object, property } = path.node;
        if (
          object.type === "MetaProperty" &&
          object.meta.name === "import" &&
          object.property.name === "meta" &&
          property.name === "url"
        ) {
          path.replaceWith(t.identifier("__filename"));
        }
      },
    },
  };
};
