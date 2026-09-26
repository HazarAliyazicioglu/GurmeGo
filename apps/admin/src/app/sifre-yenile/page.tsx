"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Landing page of the Supabase recovery e-mail link (same pattern as apps/web's
// /sifre-yenile): supabase-js reads the recovery token from the URL and signs the curator into a
// temporary session, so "no user once loading finishes" means the link was invalid or expired.
export default function SifreYenilePage() {
  const { user, loading, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) setError(updateError);
      else router.push("/kuyruk");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      data-testid="sifre-yenile-page"
      className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 text-slate-950"
    >
      <div className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
            GurmeGo / Operasyon
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Yeni şifre belirle</h1>
        </div>
        {loading ? (
          <p role="status" aria-live="polite" className="text-center text-sm text-slate-600">
            Yükleniyor…
          </p>
        ) : !user ? (
          <div className="space-y-3 text-center">
            <p role="alert" className="text-sm font-semibold text-rose-800">
              Bu link geçersiz veya süresi dolmuş.
            </p>
            <Link href="/sifre-unuttum" className="inline-block text-sm font-semibold text-blue-700 hover:underline">
              Yeni link iste
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Yeni şifre
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-hidden focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-3 py-2.5 text-sm text-rose-900 shadow-sm"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
            >
              Şifreyi güncelle
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
