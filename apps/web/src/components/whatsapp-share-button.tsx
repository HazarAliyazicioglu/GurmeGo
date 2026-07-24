"use client";

import type { VenueDetail as VenueDetailType } from "@gurmego/shared";

// Reads `window.location.href` only inside the click handler — never during render — so this
// component is safe to mount from a server-rendered page (`VenueDetail` stays a Server Component).
// Kept as its own client boundary rather than inlining `"use client"` into `venue-detail.tsx`,
// which would lose SSR/ISR for the whole page (see venue-map.tsx for the same pattern).
export function whatsappShareUrl(venue: VenueDetailType, url: string): string {
  const text = encodeURIComponent(`${venue.name} — GurmeGo'da keşfet: ${url}`);
  return `https://wa.me/?text=${text}`;
}

export function WhatsappShareButton({ venue }: { venue: VenueDetailType }) {
  return (
    <a
      data-testid="whatsapp-share"
      href="https://wa.me/?text="
      target="_blank"
      rel="noreferrer"
      className="group inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-full border border-[#201d18]/15 bg-[#f4f0e7] px-4 text-sm font-black text-[#201d18] transition-all hover:border-[#d75d3b]/45 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f0]"
      onClick={(event) => {
        event.preventDefault();
        window.open(whatsappShareUrl(venue, window.location.href), "_blank", "noreferrer");
      }}
    >
      <span className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-[#201d18] text-[#f4f0e7] transition-colors group-hover:bg-[#d75d3b]" aria-hidden="true">
          <svg viewBox="0 0 20 20" className="size-4 fill-none">
            <path d="M16.2 9.7a6.3 6.3 0 0 1-9.3 5.5L3.5 16l.9-3.2a6.3 6.3 0 1 1 11.8-3.1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7.1 6.7c.2-.4.4-.4.7-.4.2 0 .3 0 .4.3l.7 1.5c.1.2 0 .4-.1.5l-.5.6c-.1.1-.1.3 0 .5.5.9 1.2 1.6 2.1 2 .2.1.4.1.5-.1l.6-.7c.1-.2.3-.2.5-.1l1.5.7c.2.1.3.3.3.5 0 .4-.2 1.1-.7 1.4-.5.4-1.2.6-2.2.3-1.1-.3-2.4-1-3.5-2.1-1.1-1.1-1.8-2.4-2-3.4-.2-.8.1-1.3.4-1.7.4-.4.8-.7 1.3-.8Z" fill="currentColor" />
          </svg>
        </span>
        WhatsApp&apos;ta paylaş
      </span>
      <span className="text-[#201d18]/35 transition-transform group-hover:translate-x-0.5" aria-hidden="true">↗</span>
    </a>
  );
}