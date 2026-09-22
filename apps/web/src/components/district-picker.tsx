"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNearestDistrict } from "@/lib/api";
import { useLocationContext } from "@/lib/location-context";
import type { District } from "@gurmego/shared";

export function useSuggestedDistrict(currentSlug: string): District | null {
  const coords = useLocationContext();
  const [suggested, setSuggested] = useState<District | null>(null);

  useEffect(() => {
    if (!coords) return;
    getNearestDistrict(coords)
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
    <div
      data-testid="district-picker"
      className="sticky top-16 z-30 -mx-4 border-b border-ink/10 bg-cream/95 px-4 pb-3 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6"
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-ink/45">
          {"\u0130l\u00e7e rehberi"}
        </span>
        <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
        <span className="text-[0.62rem] font-semibold tabular-nums text-ink/35">
          {districts.length.toString().padStart(2, "0")} {"se\u00e7ki"}
        </span>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="navigation" aria-label={"\u0130l\u00e7e se\u00e7imi"}>
        {districts.map((d) => {
          const isCurrent = d.slug === current;

          return (
            <button
              key={d.slug}
              type="button"
              data-testid={`district-${d.slug}`}
              onClick={() => handleSelect(d.slug)}
              aria-current={isCurrent ? "page" : undefined}
              className={[
                "relative min-h-11 shrink-0 rounded-full border px-5 text-sm font-bold transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                isCurrent
                  ? "border-ink bg-ink text-cream shadow-[0_5px_16px_rgba(32,29,24,0.16)]"
                  : "border-ink/15 bg-white/40 text-ink/65 hover:border-ink/35 hover:bg-white/70 hover:text-ink",
              ].join(" ")}
            >
              {isCurrent && <span className="mr-2 inline-block size-1.5 rounded-full bg-terracottaLight align-middle" aria-hidden="true" />}
              {d.name}
            </button>
          );
        })}
      </div>
      {suggested && (
        <details open className="group absolute left-4 right-4 top-full mt-2 overflow-hidden rounded-2xl border border-terracotta/20 bg-sand shadow-[0_12px_32px_rgba(71,52,35,0.14)] sm:left-6 sm:right-6 [&:not([open])]:hidden">
          <summary className="absolute right-1.5 top-1.5 z-10 grid size-10 cursor-pointer list-none place-items-center rounded-full text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terracotta [&::-webkit-details-marker]:hidden">
            <span className="sr-only">{"Konum \u00f6nerisini kapat"}</span>
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
              <path d="m6 6 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </summary>

          <div className="flex items-center gap-3 py-3 pl-3 pr-12">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-terracotta text-white shadow-[0_4px_12px_rgba(215,93,59,0.25)]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-5 fill-none">
                <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="10" r="2.2" fill="currentColor" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-terracottaDeep">
                {"Yak\u0131n\u0131nda bir se\u00e7ki var"}
              </p>
              <button
                type="button"
                data-testid="district-suggestion"
                onClick={() => handleSelect(suggested.slug)}
                className="mt-0.5 min-h-6 text-left text-sm font-bold leading-snug text-ink underline decoration-terracotta/45 decoration-1 underline-offset-4 transition-colors hover:text-terracottaDeep focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
              >
          {suggested.name}'e mi geçmek istersin?
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
