"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      setError(null);
      if (mode === "signup") {
        const { error, needsConfirmation } = await signUp(email, password);
        if (error) setError(error);
        else if (needsConfirmation) setConfirmEmail(email);
        else router.push("/favoriler");
        return;
      }
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else router.push("/favoriler");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmEmail) {
    return (
      <div role="status" className="space-y-3 text-center">
        <p className="font-serif text-2xl font-semibold text-ink">E-postanı kontrol et</p>
        <p className="text-sm font-medium leading-relaxed text-ink/60">
          <strong className="font-bold text-ink">{confirmEmail}</strong> adresine bir doğrulama linki gönderdik. Linke
          tıkladıktan sonra giriş yapabilirsin. Gelmediyse spam klasörüne de bak.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-ink/60"
        >
          E-posta
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="ornek@eposta.com"
          autoComplete="email"
          className="min-h-12 w-full rounded-xl border border-ink/15 bg-creamPale/75 px-4 text-base font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-hidden transition placeholder:text-ink/30 hover:border-ink/30 focus:border-terracotta focus:bg-creamPale focus:ring-4 focus:ring-terracotta/10"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="password"
            className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-ink/60"
          >
            Şifre
          </label>
          {mode === "signup" && (
            <span className="text-[0.68rem] font-semibold text-ink/40">En az 6 karakter</span>
          )}
        </div>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          placeholder="••••••••"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="min-h-12 w-full rounded-xl border border-ink/15 bg-creamPale/75 px-4 text-base font-medium tracking-[0.08em] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-hidden transition placeholder:tracking-[0.14em] placeholder:text-ink/25 hover:border-ink/30 focus:border-terracotta focus:bg-creamPale focus:ring-4 focus:ring-terracotta/10"
        />
        {mode === "signin" && (
          <Link href="/sifre-unuttum" className="inline-block text-xs font-semibold text-ink/55 underline-offset-2 hover:text-terracottaDeep hover:underline">
            Şifremi unuttum
          </Link>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-terracotta/20 bg-terracotta/[0.07] px-3.5 py-3 text-sm font-semibold leading-relaxed text-terracottaDeep"
        >
          <span
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-terracotta/15 text-xs font-black"
            aria-hidden="true"
          >
            !
          </span>
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-cream shadow-[0_8px_22px_rgba(32,29,24,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-inkSoft hover:shadow-[0_10px_26px_rgba(32,29,24,0.22)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none"
      >
        {mode === "signin" ? "Giriş yap" : "Kayıt ol"}
        <svg
          viewBox="0 0 20 20"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden="true"
        >
          <path
            d="M4 10h11m-4-4 4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {mode === "signup" && (
        <p className="text-center text-xs font-medium leading-relaxed text-ink/50">
          Kayıt olarak{" "}
          <Link href="/kullanim-kosullari" className="font-semibold underline underline-offset-2 hover:text-terracottaDeep">
            Kullanım Koşulları
          </Link>
          &apos;nı ve{" "}
          <Link href="/gizlilik" className="font-semibold underline underline-offset-2 hover:text-terracottaDeep">
            Gizlilik Politikası
          </Link>
          &apos;nı kabul etmiş olursun.
        </p>
      )}
    </form>
  );
}
