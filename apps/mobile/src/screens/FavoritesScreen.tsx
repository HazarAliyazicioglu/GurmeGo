import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, removeFavoriteVenue } from "../lib/api";
import type { FavoriteList } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, spacing, typography } from "../theme";

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
  const { user, session, signOut } = useAuth();
  const navigation = useNavigation<Nav>();
  const [favorites, setFavorites] = useState<FlatFavorite[]>([]);
  const [signOutError, setSignOutError] = useState<string | null>(null);
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
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyText}>Favorilerini görmek için giriş yap</Text>
        <Pressable
          style={({ pressed }) => [styles.signInBtn, pressed && styles.pressedFade]}
          onPress={() => navigation.navigate("Auth")}
        >
          <Text style={styles.signInBtnText}>Giriş yap</Text>
        </Pressable>
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
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.eyebrow}>Kaydedilenler</Text>
        <Text style={styles.title}>Favorilerim</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileEmail} numberOfLines={1}>
          {user.email}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressedFade]}
          onPress={async () => {
            setSignOutError(null);
            const result = await signOut();
            if (result.error) setSignOutError(result.error);
          }}
        >
          <Text style={styles.signOutBtnText}>Çıkış yap</Text>
        </Pressable>
      </View>
      {signOutError && <Text style={styles.signOutErrorText}>{signOutError}</Text>}
      <FlatList
        style={styles.list}
        data={favorites}
        keyExtractor={(item) => item.venueId}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.rowMain, pressed && styles.pressedFade]}
              onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}
            >
              <View style={styles.rowThumb} />
              <Text style={styles.rowName}>{item.name}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
              onPress={() => handleRemove(item.listId, item.venueId)}
            >
              <Text style={styles.removeBtnText}>Kaldır</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  emptyScreen: { flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyText: { fontSize: 15, fontWeight: "700", color: colors.inkSoft, textAlign: "center" },
  topbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accentDeep,
    marginBottom: spacing.xs,
  },
  title: { fontFamily: typography.serif, fontSize: 28, fontWeight: "600", color: colors.ink },
  signInBtn: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.chipBg },
  signInBtnText: { fontSize: 13, fontWeight: "700", color: colors.chipText },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  profileEmail: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.inkSoft },
  signOutBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  signOutBtnText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  signOutErrorText: { fontSize: 12, fontWeight: "600", color: colors.danger, marginHorizontal: spacing.lg, marginTop: spacing.xs },
  list: { flex: 1, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.paperCard,
  },
  rowDivider: { height: 1, backgroundColor: colors.line, marginHorizontal: spacing.lg },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowThumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  rowName: { fontFamily: typography.serif, fontSize: 16, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  removeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  removeBtnText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  removeBtnPressed: { opacity: 0.6 },
  pressedFade: { opacity: 0.6 },
});
