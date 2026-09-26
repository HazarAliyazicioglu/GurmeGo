"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Landing page of the Supabase recovery e-mail link: supabase-js reads the recovery token from the
// URL and signs the user into a temporary session, so "no user once loading finishes" means the
// link was invalid or expired.
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
      else router.push("/favoriler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-[28rem] place-items-center py-10 sm:py-16">
      <section className="w-full">
        <h1 className="text-center font-serif text-4xl font-semibold tracking-[-0.04em] text-ink">Yeni şifre belirle</h1>
        <div className="mt-6 rounded-[1.75rem] border border-ink/10 bg-sandPale/70 p-5 shadow-[0_24px_60px_rgba(71,52,35,0.11)] sm:p-7">
          {loading ? (
            <p role="status" aria-live="polite" className="text-center text-sm font-medium text-ink/60">
              Yükleniyor…
            </p>
          ) : !user ? (
            <div className="space-y-4 text-center">
              <p role="alert" className="text-sm font-semibold text-terracottaDeep">
                Bu link geçersiz veya süresi dolmuş.
              </p>
              <Link href="/sifre-unuttum" className="inline-block text-sm font-bold text-ink underline underline-offset-2 hover:text-terracottaDeep">
                Yeni link iste
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-ink/60">
                  Yeni şifre
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-ink/15 bg-creamPale/75 px-4 text-base font-medium text-ink outline-hidden transition placeholder:text-ink/30 hover:border-ink/30 focus:border-terracotta focus:bg-creamPale focus:ring-4 focus:ring-terracotta/10"
                />
              </div>
              {error && (
                <p role="alert" className="rounded-xl border border-terracotta/20 bg-terracotta/[0.07] px-3.5 py-3 text-sm font-semibold text-terracottaDeep">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="min-h-12 w-full cursor-pointer rounded-full bg-ink px-5 text-sm font-black text-cream transition-all hover:-translate-y-0.5 hover:bg-inkSoft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-60"
              >
                Şifreyi güncelle
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
