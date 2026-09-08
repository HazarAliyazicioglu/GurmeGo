import { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { getVenueBySlug } from "../lib/api";
import { directionsUrl } from "../lib/directions";
import ReportForm from "../components/ReportForm";
import FavoriteButton from "../components/FavoriteButton";
import type { VenueDetail } from "@gurmego/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, spacing, typography } from "../theme";
import { DAY_LABELS, PRICE_LABELS } from "../lib/labels";

type VenueDetailRoute = RouteProp<RootStackParamList, "VenueDetail">;

function renderStars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export default function VenueDetailScreen() {
  const route = useRoute<VenueDetailRoute>();
  const [venue, setVenue] = useState<VenueDetail | null>(null);

  useEffect(() => {
    getVenueBySlug(route.params.slug).then(setVenue).catch(() => setVenue(null));
  }, [route.params.slug]);

  if (!venue) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {venue.photos.length > 0 && (
          <Image source={{ uri: venue.photos[0] }} style={styles.heroImage} />
        )}
        {venue.isBoutique && (
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Butik mekan</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{venue.name}</Text>
        <Text style={styles.subline}>
          {venue.district.name} · <Text style={styles.subPrice}>{PRICE_LABELS[venue.priceRange] ?? venue.priceRange}</Text>
        </Text>
        {venue.cuisineType && <Text style={styles.cuisine}>{venue.cuisineType}</Text>}

        {venue.googleRating != null && venue.googleRatingCount != null && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingStars}>{renderStars(venue.googleRating)}</Text>
            <Text style={styles.ratingText}>
              {`${venue.googleRating} (${venue.googleRatingCount} Google yorumu)`}
            </Text>
          </View>
        )}

        {venue.editorialNote && (
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteEyebrow}>Neden burada?</Text>
            <Text style={styles.quoteText}>{venue.editorialNote}</Text>
          </View>
        )}

        {(venue.transportNote || venue.address) && (
          <View style={styles.infoGrid}>
            {venue.transportNote && (
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Ulaşım</Text>
                <Text style={styles.infoValue}>{venue.transportNote}</Text>
              </View>
            )}
            {venue.address && (
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Adres</Text>
                <Text style={styles.infoValue}>{venue.address}</Text>
              </View>
            )}
          </View>
        )}

        {Object.keys(venue.openingHours).length > 0 && (
          <View style={styles.hoursSection}>
            <Text style={styles.sectionEyebrow}>Çalışma saatleri</Text>
            {Object.entries(venue.openingHours).map(([day, hours]) => (
              <View key={day} style={styles.hoursRow}>
                <Text style={styles.hoursDay}>{DAY_LABELS[day.toLowerCase()] ?? day}</Text>
                <Text style={styles.hoursValue}>{hours}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.verified}>{`✓ Son doğrulama: ${new Date(venue.verifiedAt).toLocaleDateString()}`}</Text>

        {venue.signatureItems.length > 0 && (
          <View style={styles.sigSection}>
            <Text style={styles.sectionEyebrow}>İmza lezzetler</Text>
            <View style={styles.sigRow}>
              {venue.signatureItems.map((item) => (
                <View key={item} style={styles.sigChip}>
                  <Text style={styles.sigChipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.mapBlock}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ latitude: venue.lat, longitude: venue.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          >
            <Marker coordinate={{ latitude: venue.lat, longitude: venue.lng }} title={venue.name} />
          </MapView>
        </View>

        <View style={styles.btnRow}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={() => Linking.openURL(directionsUrl(venue.name, venue.district.name))}
          >
            <Text style={styles.btnPrimaryText}>Buraya nasıl giderim</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
            onPress={() =>
              Share.share({
                message: `${venue.name} — GurmeGo'da keşfet: https://gurmego.com/mekan/${venue.slug}`,
              })
            }
          >
            <Text style={styles.btnGhostText}>Paylaş</Text>
          </Pressable>
        </View>

        <View style={styles.actionSpacer}>
          <FavoriteButton venueId={venue.id} />
        </View>
        <ReportForm venueId={venue.id} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: spacing.xxl },
  hero: {
    height: 220,
    backgroundColor: colors.accentSoft,
    justifyContent: "flex-end",
  },
  heroImage: { ...StyleSheet.absoluteFill, resizeMode: "cover" },
  heroBadge: {
    alignSelf: "flex-start",
    margin: spacing.lg,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  heroBadgeText: { color: colors.paper, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  name: { fontFamily: typography.serif, fontSize: 30, fontWeight: "600", color: colors.ink },
  subline: { marginTop: spacing.xs, fontSize: 14, fontWeight: "700", color: colors.inkSoft },
  subPrice: { color: colors.accentDeep, fontWeight: "800" },
  cuisine: { marginTop: 2, fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  ratingStars: { color: colors.accent, fontSize: 14 },
  ratingText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  quoteBlock: { marginTop: spacing.lg, backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg },
  quoteEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: colors.accentSoft },
  quoteText: {
    fontFamily: typography.serif,
    fontStyle: "italic",
    fontSize: 18,
    lineHeight: 24,
    color: colors.paper,
    marginTop: spacing.sm,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.lg },
  infoCell: { flexBasis: "45%", flexGrow: 1, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  infoLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: colors.inkFaint },
  infoValue: { fontSize: 14, fontWeight: "600", color: colors.ink, marginTop: spacing.xs },
  hoursSection: { marginTop: spacing.lg },
  sectionEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: colors.accentDeep, marginBottom: spacing.xs },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  hoursDay: { fontSize: 13, fontWeight: "700", color: colors.inkFaint },
  hoursValue: { fontSize: 13, fontWeight: "600", color: colors.ink },
  verified: { marginTop: spacing.lg, fontSize: 12, fontWeight: "700", color: colors.accentDeep },
  sigSection: { marginTop: spacing.lg },
  sigRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sigChip: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  sigChipText: { fontSize: 13, fontWeight: "700", color: colors.chipText },
  mapBlock: {
    height: 140,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginTop: spacing.lg,
    backgroundColor: colors.chipBg,
  },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  btnPrimaryText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
  btnGhost: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  btnGhostText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  btnPressed: { opacity: 0.7 },
  actionSpacer: { marginTop: spacing.md },
});
