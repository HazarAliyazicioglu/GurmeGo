import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { reportVenue } from "../lib/api";
import { colors, radius, spacing } from "../theme";

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
      <View style={styles.card}>
        <Text style={styles.thanks}>Teşekkürler, bildirimin kürasyon ekibine iletildi.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Bilgi yanlış mı?</Text>
      <TextInput
        testID="report-reason"
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Örn. fiyat aralığı güncel değil"
        placeholderTextColor={colors.inkFaint}
        multiline
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={({ pressed }) => [styles.submitBtn, submitting && styles.submitBtnPending, pressed && styles.submitBtnPending]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>{submitting ? "Gönderiliyor…" : "Gönder"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: spacing.sm },
  input: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: "top",
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600", marginBottom: spacing.sm },
  submitBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  submitBtnPending: { opacity: 0.6 },
  submitBtnText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
  thanks: { fontSize: 13, fontWeight: "600", color: colors.positive },
});
