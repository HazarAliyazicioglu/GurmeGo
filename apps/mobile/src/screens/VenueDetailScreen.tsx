import { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { getVenueBySlug } from "../lib/api";
import { directionsUrl } from "../lib/directions";
import type { VenueDetail } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";

type VenueDetailRoute = RouteProp<RootStackParamList, "VenueDetail">;

export default function VenueDetailScreen() {
  const route = useRoute<VenueDetailRoute>();
  const [venue, setVenue] = useState<VenueDetail | null>(null);

  useEffect(() => {
    getVenueBySlug(route.params.slug).then(setVenue).catch(() => setVenue(null));
  }, [route.params.slug]);

  if (!venue) return null;

  return (
    <ScrollView>
      {venue.photos.length > 0 && (
        <Image source={{ uri: venue.photos[0] }} style={{ width: "100%", height: 200 }} />
      )}
      <Text>{venue.name}</Text>
      <Text>{venue.district.name}</Text>
      <Text>{venue.priceRange}</Text>
      {venue.cuisineType && <Text>{venue.cuisineType}</Text>}
      {venue.editorialNote && <Text>{venue.editorialNote}</Text>}
      {venue.transportNote && <Text>{venue.transportNote}</Text>}
      {venue.address && <Text>{venue.address}</Text>}
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
      <Pressable onPress={() => Linking.openURL(directionsUrl(venue.name, venue.district.name))}>
        <Text>Buraya nasıl giderim</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          Share.share({
            message: `${venue.name} — GurmeGo'da keşfet: https://gurmego.com/mekan/${venue.slug}`,
          })
        }
      >
        <Text>Paylaş</Text>
      </Pressable>
    </ScrollView>
  );
}
