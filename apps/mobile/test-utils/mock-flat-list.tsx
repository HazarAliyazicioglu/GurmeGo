import { Fragment, createElement } from "react";

// Renders FlatList's items synchronously in one pass instead of react-native's real
// VirtualizedList implementation, which defers its initial cell render behind its own
// setTimeout -- on CI's shared runner that deferral was observed to blow past the whole test's
// 15s budget (DiscoveryScreen.spec.tsx, VenueDetailScreen review round). Tests here only assert
// on data/filter/navigation behavior, never on virtualization itself, so this is a safe swap.
export function mockFlatList({ data, renderItem, keyExtractor, horizontal: _horizontal, ...rest }: any) {
  const { View } = require("react-native");
  return createElement(
    View,
    rest,
    (data ?? []).map((item: unknown, index: number) =>
      createElement(
        Fragment,
        { key: keyExtractor ? keyExtractor(item, index) : String(index) },
        renderItem ? renderItem({ item, index }) : null,
      ),
    ),
  );
}
