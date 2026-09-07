// react-native-maps ships a native module (RNMapsAirModule) that isn't registered in the Jest
// environment (no real iOS/Android runtime backs the tests). Any test that imports a module
// which transitively imports "react-native-maps" (e.g. App.spec.tsx -> RootNavigator ->
// VenueDetailScreen) needs this manual mock, not just tests that render VenueDetailScreen
// directly. Jest picks this file up automatically for every require("react-native-maps") in
// tests because it lives at <rootDir>/__mocks__/react-native-maps.js (the standard convention
// for mocking a node_modules package).
const { View } = require("react-native");

module.exports = {
  __esModule: true,
  default: View,
  Marker: View,
};
