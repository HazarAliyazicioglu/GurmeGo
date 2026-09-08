import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, type Region } from "react-native-maps";
import { getVenues, getVenuesInBbox, getDistricts, type VenueListItem, type MapVenue } from "../lib/api";
import { useLocation } from "../lib/use-location";
import { useAuth } from "../lib/auth-context";
import { PRICE_LABELS } from "../lib/labels";
import type { District } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, spacing, typography } from "../theme";

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
// same 4 tiers apps/web's venue-filters.tsx already uses.
const PRICE_RANGES: { label: string; value: string }[] = [
  { label: PRICE_LABELS.BUDGET, value: "BUDGET" },
  { label: PRICE_LABELS.MODERATE, value: "MODERATE" },
  { label: PRICE_LABELS.EXPENSIVE, value: "EXPENSIVE" },
  { label: PRICE_LABELS.PREMIUM, value: "PREMIUM" },
];

// Roughly centers Kadıköy/Beşiktaş/Beyoğlu (the MVP's three districts, on both sides of the
// Bosphorus) -- not meant to be precise, just a sane default before the user pans/zooms.
const DEFAULT_REGION: Region = { latitude: 41.01, longitude: 29.02, latitudeDelta: 0.16, longitudeDelta: 0.22 };

function regionToBbox(region: Region): [number, number, number, number] {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

export default function DiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const coords = useLocation();
  const [view, setView] = useState<"list" | "map">("list");
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [mapVenues, setMapVenues] = useState<MapVenue[]>([]);
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
  const latestMapRequest = useRef(0);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    const requestId = ++latestVenuesRequest.current;
    const query: Record<string, string> = {};
    if (selectedDistrictId) query.districtId = selectedDistrictId;
    if (selectedCategory) query.category = selectedCategory;
    if (selectedPriceRange) query.priceRange = selectedPriceRange;
    getVenues(query, coords)
      .then((res) => {
        if (requestId === latestVenuesRequest.current) setVenues(res.data);
      })
      .catch(() => {
        if (requestId === latestVenuesRequest.current) setVenues([]);
      });
  }, [selectedDistrictId, selectedCategory, selectedPriceRange, coords]);

  // Fetches the venues visible in the map's current viewport -- mirrors apps/web's
  // venue-map-leaflet.tsx BoundsVenueLoader (moveend -> getVenuesInBbox). Only runs while the map
  // tab is active; the list-view's own getVenues effect above already covers list mode.
  function loadMapVenues(region: Region) {
    const requestId = ++latestMapRequest.current;
    getVenuesInBbox(regionToBbox(region))
      .then((res) => {
        if (requestId === latestMapRequest.current) setMapVenues(res);
      })
      .catch(() => {
        if (requestId === latestMapRequest.current) setMapVenues([]);
      });
  }

  useEffect(() => {
    if (view === "map") loadMapVenues(DEFAULT_REGION);
  }, [view]);

  // MapVenueSchema has no `slug` (it's a minimal id/name/category/lat/lng projection) -- recover
  // it by matching against the already-fetched venues list, same cross-reference apps/web's own
  // map component does rather than adding a second lookup round-trip.
  const slugById = new Map(venues.map((v) => [v.id, v.slug]));

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>Kadıköy · Beşiktaş · Beyoğlu</Text>
          <Text style={styles.title}>Mekanlar</Text>
        </View>
        {!user && (
          <Pressable
            style={({ pressed }) => [styles.authLink, pressed && styles.pressedFade]}
            onPress={() => navigation.navigate("Auth")}
          >
            <Text style={styles.authLinkText}>Giriş yap</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          data={districts}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => {
            const on = selectedDistrictId === item.id;
            return (
              <Pressable
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressedFade]}
                onPress={() => setSelectedDistrictId(on ? undefined : item.id)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
        <View style={styles.filterRowSplit}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
            data={CATEGORIES}
            keyExtractor={(c) => c.value}
            renderItem={({ item }) => {
              const on = selectedCategory === item.value;
              return (
                <Pressable
                  style={({ pressed }) => [styles.chipSmall, on && styles.chipOn, pressed && styles.pressedFade]}
                  onPress={() => setSelectedCategory(on ? undefined : item.value)}
                >
                  <Text style={[styles.chipTextSmall, on && styles.chipTextOn]}>{item.label}</Text>
                </Pressable>
              );
            }}
          />
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          data={PRICE_RANGES}
          keyExtractor={(p) => p.value}
          renderItem={({ item }) => {
            const on = selectedPriceRange === item.value;
            return (
              <Pressable
                style={({ pressed }) => [styles.chipSmall, on && styles.chipOn, pressed && styles.pressedFade]}
                onPress={() => setSelectedPriceRange(on ? undefined : item.value)}
              >
                <Text style={[styles.chipTextSmall, on && styles.chipTextOn]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          style={({ pressed }) => [styles.toggleBtn, view === "list" && styles.toggleBtnOn, pressed && styles.pressedFade]}
          onPress={() => setView("list")}
        >
          <Text style={[styles.toggleText, view === "list" && styles.toggleTextOn]}>Liste</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.toggleBtn, view === "map" && styles.toggleBtnOn, pressed && styles.pressedFade]}
          onPress={() => setView("map")}
        >
          <Text style={[styles.toggleText, view === "map" && styles.toggleTextOn]}>Harita</Text>
        </Pressable>
      </View>

      {view === "list" ? (
        <FlatList
          style={styles.list}
          data={venues}
          keyExtractor={(v) => v.id}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressedFade]}
              onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}
            >
              <View style={styles.rowThumb} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{PRICE_LABELS[item.priceRange] ?? item.priceRange}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      ) : (
        <MapView style={styles.map} initialRegion={DEFAULT_REGION} onRegionChangeComplete={loadMapVenues}>
          {mapVenues.map((mv) => (
            <Marker
              key={mv.id}
              coordinate={{ latitude: mv.lat, longitude: mv.lng }}
              title={mv.name}
              onPress={() => {
                const slug = slugById.get(mv.id);
                if (slug) navigation.navigate("VenueDetail", { slug });
              }}
            />
          ))}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accentDeep,
    marginBottom: spacing.xs,
  },
  title: { fontFamily: typography.serif, fontSize: 26, fontWeight: "600", color: colors.ink },
  authLink: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.xs },
  authLinkText: { fontSize: 12, fontWeight: "700", color: colors.accentDeep },
  pressedFade: { opacity: 0.6 },
  // "Sade" filter block: one light card holding all three rows, tight vertical rhythm instead of
  // three separately-framed zones -- this is the direct response to "filtreler kalabalık" feedback.
  filters: { paddingTop: 2, paddingBottom: spacing.xs, gap: 4 },
  filterRowSplit: {},
  chipRow: { flexGrow: 0 },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: 6 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.chipText },
  chipTextSmall: { fontSize: 11, fontWeight: "700", color: colors.chipText },
  chipTextOn: { color: colors.paper },
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.chipBg,
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.pill, alignItems: "center" },
  toggleBtnOn: { backgroundColor: colors.ink },
  toggleText: { fontSize: 12, fontWeight: "700", color: colors.chipText },
  toggleTextOn: { color: colors.paper },
  list: { flex: 1, marginTop: spacing.sm },
  map: { flex: 1, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.paperCard,
  },
  rowDivider: { height: 1, backgroundColor: colors.line, marginHorizontal: spacing.lg },
  rowThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontFamily: typography.serif, fontSize: 16, fontWeight: "600", color: colors.ink },
  rowMeta: { fontSize: 12, fontWeight: "700", color: colors.accentDeep },
  chevron: { fontSize: 18, color: colors.inkFaint },
});
