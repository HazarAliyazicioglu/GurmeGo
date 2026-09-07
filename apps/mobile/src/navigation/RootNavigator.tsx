import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import VenueDetailScreen from "../screens/VenueDetailScreen";
import AuthScreen from "../screens/AuthScreen";

export type RootStackParamList = {
  Tabs: undefined;
  VenueDetail: { slug: string };
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="VenueDetail" component={VenueDetailScreen} options={{ title: "Mekan" }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Giriş yap" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
