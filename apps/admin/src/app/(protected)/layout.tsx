"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading, error, signOut } = useAuth();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      const result = await signOut();
      // Supabase's signOut() resolves with `{ error }` rather than rejecting on failure (e.g. the
      // session was already invalid server-side) — checking only for a rejected promise would miss
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

  useEffect(() => {
    // `error` means the session state is UNKNOWN (getSession() rejected), not "definitely
    // unauthenticated" — redirecting to /giris here would be wrong for a user with a perfectly valid
    // session who just hit a network blip. Render an error state instead (below) and let them retry.
    if (loading || error) return;
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!role) {
      router.push("/erisim-yok");
    }
  }, [user, role, loading, error, router]);

  if (loading) return null;

  if (error) {
    return (
      <main
        data-testid="auth-error"
        role="alert"
        className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 text-slate-950"
      >
        <div className="w-full max-w-sm border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 p-6 text-center shadow-sm">
          <p className="text-sm font-bold text-rose-900">Bir şeyler ters gitti</p>
          <p className="mt-1.5 text-sm leading-5 text-rose-800">{error}</p>
        </div>
      </main>
    );
  }

  if (!user || !role) return null;

  return (
    <>
      <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 lg:px-8">
        {signOutError && (
          <p role="alert" className="text-xs font-semibold text-rose-700">
            {signOutError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Çıkış yap
        </button>
      </header>
      {children}
    </>
  );
}
