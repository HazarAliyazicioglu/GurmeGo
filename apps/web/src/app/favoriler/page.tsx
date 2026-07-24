"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getFavoriteLists } from "@/lib/api";
import type { FavoriteList } from "@gurmego/shared";

export default function FavorilerPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<FavoriteList[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/giris");
      return;
    }
    if (session?.access_token) {
      getFavoriteLists(session.access_token).then(setLists);
    }
  }, [user, session, loading, router]);

  if (loading || !user) return null;

  return (
    <main data-testid="favoriler-page">
      {lists.map((list) => (
        <div key={list.id}>{list.name}</div>
      ))}
    </main>
  );
}
