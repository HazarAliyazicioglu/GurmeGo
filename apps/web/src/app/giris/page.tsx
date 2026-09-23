"use client";
import { useState } from "react";
import { AuthForm } from "@/components/auth-form";

export default function GirisPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <main className="relative isolate grid place-items-center overflow-hidden py-10 sm:py-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,rgba(231,121,89,0.13),transparent_68%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-[8%] top-[14%] -z-10 hidden size-24 rounded-full border border-ink/[0.06] sm:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[12%] right-[7%] -z-10 hidden size-2 rounded-full bg-terracotta/40 shadow-[18px_9px_0_rgba(215,93,59,0.16),-14px_21px_0_rgba(32,29,24,0.09)] sm:block"
        aria-hidden="true"
      />

      <section className="w-full max-w-[28rem]">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-7 bg-ink/15" aria-hidden="true" />
            <span className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-terracottaDeep">
              Kişisel rota defteri
            </span>
            <span className="h-px w-7 bg-ink/15" aria-hidden="true" />
          </div>

          <h1 className="font-serif text-[2.55rem] font-semibold leading-[0.98] tracking-[-0.045em] text-ink sm:text-5xl">
            {mode === "signin" ? "Rotana devam et." : "Rotanı oluşturmaya başla."}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-ink/55">
            {mode === "signin"
              ? "Kaydettiğin İstanbul seçkileri seni bekliyor."
              : "Beğendiğin mekanları kaydet, kendi İstanbul rehberini oluştur."}
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-sandPale/70 shadow-[0_24px_60px_rgba(71,52,35,0.11)] backdrop-blur-sm">
          <div className="p-5 sm:p-7">
            <AuthForm mode={mode} />
          </div>

          <div className="border-t border-ink/10 bg-white/25 px-5 py-4 text-center sm:px-7">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="min-h-11 rounded-full px-4 text-sm font-bold text-ink/60 transition-colors hover:bg-white/45 hover:text-terracottaDeep focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-sandPale"
            >
              {mode === "signin" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-[0.68rem] font-semibold leading-relaxed text-ink/35">
          GurmeGo · İstanbul&apos;un butik mekan rehberi
        </p>
      </section>
    </main>
  );
}
