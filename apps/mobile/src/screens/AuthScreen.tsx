import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth-context";

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
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="E-posta" autoCapitalize="none" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Şifre" secureTextEntry />
      {error && <Text>{error}</Text>}
      <Pressable onPress={handleSubmit}>
        <Text>{mode === "signIn" ? "Giriş yap" : "Kayıt ol"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text>{mode === "signIn" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}</Text>
      </Pressable>
    </View>
  );
}
