import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { District } from "@gurmego/shared";
import { PRICE_LABELS } from "../lib/labels";
import { colors, radius, spacing, typography } from "../theme";

// Matches apps/web's venue-filters.tsx category options exactly (`category` is a free-form
// string in @gurmego/shared's schemas, not a strict enum -- these four values are the ones real
// venue rows actually carry).
const CATEGORIES: { label: string; value: string }[] = [
  { label: "Kahve", value: "cafe" },
  { label: "Restoran", value: "restaurant" },
  { label: "Fırın & tatlı", value: "bakery" },
  { label: "Sokak lezzeti", value: "street-food" },
];

const PRICE_RANGES: { label: string; value: string }[] = [
  { label: PRICE_LABELS.BUDGET, value: "BUDGET" },
  { label: PRICE_LABELS.MODERATE, value: "MODERATE" },
  { label: PRICE_LABELS.EXPENSIVE, value: "EXPENSIVE" },
  { label: PRICE_LABELS.PREMIUM, value: "PREMIUM" },
];

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  districts: District[];
  selectedDistrictId: string | undefined;
  onSelectDistrict: (id: string | undefined) => void;
  selectedCategory: string | undefined;
  onSelectCategory: (value: string | undefined) => void;
  selectedPriceRange: string | undefined;
  onSelectPriceRange: (value: string | undefined) => void;
}

function ChipRow<T extends { label: string; value: string }>({
  data,
  selected,
  onSelect,
}: {
  data: T[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
}) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRowContent}
      data={data}
      keyExtractor={(item) => item.value}
      renderItem={({ item }) => {
        const on = selected === item.value;
        return (
          <Pressable
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressedFade]}
            onPress={() => onSelect(on ? undefined : item.value)}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
          </Pressable>
        );
      }}
    />
  );
}

export default function FilterSheet({
  visible,
  onClose,
  districts,
  selectedDistrictId,
  onSelectDistrict,
  selectedCategory,
  onSelectCategory,
  selectedPriceRange,
  onSelectPriceRange,
}: FilterSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Filtrele</Text>

        <Text style={styles.sectionLabel}>İlçe</Text>
        <ChipRow
          data={districts.map((d) => ({ label: d.name, value: d.id }))}
          selected={selectedDistrictId}
          onSelect={onSelectDistrict}
        />

        <Text style={styles.sectionLabel}>Kategori</Text>
        <ChipRow data={CATEGORIES} selected={selectedCategory} onSelect={onSelectCategory} />

        <Text style={styles.sectionLabel}>Fiyat</Text>
        <ChipRow data={PRICE_RANGES} selected={selectedPriceRange} onSelect={onSelectPriceRange} />

        <Pressable style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedFade]} onPress={onClose}>
          <Text style={styles.closeBtnText}>Tamam</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: spacing.md,
  },
  title: { fontFamily: typography.serif, fontSize: 22, fontWeight: "600", color: colors.ink, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.accentDeep,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipRowContent: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.chipText },
  chipTextOn: { color: colors.paper },
  pressedFade: { opacity: 0.6 },
  closeBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.ink,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  closeBtnText: { color: colors.paper, fontSize: 14, fontWeight: "700" },
});
