import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import DiscoveryScreen from "../screens/DiscoveryScreen";
import FavoritesScreen from "../screens/FavoritesScreen";

export type TabParamList = {
  Discovery: undefined;
  Favoriler: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    // headerShown: false — each tab screen's own header would otherwise duplicate the tab bar
    // label as a second on-screen "Mekanlar"/"Favoriler" text node (discovered via the
    // TabNavigator.spec.tsx / App.spec.tsx tests below going from single-match to
    // "Found multiple elements" once tabs were introduced). VenueDetail/Auth get their headers
    // from the parent Stack.Navigator instead.
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Discovery" component={DiscoveryScreen} options={{ title: "Mekanlar" }} />
      <Tab.Screen name="Favoriler" component={FavoritesScreen} options={{ title: "Favoriler" }} />
    </Tab.Navigator>
  );
}
