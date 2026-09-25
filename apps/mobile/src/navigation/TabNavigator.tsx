import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import DiscoveryScreen from "../screens/DiscoveryScreen";
import FavoritesScreen from "../screens/FavoritesScreen";

export type TabParamList = {
  Discovery: undefined;
  Favoriler: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Denetim raporu (2026-09-25) "tabBarIcon yok": text-only tab labels gave no at-a-glance visual
// affordance. Plain glyphs, not @expo/vector-icons -- no icon-set dependency is installed yet and
// the app has no design token/icon system at all (tracked separately); real icons land with that
// pass, this just closes the "no icon at all" gap now.
const TAB_ICONS: Record<keyof TabParamList, string> = {
  Discovery: "📍",
  Favoriler: "♥",
};

export default function TabNavigator() {
  return (
    // headerShown: false — each tab screen's own header would otherwise duplicate the tab bar
    // label as a second on-screen "Mekanlar"/"Favoriler" text node (discovered via the
    // TabNavigator.spec.tsx / App.spec.tsx tests below going from single-match to
    // "Found multiple elements" once tabs were introduced). VenueDetail/Auth get their headers
    // from the parent Stack.Navigator instead.
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Discovery"
        component={DiscoveryScreen}
        options={{
          title: "Mekanlar",
          tabBarIcon: ({ focused }) => (
            <Text testID="tab-icon-Discovery" style={{ opacity: focused ? 1 : 0.5 }}>
              {TAB_ICONS.Discovery}
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="Favoriler"
        component={FavoritesScreen}
        options={{
          title: "Favoriler",
          tabBarIcon: ({ focused }) => (
            <Text testID="tab-icon-Favoriler" style={{ opacity: focused ? 1 : 0.5 }}>
              {TAB_ICONS.Favoriler}
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
