import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../lib/auth-context";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const navigation = useNavigation();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Denetim raporu §4.2 "Kayıt sonrası e-posta onayı gerektiği söylenmiyor": shown instead of
  // navigating back, since a fresh sign-up isn't signed in yet (Supabase requires email
  // confirmation first) -- returning to the previous screen here would look successful while the
  // user still can't actually do whatever they came here to do.
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  // Denetim raporu (2026-09-25) "double-submit guard yok": a second tap before the first
  // request resolves fired signIn/signUp twice (e.g. a slow connection where the user taps again
  // thinking the first tap didn't register). A ref guards the check synchronously -- two presses
  // fired back-to-back both run before React commits the `submitting` state update, so a state
  // read here would still see the stale `false` on the second call.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setConfirmationMessage(null);
    try {
      await submit();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function submit() {
    if (mode === "signIn") {
      const result = await signIn(email, password);
      if (result.error) setError(result.error);
      // Denetim raporu §4.2 "Giriş yaptıktan sonra hiçbir şey olmuyor": this screen is only ever
      // reached BY navigating to it, so a successful sign-in returns to whatever screen led here.
      else navigation.goBack();
    } else {
      const result = await signUp(email, password);
      if (result.error) setError(result.error);
      else setConfirmationMessage("Kayıt başarılı! Giriş yapabilmek için e-postanı onayla.");
    }
  }

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="E-posta" autoCapitalize="none" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Şifre" secureTextEntry />
      {error && <Text>{error}</Text>}
      {confirmationMessage && <Text>{confirmationMessage}</Text>}
      <Pressable onPress={handleSubmit} disabled={submitting}>
        <Text>{mode === "signIn" ? "Giriş yap" : "Kayıt ol"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text>{mode === "signIn" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}</Text>
      </Pressable>
    </View>
  );
}
