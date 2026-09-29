import { registerRootComponent } from 'expo';

import { initSentry } from './src/lib/sentry';
import App from './App';

// Mirrors apps/api's instrument.ts / apps/web's instrumentation-client.ts: runs before the app
// module graph (App.tsx and everything it imports) so a startup crash in that graph still reaches
// Sentry. No-op without EXPO_PUBLIC_SENTRY_DSN (src/lib/sentry.ts).
initSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
