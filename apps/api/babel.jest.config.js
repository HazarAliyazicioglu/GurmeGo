// Used ONLY by jest, ONLY for `.js` files under node_modules (see jest.config.js) -- strips the
// ESM `import`/`export` syntax that NestJS 12's `@nestjs/*` packages ship ("type": "module", no
// CJS build) down to CommonJS `require`, since jest's own module system can't load ESM directly.
// The compiled app itself doesn't need this: Node 22's native require(esm) interop already
// handles it there (verified against the real dist/main.js).
module.exports = {
  // `import.meta.url` (used by several @nestjs/* packages' optional-peer-dependency loader, e.g.
  // `const require = createRequire(import.meta.url)`) isn't an import/export statement, so the
  // commonjs transform alone doesn't touch it -- needs its own plugin. See
  // babel-plugin-import-meta-url-to-filename.js for why that's a small custom plugin instead of
  // the (more thorough, but broken for this exact idiom) community babel-plugin-transform-import-meta.
  plugins: [
    "@babel/plugin-transform-modules-commonjs",
    require("./test/babel-plugin-import-meta-url-to-filename.js"),
  ],
};
