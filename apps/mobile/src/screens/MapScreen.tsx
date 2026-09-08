import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, type Region } from "react-native-maps";
import { getAllVenues, getVenuesInBbox, type VenueListItem, type MapVenue } from "../lib/api";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

export default function MapScreen() {
  const navigation = useNavigation<Nav>();
  const [mapVenues, setMapVenues] = useState<MapVenue[]>([]);
  // MapVenueSchema has no `slug` (it's a minimal id/name/category/lat/lng projection) -- recover
  // it by cross-referencing against the full venues list fetched once on mount, same
  // cross-reference apps/web's own map component does (there, against the currently-filtered
  // Discovery list; here, Map is its own tab with no filters of its own, so an unfiltered fetch).
  // getAllVenues (not getVenues({})) pages through every result -- a single-page fetch silently
  // drops venues past the API's default limit=20, leaving their markers un-tappable.
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const latestMapRequest = useRef(0);

  useEffect(() => {
    getAllVenues().then(setVenues).catch(() => setVenues([]));
  }, []);

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
    loadMapVenues(DEFAULT_REGION);
    // Only ever meant to run once on mount, same as the initial-viewport load apps/web's map
    // does -- subsequent loads are driven by the user panning (onRegionChangeComplete below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slugById = new Map(venues.map((v) => [v.id, v.slug]));

  return (
    <View style={styles.screen}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  map: { flex: 1 },
});
