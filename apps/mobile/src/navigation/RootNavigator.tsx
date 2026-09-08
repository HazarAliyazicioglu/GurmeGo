import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import VenueDetailScreen from "../screens/VenueDetailScreen";
import AuthScreen from "../screens/AuthScreen";
import { colors } from "../theme";

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paperCard,
    text: colors.ink,
    border: colors.line,
    primary: colors.accentDeep,
  },
};

export type RootStackParamList = {
  Tabs: undefined;
  VenueDetail: { slug: string };
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.paperCard },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="VenueDetail" component={VenueDetailScreen} options={{ title: "Mekan" }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Giriş yap" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
