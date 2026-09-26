"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const LINK_CLASS =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 bg-white/45 px-3.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors hover:border-ink/35 hover:bg-white/75 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

// Renders nothing until the session resolves so a signed-in user never sees a "Giriş yap" flash.
export function AuthNav() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? (
    <Link href="/favoriler" className={LINK_CLASS}>
      Favorilerim
    </Link>
  ) : (
    <Link href="/giris" className={LINK_CLASS}>
      Giriş yap
    </Link>
  );
}
