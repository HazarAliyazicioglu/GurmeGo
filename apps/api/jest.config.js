module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  setupFiles: ['<rootDir>/test/env-defaults.setup.ts'],
  // Every e2e-spec assumes a District (and its City) already exists in the test database --
  // nothing else in the pipeline ever creates one. Runs once, before any test file.
  globalSetup: '<rootDir>/test/global-setup.js',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: '../../../coverage/apps/api',
  testEnvironment: 'node',
};
