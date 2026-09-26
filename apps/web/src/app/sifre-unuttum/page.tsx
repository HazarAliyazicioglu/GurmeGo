"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const INPUT_CLASS =
  "min-h-12 w-full rounded-xl border border-ink/15 bg-creamPale/75 px-4 text-base font-medium text-ink outline-hidden transition placeholder:text-ink/30 hover:border-ink/30 focus:border-terracotta focus:bg-creamPale focus:ring-4 focus:ring-terracotta/10";

export default function SifreUnuttumPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { error: resetError } = await requestPasswordReset(email);
      if (resetError) setError(resetError);
      else setSentTo(email);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-[28rem] place-items-center py-10 sm:py-16">
      <section className="w-full">
        <h1 className="text-center font-serif text-4xl font-semibold tracking-[-0.04em] text-ink">Şifreni sıfırla</h1>
        <div className="mt-6 rounded-[1.75rem] border border-ink/10 bg-sandPale/70 p-5 shadow-[0_24px_60px_rgba(71,52,35,0.11)] sm:p-7">
          {sentTo ? (
            <p role="status" className="text-center text-sm font-medium leading-relaxed text-ink/70">
              Bu adres kayıtlıysa <strong className="font-bold text-ink">{sentTo}</strong> adresine bir sıfırlama linki
              gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-ink/60">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="ornek@eposta.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={INPUT_CLASS}
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
                Sıfırlama linki gönder
              </button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center">
          <Link href="/giris" className="text-sm font-bold text-ink/60 underline-offset-2 hover:text-terracottaDeep hover:underline">
            Girişe dön
          </Link>
        </p>
      </section>
    </main>
  );
}
