import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DiscoveryScreen from "../screens/DiscoveryScreen";

export type RootStackParamList = {
  Discovery: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Discovery">
        <Stack.Screen name="Discovery" component={DiscoveryScreen} options={{ title: "GurmeGo" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
