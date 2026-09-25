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
    <main
      data-testid="erisim-yok-page"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 py-6 text-center text-slate-950"
    >
      <h1 className="text-lg font-bold">Bu hesabın kürasyon paneline erişim yetkisi yok</h1>
      <p className="text-sm text-slate-600">Erişim için bir admin&apos;den curator rolü istemen gerekiyor.</p>
      {signOutError && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {signOutError}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Çıkış yap
      </button>
    </main>
  );
}
