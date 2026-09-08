import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import DiscoveryScreen from "../screens/DiscoveryScreen";
import MapScreen from "../screens/MapScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import { colors } from "../theme";

export type TabParamList = {
  Discovery: undefined;
  Harita: undefined;
  Favoriler: undefined;
};

// material-top-tabs (not bottom-tabs) specifically because it's the one React Navigation tab
// navigator that supports swipe-between-tabs out of the box (react-native-tab-view underneath);
// `tabBarPosition: "bottom"` below is what makes it LOOK like an ordinary bottom tab bar despite
// the different package. See docs/superwers... (no separate design doc -- this was decided in
// chat after real-device feedback asked for swipe navigation between Mekanlar/Harita/Favoriler).
const Tab = createMaterialTopTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      // Each tab screen only mounts once it's first focused, matching bottom-tabs' own default
      // lazy behavior this project's tests already rely on (a screen's own content -- e.g.
      // FavoritesScreen's placeholder text -- must be absent until that tab is actually focused,
      // not just declared).
      screenOptions={{
        lazy: true,
        tabBarActiveTintColor: colors.accentDeep,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.paperCard, borderTopWidth: 1, borderTopColor: colors.line, elevation: 0, shadowOpacity: 0 },
        tabBarIndicatorStyle: { height: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", textTransform: "none" },
        tabBarPressColor: "transparent",
      }}
    >
      <Tab.Screen name="Discovery" component={DiscoveryScreen} options={{ title: "Mekanlar" }} />
      {/* MapView captures its own pan gesture, so while Harita is the focused screen a finger
          drag pans the map instead of driving the tab swipe (real-device feedback: swipe worked
          between Mekanlar/Favoriler but not over the map). swipeEnabled: false here only disables
          swiping AWAY from an already-focused Harita -- swiping INTO it from a neighboring tab
          still works, since that swipe is driven by the neighboring (swipe-enabled) screen. Users
          leave Harita via the tab bar instead of a swipe. */}
      <Tab.Screen name="Harita" component={MapScreen} options={{ title: "Harita", swipeEnabled: false }} />
      <Tab.Screen name="Favoriler" component={FavoritesScreen} options={{ title: "Favoriler" }} />
    </Tab.Navigator>
  );
}
