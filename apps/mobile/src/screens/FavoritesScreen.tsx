import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
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
  const [favorites, setFavorites] = useState<FlatFavorite[]>([]);

  const refetch = useCallback(() => {
    if (!session?.access_token) return;
    getFavoriteLists(session.access_token).then((lists) => setFavorites(flattenFavorites(lists))).catch(() => setFavorites([]));
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
      <View>
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
  );
}
