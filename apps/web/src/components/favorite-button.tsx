"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue } from "@/lib/api";

const DEFAULT_LIST_NAME = "Favorilerim";

export function FavoriteButton({ venueId }: { venueId: string }) {
  const { user, session } = useAuth();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  async function handleClick() {
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!session?.access_token) return;
    const lists = await getFavoriteLists(session.access_token);
    const list = lists[0] ?? (await createFavoriteList(session.access_token, DEFAULT_LIST_NAME));
    await addFavoriteVenue(session.access_token, list.id, venueId);
    setAdded(true);
  }

  return (
    <button data-testid="favorite-button" onClick={handleClick} aria-pressed={added}>
      {added ? "Favorilerde" : "Favorilere ekle"}
    </button>
  );
}
