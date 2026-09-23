"use client";

import { useEffect, useState } from "react";

// `typeof navigator.share === "function"` is checked in a mount-effect rather than `"share" in
// navigator` — the latter is `true` even when the property exists but is explicitly `undefined`
// (as jsdom/some browsers set it), which would render a button whose click handler throws.
// Deferred to a mount-effect (rather than checked during render) so this component stays safe to
// mount from a server-rendered page — same client-boundary pattern as whatsapp-share-button.tsx.
export function NativeShareButton({ venue }: { venue: { name: string } }) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!canShare) return null;

  return (
    <button
      type="button"
      data-testid="native-share-button"
      className="group inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-full border border-ink/15 bg-cream px-4 text-sm font-black text-ink transition-all hover:border-terracotta/45 hover:bg-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-creamLight"
      onClick={() => {
        // navigator.share() rejects when the user cancels the native share sheet -- that's a
        // normal, expected outcome, not an error to surface, so it's swallowed here rather than
        // left as an unhandled rejection.
        navigator.share({ title: venue.name, url: window.location.href }).catch(() => {});
      }}
    >
      <span className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-cream transition-colors group-hover:bg-terracotta" aria-hidden="true">
          <svg viewBox="0 0 20 20" className="size-4 fill-none">
            <path d="M10 3v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.5 6.5 10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.5 10v4.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Paylaş
      </span>
      <span className="text-ink/35 transition-transform group-hover:translate-x-0.5" aria-hidden="true">↗</span>
    </button>
  );
}
