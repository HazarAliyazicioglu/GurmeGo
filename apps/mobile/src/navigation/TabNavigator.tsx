import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import DiscoveryScreen from "../screens/DiscoveryScreen";
import MapScreen from "../screens/MapScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import { colors } from "../theme";

export type TabParamList = {
  Discovery: undefined;
  Harita: undefined;
  Favoriler: undefined;
};

// Reverted from material-top-tabs back to plain bottom-tabs (real-device feedback: the swipe
// gesture fought with MapView's own pan gesture over the map, and the swipe itself was decided
// not worth keeping) -- see TabNavigator.spec.tsx and cbd52b0/6f4a543 for the swipe attempt this
// undoes.
const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentDeep,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.paperCard, borderTopWidth: 1, borderTopColor: colors.line, elevation: 0, shadowOpacity: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tab.Screen name="Discovery" component={DiscoveryScreen} options={{ title: "Mekanlar" }} />
      <Tab.Screen name="Harita" component={MapScreen} options={{ title: "Harita" }} />
      <Tab.Screen name="Favoriler" component={FavoritesScreen} options={{ title: "Favoriler" }} />
    </Tab.Navigator>
  );
}
