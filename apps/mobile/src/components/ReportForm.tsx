import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CreateReportObjectSchema } from "@gurmego/shared";
import { reportVenue } from "../lib/api";

export default function ReportForm({ venueId }: { venueId: string }) {
  const [reason, setReason] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [field, setField] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
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
      // Mirrors apps/web's report-form.tsx: a correction is only attached when the user actually
      // opened it AND named a field -- suggestedValue alone (no field) matches
      // CreateReportSchema's own refine() rejection, so it's dropped rather than sent to fail.
      await reportVenue(
        venueId,
        reason,
        correcting && field.trim()
          ? { field: field.trim(), ...(suggestedValue.trim() ? { suggestedValue: suggestedValue.trim() } : {}) }
          : undefined,
      );
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
      {correcting ? (
        <View>
          <Text>Hangi bilgi</Text>
          <TextInput
            testID="report-field"
            value={field}
            onChangeText={setField}
            maxLength={100}
            placeholder="Örn. Fiyat aralığı, Telefon, Adres"
          />
          <Text>Doğrusu ne olmalı? (opsiyonel)</Text>
          <TextInput
            testID="report-suggested-value"
            value={suggestedValue}
            onChangeText={setSuggestedValue}
            maxLength={100}
            placeholder="Örn. 0212 555 00 00"
          />
        </View>
      ) : (
        <Pressable onPress={() => setCorrecting(true)}>
          <Text>Düzeltme öner</Text>
        </Pressable>
      )}
      {error && <Text>{error}</Text>}
      <Pressable onPress={handleSubmit} disabled={submitting}>
        <Text>{submitting ? "Gönderiliyor…" : "Gönder"}</Text>
      </Pressable>
    </View>
  );
}
