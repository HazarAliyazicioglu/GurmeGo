"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!role) {
      router.push("/erisim-yok");
    }
  }, [user, role, loading, router]);

  if (loading || !user || !role) return null;
  return <>{children}</>;
}
