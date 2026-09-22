import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getVenues, getDistricts, type VenueListItem } from "../lib/api";
import { useLocation } from "../lib/use-location";
import type { District } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Matches apps/web's venue-filters.tsx category options exactly (`category` is a free-form
// string in @gurmego/shared's schemas, not a strict enum -- these four values are the ones real
// venue rows actually carry). An earlier draft of this plan had "Bar"/"bar" here, which is not a
// real category value and would silently return zero results; fixed mid-execution, see the SDD
// ledger's Task 2 fix-round note.
const CATEGORIES: { label: string; value: string }[] = [
  { label: "Kahve", value: "cafe" },
  { label: "Restoran", value: "restaurant" },
  { label: "Fırın & tatlı", value: "bakery" },
  { label: "Sokak lezzeti", value: "street-food" },
];

// Values match @gurmego/shared's PRICE_RANGE_VALUES (packages/shared/src/enums/price-range.ts) --
// same 4 tiers apps/web's venue-filters.tsx already uses, not the LOW/MID/HIGH placeholder an
// earlier draft of this plan used (caught mid-execution: SDD ledger, Task 2's fix-round note).
const PRICE_RANGES: { label: string; value: string }[] = [
  { label: "₺", value: "BUDGET" },
  { label: "₺₺", value: "MODERATE" },
  { label: "₺₺₺", value: "EXPENSIVE" },
  { label: "₺₺₺₺", value: "PREMIUM" },
];

export default function DiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const coords = useLocation();
  // §M1 audit finding: this tab's native header is hidden (TabNavigator.tsx), so nothing
  // accounted for the status bar/notch -- this screen's own first row (district chips) could
  // render half-hidden under it.
  const insets = useSafeAreaInsets();
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  // §M2 audit finding: the backend paginates /venues, but this screen only ever showed the first
  // page -- once a district's venue count passed the first page size, the rest were permanently
  // unreachable.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | undefined>(undefined);
  // Guards against a slower, older venues request resolving AFTER a newer one and clobbering the
  // screen with stale results -- e.g. the initial coords=null request resolving after a
  // coords={lat,lng} request that started later once location permission resolved. Bumped
  // unconditionally at the start of every effect run; a response is only applied if its own
  // requestId still matches by the time it resolves. Same pattern as FavoriteButton.tsx's
  // latestClickRequest and FavoritesScreen.tsx's latestRefetchRequest.
  const latestVenuesRequest = useRef(0);
  // cross-model-review finding: FlatList's onEndReached can fire more than once (e.g. in quick
  // succession near the threshold) before the first page-2 request resolves -- without this,
  // both calls pass the same hasMore/nextCursor check and fetch (and append) the same page twice.
  const loadingMore = useRef(false);
  // Denetim raporu §4.2 "Filtreye uyan mekan yoksa kullanıcı bunu anlayamıyor": `venues.length
  // === 0` is ALSO true before the very first fetch resolves, so gating the empty-state message
  // on that alone would flash it briefly on every load. This tracks "the current filter set's
  // request has actually settled" instead.
  const [venuesLoaded, setVenuesLoaded] = useState(false);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  function buildQuery(): Record<string, string> {
    const query: Record<string, string> = {};
    if (selectedDistrictId) query.districtId = selectedDistrictId;
    if (selectedCategory) query.category = selectedCategory;
    if (selectedPriceRange) query.priceRange = selectedPriceRange;
    return query;
  }

  useEffect(() => {
    const requestId = ++latestVenuesRequest.current;
    setVenuesLoaded(false);
    getVenues(buildQuery(), coords)
      .then((res) => {
        if (requestId === latestVenuesRequest.current) {
          setVenues(res.data);
          setNextCursor(res.meta.next_cursor);
          setHasMore(res.meta.has_more);
          setVenuesLoaded(true);
        }
      })
      .catch(() => {
        if (requestId === latestVenuesRequest.current) {
          setVenues([]);
          setNextCursor(null);
          setHasMore(false);
          setVenuesLoaded(true);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictId, selectedCategory, selectedPriceRange, coords]);

  function loadMore() {
    if (!hasMore || !nextCursor || loadingMore.current) return;
    loadingMore.current = true;
    const requestId = latestVenuesRequest.current;
    getVenues({ ...buildQuery(), cursor: nextCursor }, coords)
      .then((res) => {
        // Guards against a filter change firing its own (resetting) fetch while this page-2
        // request is still in flight -- appending stale results on top of a fresh, filtered list.
        if (requestId !== latestVenuesRequest.current) return;
        setVenues((prev) => [...prev, ...res.data]);
        setNextCursor(res.meta.next_cursor);
        setHasMore(res.meta.has_more);
      })
      .catch(() => {
        // Swallow -- the user already sees the pages fetched so far; onEndReached will just fire
        // again on the next scroll if they try again.
      })
      .finally(() => {
        loadingMore.current = false;
      });
  }

  return (
    <View testID="discovery-root" style={{ flex: 1, paddingTop: insets.top }}>
      <FlatList
        horizontal
        data={districts}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedDistrictId(selectedDistrictId === item.id ? undefined : item.id)}>
            <Text>{item.name}</Text>
          </Pressable>
        )}
      />
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.value}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedCategory(selectedCategory === item.value ? undefined : item.value)}>
            <Text>{item.label}</Text>
          </Pressable>
        )}
      />
      <FlatList
        horizontal
        data={PRICE_RANGES}
        keyExtractor={(p) => p.value}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedPriceRange(selectedPriceRange === item.value ? undefined : item.value)}
          >
            <Text>{item.label}</Text>
          </Pressable>
        )}
      />
      <FlatList
        testID="venues-list"
        data={venues}
        keyExtractor={(v) => v.id}
        ListEmptyComponent={venuesLoaded ? <Text>Bu kriterlere uygun mekan bulunamadı</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}>
            <Text>{item.name}</Text>
          </Pressable>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
