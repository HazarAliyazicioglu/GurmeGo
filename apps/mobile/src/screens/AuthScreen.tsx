import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { colors, radius, spacing, typography } from "../theme";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const result = mode === "signIn" ? await signIn(email, password) : await signUp(email, password);
    if (result.error) setError(result.error);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>GurmeGo'ya</Text>
      <Text style={styles.title}>{mode === "signIn" ? "Tekrar hoş geldin" : "Hesap oluştur"}</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-posta"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Şifre"
        placeholderTextColor={colors.inkFaint}
        secureTextEntry
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
        <Text style={styles.primaryBtnText}>{mode === "signIn" ? "Giriş yap" : "Kayıt ol"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text style={styles.switchText}>
          {mode === "signIn" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: spacing.xl, justifyContent: "center" },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accentDeep,
    marginBottom: spacing.xs,
  },
  title: { fontFamily: typography.serif, fontSize: 26, fontWeight: "600", color: colors.ink, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.paperCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13, fontWeight: "600", marginBottom: spacing.md },
  primaryBtn: {
    backgroundColor: colors.ink,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  primaryBtnText: { color: colors.paper, fontSize: 15, fontWeight: "700" },
  switchText: { color: colors.accentDeep, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
