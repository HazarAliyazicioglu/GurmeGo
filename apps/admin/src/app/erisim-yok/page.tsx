"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ErisimYokPage() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      const result = await signOut();
      // Same pattern as (protected)/layout.tsx's handleSignOut: Supabase's signOut() resolves with
      // `{ error }` rather than rejecting on failure, so a rejected-promise-only check would miss
      // that and redirect as if sign-out succeeded, silently leaving the stale session in place.
      if (result?.error) {
        setSignOutError("Çıkış yapılamadı. Tekrar deneyin.");
        return;
      }
      router.push("/giris");
    } catch {
      setSignOutError("Çıkış yapılamadı. Tekrar deneyin.");
    }
  }

  return (
    <main data-testid="erisim-yok-page">
      <h1>Bu hesabın kürasyon paneline erişim yetkisi yok</h1>
      <p>Erişim için bir admin&apos;den curator rolü istemen gerekiyor.</p>
      {signOutError && <p role="alert">{signOutError}</p>}
      <button type="button" onClick={() => void handleSignOut()}>
        Çıkış yap
      </button>
    </main>
  );
}
