import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { reportVenue } from "../lib/api";

export default function ReportForm({ venueId }: { venueId: string }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await reportVenue(venueId, reason);
      setSubmitted(true);
    } catch {
      setError("Bildirim gönderilemedi, lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View>
        <Text>Teşekkürler, bildirimin kürasyon ekibine iletildi.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>Bilgi yanlış mı?</Text>
      <TextInput
        testID="report-reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Örn. fiyat aralığı güncel değil"
        multiline
      />
      {error && <Text>{error}</Text>}
      <Pressable onPress={handleSubmit} disabled={submitting}>
        <Text>{submitting ? "Gönderiliyor…" : "Gönder"}</Text>
      </Pressable>
    </View>
  );
}
