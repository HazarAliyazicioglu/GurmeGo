import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

// Web equivalents already live at apps/web/src/app/mekan/[slug]/page.tsx (production URL below) --
// paths here mirror that routing so a link shared from web opens the same screen in the app.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["gurmego://", "https://gurme-go-web.vercel.app"],
  config: {
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
