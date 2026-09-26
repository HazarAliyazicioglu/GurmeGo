import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { AuthNav } from "@/components/auth-nav";
import { PRIMITIVE_COLORS } from "@/lib/colors";

// Self-hosted by next/font (no request to Google at runtime, no CLS) -- only the heading font
// (`font-serif`) changes in this pass; body text stays on the system sans (idea-red-team: a
// second font is a second, unverified risk surface with no matching benefit shown).
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "GurmeGo — İstanbul'un butik mekan rehberi",
  description: "Kadıköy, Beşiktaş ve Beyoğlu'nda kürasyonlu butik mekanlar.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: PRIMITIVE_COLORS.cream,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={fraunces.variable}>
      <body className="min-h-dvh bg-cream text-ink antialiased selection:bg-terracotta selection:text-white">
        <ServiceWorkerRegister />
        <AuthProvider>
          <div className="min-h-dvh">
            <header className="sticky top-0 z-40 h-16 border-b border-ink/10 bg-cream/95 backdrop-blur-md">
              <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link
                  href="/"
                  className="group -ml-2 flex min-h-11 items-center gap-2 rounded-full px-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  aria-label="GurmeGo ana sayfa"
                >
                  <span
                    className="grid size-9 place-items-center rounded-full bg-ink text-cream transition-transform duration-200 group-hover:-rotate-6"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 32 32" className="size-5 fill-none" role="img">
                      <path
                        d="M8 7v7a4 4 0 0 0 8 0V7M12 7v18M22 7v18M19 7c3.5 0 5 2.4 5 5.2S22.4 17 19 17"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[1.08rem] font-black tracking-[-0.045em]">
                    Gurme<span className="text-terracotta">Go</span>
                  </span>
                </Link>

                <nav aria-label="Ana navigasyon" className="flex items-center gap-2">
                  <Link
                    href="/"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 bg-white/45 px-3.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors hover:border-ink/35 hover:bg-white/75 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  >
                    <span className="size-1.5 rounded-full bg-terracotta" aria-hidden="true" />
                    {"Se\u00e7kiler"}
                  </Link>
                  <Link
                    href="/mekan-oner"
                    className="hidden min-h-11 items-center gap-2 rounded-full border border-ink/15 bg-white/45 px-3.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors hover:border-ink/35 hover:bg-white/75 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream sm:inline-flex"
                  >
                    Mekan \u00f6ner
                  </Link>
                  <AuthNav />
                </nav>
              </div>
            </header>

            <div className="mx-auto w-full max-w-6xl [&>main]:min-h-[calc(100dvh-4rem)] [&>main]:px-4 [&>main]:pb-16 [&>main]:sm:px-6 [&>main>h1]:mt-10 [&>main>h1]:font-serif [&>main>h1]:text-5xl [&>main>h1]:font-semibold [&>main>h1]:tracking-[-0.04em] [&>main>p]:mt-3 [&>main>p]:text-sm [&>main>p]:font-medium [&>main>p]:text-ink/55">
              {children}
            </div>

            <footer className="border-t border-ink/10">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs font-semibold text-ink/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p>GurmeGo · İstanbul&apos;un butik mekan rehberi</p>
                <nav aria-label="Yasal" className="flex gap-4">
                  <Link href="/mekan-oner" className="hover:text-terracottaDeep hover:underline">
                    Mekan öner
                  </Link>
                  <Link href="/gizlilik" className="hover:text-terracottaDeep hover:underline">
                    Gizlilik
                  </Link>
                  <Link href="/kullanim-kosullari" className="hover:text-terracottaDeep hover:underline">
                    Kullanım Koşulları
                  </Link>
                </nav>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
