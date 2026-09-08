import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getVenues, getDistricts, type VenueListItem } from "../lib/api";
import { useLocation } from "../lib/use-location";
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
// same 4 tiers apps/web's venue-filters.tsx already uses, not the LOW/MID/HIGH placeholder an
// earlier draft of this plan used (caught mid-execution: SDD ledger, Task 2's fix-round note).
const PRICE_RANGES: { label: string; value: string }[] = [
  { label: "₺", value: "BUDGET" },
  { label: "₺₺", value: "MODERATE" },
  { label: "₺₺₺", value: "EXPENSIVE" },
  { label: "₺₺₺₺", value: "PREMIUM" },
];

const PRICE_LABEL_BY_VALUE = Object.fromEntries(PRICE_RANGES.map((p) => [p.value, p.label]));

export default function DiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const coords = useLocation();
  const [venues, setVenues] = useState<VenueListItem[]>([]);
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

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.eyebrow}>Kadıköy · Beşiktaş · Beyoğlu</Text>
        <Text style={styles.title}>Mekanlar</Text>
      </View>
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
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setSelectedDistrictId(on ? undefined : item.id)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.name}</Text>
            </Pressable>
          );
        }}
      />
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
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setSelectedCategory(on ? undefined : item.value)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
            </Pressable>
          );
        }}
      />
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
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setSelectedPriceRange(on ? undefined : item.value)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
            </Pressable>
          );
        }}
      />
      <FlatList
        style={styles.list}
        data={venues}
        keyExtractor={(v) => v.id}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}
          >
            <View style={styles.rowThumb} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>{PRICE_LABEL_BY_VALUE[item.priceRange] ?? item.priceRange}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
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
  chipRow: { flexGrow: 0, marginBottom: spacing.xs },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.chipText },
  chipTextOn: { color: colors.paper },
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
