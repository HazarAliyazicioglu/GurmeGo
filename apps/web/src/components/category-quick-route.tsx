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
    <div data-testid="category-quick-route" className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-4 px-1">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#d75d3b]">Hızlı rota</p>
          <h2 className="mt-1 font-serif text-xl font-semibold tracking-[-0.025em]">Bugün neyin peşindesin?</h2>
        </div>
        <svg viewBox="0 0 28 28" className="size-7 shrink-0 text-[#201d18]/18" aria-hidden="true">
          <path d="M5 22c2-7 5-11 9-11 3.5 0 4 4 7 4 1.2 0 2-.6 2-2 0-2-2-4-5-4M5 22l2-5m-2 5 5-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CATEGORIES.map((c, index) => {
          const isActive = active === c;

          return (
            <button
              key={c}
              data-testid={`quick-category-${c}`}
              aria-pressed={active === c}
              onClick={() => handleClick(c)}
              className={[
                "group relative min-h-[4.75rem] min-w-[9rem] flex-1 overflow-hidden rounded-[1.15rem] border px-4 py-3 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f0e7]",
                isActive
                  ? "border-[#201d18] bg-[#201d18] text-[#f4f0e7] shadow-[0_8px_22px_rgba(32,29,24,0.15)]"
                  : "border-[#201d18]/12 bg-[#eadfce]/65 text-[#201d18] hover:border-[#201d18]/30 hover:bg-[#eadfce]",
              ].join(" ")}
            >
              <span className={["absolute right-3 top-2 font-serif text-3xl font-semibold italic transition-colors", isActive ? "text-[#e77959]/55" : "text-[#d75d3b]/20"].join(" ")} aria-hidden="true">
                0{index + 1}
              </span>
              <span className={["block text-[0.58rem] font-black uppercase tracking-[0.15em]", isActive ? "text-[#e77959]" : "text-[#9e422b]"].join(" ")}>Rota</span>
              <span className="mt-2 block font-serif text-lg font-semibold capitalize tracking-[-0.02em]">{c}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}