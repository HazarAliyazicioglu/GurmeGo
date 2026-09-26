"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

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
    <main
      data-testid="sifre-unuttum-page"
      className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 text-slate-950"
    >
      <div className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
            GurmeGo / Operasyon
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Şifreni sıfırla</h1>
        </div>
        {sentTo ? (
          <p role="status" className="text-sm text-slate-700">
            Bu adres kayıtlıysa <strong className="font-semibold text-slate-950">{sentTo}</strong> adresine bir
            sıfırlama linki gönderdik.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-800">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              Sıfırlama linki gönder
            </button>
          </form>
        )}
        <p className="mt-4 text-center">
          <Link href="/giris" className="text-sm font-semibold text-blue-700 hover:underline">
            Girişe dön
          </Link>
        </p>
      </div>
    </main>
  );
}
