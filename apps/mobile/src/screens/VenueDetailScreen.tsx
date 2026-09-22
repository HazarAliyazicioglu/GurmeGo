import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { getVenueBySlug } from "../lib/api";
import { directionsUrl } from "../lib/directions";
import { SITE_URL } from "../lib/env";
import ReportForm from "../components/ReportForm";
import FavoriteButton from "../components/FavoriteButton";
import type { VenueDetail } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type VenueDetailRoute = RouteProp<RootStackParamList, "VenueDetail">;

// §M3 audit finding: this screen used to render nothing at all while loading, and forever if the
// fetch failed -- the user couldn't tell "still loading" from "crashed", with no way to retry.
type Status = "loading" | "error" | "loaded";

export default function VenueDetailScreen() {
  const route = useRoute<VenueDetailRoute>();
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  // Bumped on every fetch (initial + each retry) so a stale, slower request can't overwrite the
  // result of a newer one -- same monotonic-counter pattern used project-wide (DiscoveryScreen,
  // FavoritesScreen, FavoriteButton).
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getVenueBySlug(route.params.slug)
      .then((res) => {
        if (cancelled) return;
        setVenue(res);
        setStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [route.params.slug, retryToken]);

  if (status === "loading") {
    return (
      <View testID="venue-loading" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === "error" || !venue) {
    return (
      <View testID="venue-error" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Mekan yüklenemedi</Text>
        <Pressable onPress={() => setRetryToken((t) => t + 1)}>
          <Text>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView>
      {venue.photos.length > 0 && (
        <Image source={{ uri: venue.photos[0] }} style={{ width: "100%", height: 200 }} />
      )}
      <Text>{venue.name}</Text>
      <Text>{venue.district.name}</Text>
      <Text>{venue.priceRange}</Text>
      {venue.isBoutique && <Text>Butik mekan</Text>}
      {venue.googleRating != null && venue.googleRatingCount != null && (
        <Text>{`${venue.googleRating} (${venue.googleRatingCount} Google yorumu)`}</Text>
      )}
      {venue.cuisineType && <Text>{venue.cuisineType}</Text>}
      {venue.editorialNote && <Text>{venue.editorialNote}</Text>}
      {venue.transportNote && <Text>{venue.transportNote}</Text>}
      {venue.address && <Text>{venue.address}</Text>}
      {Object.keys(venue.openingHours).length > 0 && (
        <View>
          {Object.entries(venue.openingHours).map(([day, hours]) => (
            <Text key={day}>{`${day}: ${hours}`}</Text>
          ))}
        </View>
      )}
      <Text>{`Son doğrulama: ${new Date(venue.verifiedAt).toLocaleDateString()}`}</Text>
      {venue.signatureItems.length > 0 && (
        <View>
          {venue.signatureItems.map((item) => (
            <Text key={item}>{item}</Text>
          ))}
        </View>
      )}
      <View style={{ height: 200 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: venue.lat, longitude: venue.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        >
          <Marker coordinate={{ latitude: venue.lat, longitude: venue.lng }} title={venue.name} />
        </MapView>
      </View>
      <Pressable
        onPress={() =>
          // Denetim raporu §4.2 "'Yol tarifi al' butonu bazen sessizce başarısız olabilir": no
          // maps app installed (or any other Linking failure) previously left an unhandled
          // rejection and no feedback at all.
          Linking.openURL(directionsUrl(venue.name, venue.district.name)).catch(() => {
            Alert.alert("Yol tarifi açılamadı", "Cihazında bir harita uygulaması bulunamadı.");
          })
        }
      >
        <Text>Buraya nasıl giderim</Text>
      </Pressable>
      <FavoriteButton venueId={venue.id} />
      <Pressable
        onPress={() =>
          Share.share({
            // Denetim raporu §4.2 "Paylaşım linki her zaman gerçek (canlı) siteyi gösteriyor" --
            // was a literal `https://gurmego.com`, ignoring which environment is actually running.
            message: `${venue.name} — GurmeGo'da keşfet: ${SITE_URL}/mekan/${venue.slug}`,
          })
        }
      >
        <Text>Paylaş</Text>
      </Pressable>
      <ReportForm venueId={venue.id} />
    </ScrollView>
  );
}
