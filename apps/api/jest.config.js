const path = require('path');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  setupFiles: ['<rootDir>/test/env-defaults.setup.ts'],
  // Every e2e-spec assumes a District (and its City) already exists in the test database --
  // nothing else in the pipeline ever creates one. Runs once, before any test file.
  globalSetup: '<rootDir>/test/global-setup.js',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    // NestJS 12 ships `@nestjs/*` as pure ESM ("type": "module", no CJS build) -- Node 22's
    // native require(esm) interop makes the COMPILED APP boot fine (verified: dist/main.js runs,
    // /health returns 200), but jest's own CJS module system doesn't use that path and fails to
    // parse the bare `import`/`export` statements. ts-jest doesn't transform plain `.js` (needs
    // `allowJs`, which this project's tsconfig doesn't set), so un-ignored node_modules `.js`
    // (below) goes through babel-jest instead, just to strip ESM syntax to CommonJS.
    // `<rootDir>` isn't expanded inside custom transform options (only in a handful of jest's own
    // known config fields) -- an absolute path is required here.
    '^.+\\.js$': ['babel-jest', { configFile: path.join(__dirname, 'babel.jest.config.js') }],
  },
  // pnpm's `.pnpm` virtual store nests every package under its own `node_modules/`
  // (`node_modules/.pnpm/@nestjs+testing@12.1.0.../node_modules/@nestjs/testing/...`) -- the
  // usual `node_modules/(?!@nestjs/)` pattern matches (and ignores) the OUTER `.pnpm` segment
  // before ever reaching the inner one, so pnpm needs the pnpm-encoded (`@nestjs+`) package name
  // matched directly against the `.pnpm/` segment instead.
  transformIgnorePatterns: ['node_modules/\\.pnpm/(?!(@nestjs\\+|@fastify\\+multipart@))'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: '../../../coverage/apps/api',
  testEnvironment: 'node',
};
