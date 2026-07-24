"use client";
import { useState } from "react";
import { AuthForm } from "@/components/auth-form";

export default function GirisPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  return (
    <main>
      <AuthForm mode={mode} />
      <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
      </button>
    </main>
  );
}
