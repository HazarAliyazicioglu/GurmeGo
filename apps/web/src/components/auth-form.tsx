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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#201d18]/60"
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
          className="min-h-12 w-full rounded-xl border border-[#201d18]/15 bg-[#fffdf8]/75 px-4 text-base font-medium text-[#201d18] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-[#201d18]/30 hover:border-[#201d18]/30 focus:border-[#d75d3b] focus:bg-[#fffdf8] focus:ring-4 focus:ring-[#d75d3b]/10"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="password"
            className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#201d18]/60"
          >
            Şifre
          </label>
          {mode === "signup" && (
            <span className="text-[0.68rem] font-semibold text-[#201d18]/40">En az 6 karakter</span>
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
          className="min-h-12 w-full rounded-xl border border-[#201d18]/15 bg-[#fffdf8]/75 px-4 text-base font-medium tracking-[0.08em] text-[#201d18] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:tracking-[0.14em] placeholder:text-[#201d18]/25 hover:border-[#201d18]/30 focus:border-[#d75d3b] focus:bg-[#fffdf8] focus:ring-4 focus:ring-[#d75d3b]/10"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[#d75d3b]/20 bg-[#d75d3b]/[0.07] px-3.5 py-3 text-sm font-semibold leading-relaxed text-[#9e422b]"
        >
          <span
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#d75d3b]/15 text-xs font-black"
            aria-hidden="true"
          >
            !
          </span>
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#201d18] px-5 text-sm font-black text-[#f4f0e7] shadow-[0_8px_22px_rgba(32,29,24,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2d2923] hover:shadow-[0_10px_26px_rgba(32,29,24,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7] active:translate-y-0"
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
    </form>
  );
}
