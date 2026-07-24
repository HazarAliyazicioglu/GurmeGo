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
    <button
      data-testid="favorite-button"
      onClick={handleClick}
      aria-pressed={added}
      className={`group inline-flex min-h-12 w-full items-center justify-between gap-4 rounded-full border px-5 text-sm font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7] ${
        added
          ? "border-[#d75d3b] bg-[#d75d3b] text-white shadow-[0_8px_22px_rgba(158,66,43,0.24)]"
          : "border-[#201d18]/15 bg-[#faf7f0] text-[#201d18] hover:-translate-y-0.5 hover:border-[#d75d3b]/55 hover:text-[#9e422b] hover:shadow-[0_10px_28px_rgba(71,52,35,0.09)]"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`grid size-8 place-items-center rounded-full transition-colors ${
            added ? "bg-white/[0.15] text-white" : "bg-[#d75d3b]/10 text-[#d75d3b] group-hover:bg-[#d75d3b]/15"
          }`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="size-[1.1rem]">
            <path
              d="M12 20.3 4.6 13.4C-.2 8.9 6.8 2.7 12 8.1c5.2-5.4 12.2.8 7.4 5.3L12 20.3Z"
              fill={added ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {added ? "Favorilerde" : "Favorilere ekle"}
      </span>
      <span className={`text-[0.62rem] uppercase tracking-[0.16em] ${added ? "text-white/65" : "text-[#201d18]/35"}`} aria-hidden="true">
        {added ? "Eklendi" : "Kaydet"}
      </span>
    </button>
  );
}
