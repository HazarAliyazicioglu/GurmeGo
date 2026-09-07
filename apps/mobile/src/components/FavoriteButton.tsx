import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/auth-context";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue } from "../lib/api";
import type { RootStackParamList } from "../navigation/RootNavigator";

const DEFAULT_LIST_NAME = "Favorilerim";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoriteButton({ venueId }: { venueId: string }) {
  const { user, session } = useAuth();
  const navigation = useNavigation<Nav>();
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  // Separate from `latestClickRequest`: that counter is also bumped by the effect below on
  // every venueId/user/session change, which is correct for guarding `setAdded` (a stale click
  // must never apply its result to a different venue) but wrong for guarding `pending` -- if
  // they shared a counter, a venueId change while a click is in flight would permanently stick
  // `pending` at true (the in-flight click's requestId would never again match
  // latestClickRequest.current), disabling the button forever. `latestPendingRequest` is bumped
  // only by handleClick itself plus the effect's reset below, so it only guards against a
  // genuinely newer overlapping click (or context change) superseding an older one.
  const latestClickRequest = useRef(0);
  const latestPendingRequest = useRef(0);

  useEffect(() => {
    latestClickRequest.current += 1;
    latestPendingRequest.current += 1;
    setPending(false);
    if (!user || !session?.access_token) {
      setAdded(false);
      return;
    }
    let cancelled = false;
    setAdded(false);
    getFavoriteLists(session.access_token)
      .then((lists) => {
        if (cancelled) return;
        const isFavorited = lists.some((list) => list.favorites.some((fav) => fav.venueId === venueId));
        if (isFavorited) setAdded(true);
      })
      .catch(() => {
        // Initial "already favorited" check failed -- leave `added` as false, favoriting still
        // works via handleClick's own flow.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, session?.access_token, venueId]);

  async function handleClick() {
    if (!user) {
      navigation.navigate("Auth");
      return;
    }
    if (!session?.access_token) return;
    const requestId = ++latestClickRequest.current;
    const pendingRequestId = ++latestPendingRequest.current;
    setPending(true);
    try {
      const lists = await getFavoriteLists(session.access_token);
      const list = lists[0] ?? (await createFavoriteList(session.access_token, DEFAULT_LIST_NAME));
      await addFavoriteVenue(session.access_token, list.id, venueId);
      if (requestId === latestClickRequest.current) setAdded(true);
    } catch {
      // Swallow -- no error-display UI here, button re-enables via `finally` so the user can retry.
    } finally {
      if (pendingRequestId === latestPendingRequest.current) setPending(false);
    }
  }

  return (
    <Pressable onPress={handleClick} disabled={pending}>
      <Text>{added ? "Favorilerde" : "Favorilere ekle"}</Text>
    </Pressable>
  );
}
