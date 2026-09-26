import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CreateReportObjectSchema } from "@gurmego/shared";
import { reportVenue } from "../lib/api";

export default function ReportForm({ venueId }: { venueId: string }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    // Denetim raporu (2026-09-25) "ReportForm'da client validasyon yok": validates against the
    // SAME `CreateReportSchema` the backend enforces (packages/shared), not a re-guessed rule, so
    // an empty/too-short/too-long reason never even reaches the network.
    const validation = CreateReportObjectSchema.shape.reason.safeParse(reason);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      // zod's built-in messages are English; the rest of this screen is Turkish, so the code
      // (not the message text) picks the copy -- "too_small"/"too_big" are the only ones
      // `min(5).max(500)` can produce.
      setError(
        issue?.code === "too_big"
          ? "Bildirim en fazla 500 karakter olabilir."
          : "Bildirim en az 5 karakter olmalı.",
      );
      return;
    }
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
