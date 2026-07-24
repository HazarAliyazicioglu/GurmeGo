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
      onClick={(event) => {
        event.preventDefault();
        window.open(whatsappShareUrl(venue, window.location.href), "_blank", "noreferrer");
      }}
    >
      WhatsApp&apos;ta paylaş
    </a>
  );
}
