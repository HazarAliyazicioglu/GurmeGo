"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNearestDistrict } from "@/lib/api";
import { useGeolocation } from "@/lib/use-geolocation";
import type { District } from "@gurmego/shared";

export function useSuggestedDistrict(currentSlug: string): District | null {
  const coords = useGeolocation();
  const [suggested, setSuggested] = useState<District | null>(null);

  useEffect(() => {
    if (!coords) return;
    getNearestDistrict(coords.lat, coords.lng)
      .then((nearest) => {
        if (nearest && nearest.slug !== currentSlug) setSuggested(nearest);
      })
      .catch(() => {});
  }, [coords, currentSlug]);

  return suggested;
}

export function DistrictPicker({ districts, current }: { districts: District[]; current: string }) {
  const router = useRouter();
  const suggested = useSuggestedDistrict(current);

  function handleSelect(slug: string) {
    router.push(`/${slug}`);
  }

  return (
    <div data-testid="district-picker">
      {districts.map((d) => (
        <button key={d.slug} data-testid={`district-${d.slug}`} onClick={() => handleSelect(d.slug)} aria-current={d.slug === current}>
          {d.name}
        </button>
      ))}
      {suggested && (
        <button data-testid="district-suggestion" onClick={() => handleSelect(suggested.slug)}>
          {suggested.name}'e mi geçmek istersin?
        </button>
      )}
    </div>
  );
}
