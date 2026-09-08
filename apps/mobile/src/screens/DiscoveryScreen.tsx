import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getVenues, getDistricts, type VenueListItem } from "../lib/api";
import { useLocation } from "../lib/use-location";
import { useAuth } from "../lib/auth-context";
import { PRICE_LABELS } from "../lib/labels";
import FilterSheet from "../components/FilterSheet";
import type { District } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, spacing, typography } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const coords = useLocation();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
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

  const activeFilterCount = [selectedDistrictId, selectedCategory, selectedPriceRange].filter(Boolean).length;

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.eyebrow}>Kadıköy · Beşiktaş · Beyoğlu</Text>
        <Text style={styles.title}>Mekanlar</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.filterBtn, pressed && styles.pressedFade]}
          onPress={() => setFilterSheetOpen(true)}
        >
          <Text style={styles.filterBtnText}>
            Filtrele{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Text>
        </Pressable>
        {!user && (
          <Pressable
            style={({ pressed }) => [styles.authLink, pressed && styles.pressedFade]}
            onPress={() => navigation.navigate("Auth")}
          >
            <Text style={styles.authLinkText}>Giriş yap</Text>
          </Pressable>
        )}
      </View>

      <FilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        districts={districts}
        selectedDistrictId={selectedDistrictId}
        onSelectDistrict={setSelectedDistrictId}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedPriceRange={selectedPriceRange}
        onSelectPriceRange={setSelectedPriceRange}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accentDeep,
    marginBottom: spacing.xs,
  },
  title: { fontFamily: typography.serif, fontSize: 26, fontWeight: "600", color: colors.ink },
  // "Filtrele" ve "Giriş yap" ayni satirda, birbirinin karsisinda -- filtrelerin gizlendigi tek
  // satirlik kompakt aksiyon bandi (onceki "filtreler kalabalik" ve "giris yap cok yukarida"
  // geri bildirimlerine yanit).
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  filterBtnText: { fontSize: 13, fontWeight: "700", color: colors.chipText },
  authLink: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  authLinkText: { fontSize: 12, fontWeight: "700", color: colors.accentDeep },
  pressedFade: { opacity: 0.6 },
  list: { flex: 1, marginTop: spacing.xs },
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
