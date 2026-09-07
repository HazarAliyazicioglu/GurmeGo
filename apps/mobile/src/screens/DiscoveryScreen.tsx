import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
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
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | undefined>(undefined);

  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    const query: Record<string, string> = {};
    if (selectedDistrictId) query.districtId = selectedDistrictId;
    if (selectedCategory) query.category = selectedCategory;
    if (selectedPriceRange) query.priceRange = selectedPriceRange;
    getVenues(query, coords).then((res) => setVenues(res.data)).catch(() => setVenues([]));
  }, [selectedDistrictId, selectedCategory, selectedPriceRange, coords]);

  return (
    <View>
      <FlatList
        horizontal
        data={districts}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedDistrictId(item.id)}>
            <Text>{item.name}</Text>
          </Pressable>
        )}
      />
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.value}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedCategory(item.value)}>
            <Text>{item.label}</Text>
          </Pressable>
        )}
      />
      <FlatList
        horizontal
        data={PRICE_RANGES}
        keyExtractor={(p) => p.value}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedPriceRange(item.value)}>
            <Text>{item.label}</Text>
          </Pressable>
        )}
      />
      <FlatList
        data={venues}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("VenueDetail", { slug: item.slug })}>
            <Text>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
