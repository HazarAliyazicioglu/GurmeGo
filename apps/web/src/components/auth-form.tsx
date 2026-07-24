"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email, password);
    if (error) setError(error);
    else router.push("/favoriler");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">E-posta</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Şifre</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{mode === "signin" ? "Giriş yap" : "Kayıt ol"}</button>
    </form>
  );
}
