import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

// Web equivalents already live at apps/web/src/app/mekan/[slug]/page.tsx. Paths here mirror that
// routing so a link shares the same structure -- opening it in-app still requires the OS-level
// Universal Links / App Links setup (apple-app-site-association, assetlinks.json), not done yet.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["gurmego://", "https://gurme-go-web.vercel.app"],
  config: {
    // Without this, deep-linking straight to VenueDetail leaves it as the only stack entry --
    // no Tabs underneath to navigate back to (react-navigation/docs/configuring-links#rendering-an-initial-route).
    initialRouteName: "Tabs",
    screens: {
      Tabs: {
        path: "",
        screens: {
          Discovery: "kesfet",
          Favoriler: "favoriler",
        },
      },
      VenueDetail: "mekan/:slug",
      Auth: "giris",
    },
  },
};
