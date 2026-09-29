import { registerRootComponent } from 'expo';

import { initSentry } from './src/lib/sentry';

// Mirrors apps/api's instrument.ts / apps/web's instrumentation-client.ts: must run before the
// app module graph (App.tsx and everything it imports, including ErrorBoundary.tsx's own
// @sentry/react-native import) so a startup crash in that graph still reaches Sentry.
//
// cross-model-review (2026-09-29) finding: a static `import App from './App'` above this line
// would NOT achieve that, despite appearing after initSentry() in source order -- Babel/Metro
// compiles ES imports to requires in written order, all BEFORE any of this file's own top-level
// statements run, so './App' (and everything it imports) would already be fully evaluated by the
// time initSentry() executes. A dynamic import defers requiring './App' until after initSentry()
// has actually run.
initSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
//
// require(), not a static `import App from './App'` or a dynamic `import('./App')`: Metro (RN's
// bundler) supports CommonJS require() same as Node, so this synchronously defers evaluating
// './App' until after initSentry() above has actually run -- no dynamic-import/promise machinery
// that Jest can't execute without --experimental-vm-modules (jest-expo's transform).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = require('./App').default;
registerRootComponent(App);
