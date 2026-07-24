"use client";
import { getVenues } from "@/lib/api";
import { useState } from "react";

const QUICK_CATEGORIES = ["kahve", "tatli", "kahvalti"] as const;

export function CategoryQuickRoute({ districtId, onSelect }: { districtId: string; onSelect: (venues: unknown[]) => void }) {
  const [active, setActive] = useState<string | null>(null);

  async function handleClick(category: string) {
    setActive(category);
    const { data } = await getVenues({ districtId, category, sort: "distance" });
    onSelect(data);
  }

  return (
    <div data-testid="category-quick-route">
      {QUICK_CATEGORIES.map((c) => (
        <button key={c} data-testid={`quick-category-${c}`} aria-pressed={active === c} onClick={() => handleClick(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
