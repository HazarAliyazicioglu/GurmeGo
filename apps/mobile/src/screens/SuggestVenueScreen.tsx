import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SuggestVenueSchema, type District } from "@gurmego/shared";
import { getDistricts, suggestVenue } from "../lib/api";

// Same values apps/web's suggest-venue-form.tsx uses (backend category values only), matching
// DiscoveryScreen.tsx's own CATEGORIES list for consistency within this app.
const CATEGORIES: { label: string; value: string }[] = [
  { label: "Kahve", value: "cafe" },
  { label: "Restoran", value: "restaurant" },
  { label: "Fırın & tatlı", value: "bakery" },
  { label: "Sokak lezzeti", value: "street-food" },
];

export default function SuggestVenueScreen() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [name, setName] = useState("");
  const [districtSlug, setDistrictSlug] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDistricts()
      .then((ds) => {
        setDistricts(ds);
        setDistrictSlug((prev) => prev || ds[0]?.slug || "");
      })
      .catch(() => setDistricts([]));
  }, []);

  async function handleSubmit() {
    // Same shared schema the backend enforces (packages/shared's SuggestVenueSchema) -- an
    // empty/too-short name never reaches the network, matching ReportForm's validation pattern.
    const nameCheck = SuggestVenueSchema.shape.name.safeParse(name);
    if (!nameCheck.success) {
      setError("Mekan adı en az 2 karakter olmalı.");
      return;
    }
    if (!districtSlug) {
      setError("Bir ilçe seç.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await suggestVenue({
        name,
        districtSlug,
        category,
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSubmitted(true);
    } catch {
      setError("Öneri gönderilemedi, lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View testID="suggest-venue-root">
        <Text>Teşekkürler, önerin kürasyon ekibine iletildi.</Text>
      </View>
    );
  }

  return (
    <ScrollView testID="suggest-venue-root">
      <Text>Mekan adı</Text>
      <TextInput
        testID="suggest-name"
        value={name}
        onChangeText={setName}
        maxLength={120}
        placeholder="Örn. Moda Kahvecisi"
      />

      <Text>İlçe</Text>
      <View testID="suggest-districts">
        {districts.map((d) => (
          <Pressable key={d.id} onPress={() => setDistrictSlug(d.slug)}>
            <Text style={{ fontWeight: districtSlug === d.slug ? "bold" : "normal" }}>{d.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text>Kategori</Text>
      <View testID="suggest-categories">
        {CATEGORIES.map((c) => (
          <Pressable key={c.value} onPress={() => setCategory(c.value)}>
            <Text style={{ fontWeight: category === c.value ? "bold" : "normal" }}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text>Adres (opsiyonel)</Text>
      <TextInput
        testID="suggest-address"
        value={address}
        onChangeText={setAddress}
        maxLength={200}
        placeholder="Sokak, no"
      />

      <Text>Not (opsiyonel)</Text>
      <TextInput
        testID="suggest-note"
        value={note}
        onChangeText={setNote}
        maxLength={500}
        multiline
        placeholder="Neden butik/özel olduğunu düşünüyorsun?"
      />

      {error && <Text>{error}</Text>}
      <Pressable onPress={handleSubmit} disabled={submitting}>
        <Text>{submitting ? "Gönderiliyor…" : "Gönder"}</Text>
      </Pressable>
    </ScrollView>
  );
}
