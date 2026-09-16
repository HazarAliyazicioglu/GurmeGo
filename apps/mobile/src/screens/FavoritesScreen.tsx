import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, removeFavoriteVenue } from "../lib/api";
import type { FavoriteList } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FlatFavorite {
  listId: string;
  venueId: string;
  name: string;
  slug: string;
}

function flattenFavorites(lists: FavoriteList[]): FlatFavorite[] {
  return lists.flatMap((list) =>
    list.favorites.map((fav) => ({ listId: list.id, venueId: fav.venueId, name: fav.venue.name, slug: fav.venue.slug })),
  );
}

export default function FavoritesScreen() {
  const { user, session } = useAuth();
  const navigation = useNavigation<Nav>();
  // §M1 audit finding: this tab's native header is hidden (TabNavigator.tsx), so nothing
  // accounted for the status bar/notch on either of this screen's render branches.
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<FlatFavorite[]>([]);
  // Guards against a stale request resolving after a newer one and clobbering the screen with
  // another user's data -- e.g. user A's slow getFavoriteLists() call resolving AFTER user B has
  // signed in on the same device while A's request was still in flight. Bumped unconditionally at
  // the start of every refetch() call (including the one useFocusEffect below fires whenever
  // session?.access_token changes, since that changes refetch's own identity and therefore its
  // wrapped useFocusEffect callback's identity, causing the effect to re-run); a response is only
  // applied if its own requestId still matches by the time it resolves. Same pattern as
  // FavoriteButton.tsx's latestClickRequest/latestPendingRequest.
  const latestRefetchRequest = useRef(0);

  const refetch = useCallback(() => {
    const requestId = ++latestRefetchRequest.current;
    if (!session?.access_token) return;
    getFavoriteLists(session.access_token)
      .then((lists) => {
        if (requestId === latestRefetchRequest.current) setFavorites(flattenFavorites(lists));
      })
      .catch(() => {
        if (requestId === latestRefetchRequest.current) setFavorites([]);
      });
  }, [session?.access_token]);

  // Re-fetch every time this tab gains focus (e.g. after adding a favorite from VenueDetailScreen
  // and navigating back) -- a plain useEffect would only run once per mount, and this screen stays
  // mounted in the background while the Discovery tab is active.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  if (!user) {
    return (
      <View testID="favorites-root" style={{ flex: 1, paddingTop: insets.top }}>
        <Text>Favorilerini görmek için giriş yap</Text>
      </View>
    );
  }

  async function handleRemove(listId: string, venueId: string) {
    if (!session?.access_token) return;
    await removeFavoriteVenue(session.access_token, listId, venueId).catch(() => {
      // Swallow -- no error-display UI here yet; the list simply won't update if this fails, and
      // the user can retry the same press.
    });
    refetch();
  }

  return (
    <View testID="favorites-root" style={{ flex: 1, paddingTop: insets.top }}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.venueId}
        renderItem={({ item }) => (
          <View>
            <Pressable onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}>
              <Text>{item.name}</Text>
            </Pressable>
            <Pressable onPress={() => handleRemove(item.listId, item.venueId)}>
              <Text>Kaldır</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
