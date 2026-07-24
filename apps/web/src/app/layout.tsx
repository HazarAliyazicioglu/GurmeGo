import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "GurmeGo — İstanbul'un butik mekan rehberi",
  description: "Kadıköy, Beşiktaş ve Beyoğlu'nda kürasyonlu butik mekanlar.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a1611",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
