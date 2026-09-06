import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ServiceWorkerRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "GurmeGo — İstanbul'un butik mekan rehberi",
  description: "Kadıköy, Beşiktaş ve Beyoğlu'nda kürasyonlu butik mekanlar.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f4f0e7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-[#f4f0e7] text-[#201d18] antialiased selection:bg-[#d75d3b] selection:text-white">
        <ServiceWorkerRegister />
        <AuthProvider>
          <div className="min-h-dvh">
            <header className="sticky top-0 z-40 h-16 border-b border-[#201d18]/10 bg-[#f4f0e7]/95 backdrop-blur-md">
              <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link
                  href="/"
                  className="group -ml-2 flex min-h-11 items-center gap-2 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7]"
                  aria-label="GurmeGo ana sayfa"
                >
                  <span
                    className="grid size-9 place-items-center rounded-full bg-[#201d18] text-[#f4f0e7] transition-transform duration-200 group-hover:-rotate-6"
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
                    Gurme<span className="text-[#d75d3b]">Go</span>
                  </span>
                </Link>

                <nav aria-label="Ana navigasyon">
                  <Link
                    href="/"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#201d18]/15 bg-white/45 px-3.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors hover:border-[#201d18]/35 hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7]"
                  >
                    <span className="size-1.5 rounded-full bg-[#d75d3b]" aria-hidden="true" />
                    {"Se\u00e7kiler"}
                  </Link>
                </nav>
              </div>
            </header>

            <div className="mx-auto w-full max-w-6xl [&>main]:min-h-[calc(100dvh-4rem)] [&>main]:px-4 [&>main]:pb-16 [&>main]:sm:px-6 [&>main>h1]:mt-10 [&>main>h1]:font-serif [&>main>h1]:text-5xl [&>main>h1]:font-semibold [&>main>h1]:tracking-[-0.04em] [&>main>p]:mt-3 [&>main>p]:text-sm [&>main>p]:font-medium [&>main>p]:text-[#201d18]/55">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
