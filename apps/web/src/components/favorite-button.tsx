"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { getFavoriteLists, createFavoriteList, addFavoriteVenue } from "@/lib/api";

const DEFAULT_LIST_NAME = "Favorilerim";

export function FavoriteButton({ venueId }: { venueId: string }) {
  const { user, session } = useAuth();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [initialCheckPending, setInitialCheckPending] = useState(true);
  const latestClickRequest = useRef(0);
  // Separate from `latestClickRequest`: that counter is also bumped by the effect below on
  // every `venueId`/user/session change, which is the right thing for guarding `setAdded`
  // (a stale click must never apply its result to a *different* venue) but the wrong thing
  // for guarding `pending` — if they shared a counter, a venueId change while a click is
  // in flight would permanently stick `pending` at `true` (the in-flight click's `requestId`
  // would never again match `latestClickRequest.current`), disabling the button forever.
  // `latestPendingRequest` is bumped only by `handleClick` itself, so it only guards against
  // a genuinely newer overlapping click superseding an older one.
  const latestPendingRequest = useRef(0);

  useEffect(() => {
    // Invalidate any in-flight `handleClick` request: this effect re-runs whenever
    // `venueId` (or the user/session) changes, which is exactly when a stale click's
    // eventual `setAdded(true)` would otherwise apply to the wrong venue (see
    // `handleClick`'s `requestId` guard below).
    latestClickRequest.current += 1;
    // MINOR fix (final whole-branch review): `latestPendingRequest` (and the `pending` boolean
    // it guards) were NOT invalidated here -- only `latestClickRequest` was. If a click was
    // in-flight when venueId/user/session changed, the button for the NEW context still showed
    // `pending: true`, blocked on a request that belonged to the OLD context, until that
    // (possibly slow/hung) old request's own `finally` resolved. Bumping
    // `latestPendingRequest.current` here means that old request's `finally` guard
    // (`pendingRequestId === latestPendingRequest.current`) will no longer match, so it can no
    // longer flip `pending` for the new context either way -- which is exactly why `pending` must
    // also be explicitly reset to `false` here (the old request's `finally` is now permanently
    // disqualified from doing it). This does NOT merge the two counters back into one: they stay
    // separate refs, bumped independently, each still guarding only its own concern.
    latestPendingRequest.current += 1;
    setPending(false);
    if (!user || !session?.access_token) {
      setAdded(false);
      setInitialCheckPending(false);
      return;
    }
    let cancelled = false;
    setAdded(false);
    setInitialCheckPending(true);
    getFavoriteLists(session.access_token)
      .then((lists) => {
        if (cancelled) return;
        const isFavorited = lists.some((list) => list.favorites.some((favorite) => favorite.venueId === venueId));
        if (isFavorited) setAdded(true);
      })
      .catch(() => {
        // Initial "already favorited" check failed — leave `added` as false and
        // unblock the button; favoriting still works via handleClick's own flow.
      })
      .finally(() => {
        if (!cancelled) setInitialCheckPending(false);
      });
    return () => {
      cancelled = true;
    };
    // Depend on `user.id` (a stable primitive) rather than the `user` object itself:
    // some auth-context consumers (and this component's own tests) return a fresh
    // `user` object reference on every render even when the underlying user hasn't
    // changed, which would otherwise re-trigger this effect on every render and
    // cause `initialCheckPending` to ping-pong between true/false forever.
  }, [user?.id, session?.access_token, venueId]);

  async function handleClick() {
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!session?.access_token) return;
    const requestId = ++latestClickRequest.current;
    const pendingRequestId = ++latestPendingRequest.current;
    setPending(true);
    try {
      const lists = await getFavoriteLists(session.access_token);
      const list = lists[0] ?? (await createFavoriteList(session.access_token, DEFAULT_LIST_NAME));
      await addFavoriteVenue(session.access_token, list.id, venueId);
      if (requestId === latestClickRequest.current) setAdded(true);
    } catch {
      // Add-to-favorites failed (network/API error) — there is no error-display UI in
      // this component to route it to; swallow so the rejection doesn't propagate as an
      // unhandled promise rejection. The button re-enables via `finally` below so the
      // user can retry.
    } finally {
      // Only reset `pending` when this is still the LATEST click request. If the user
      // clicked again before this one resolved, `latestPendingRequest.current` has since
      // moved past `pendingRequestId` — this (now-stale) request's `finally` must not flip
      // `pending` back to false while the newer request is still genuinely in flight,
      // otherwise the button would prematurely re-enable and allow a third overlapping
      // request. Same request-id/generation-counter convention as `favoriler/page.tsx`'s
      // `latestListsRequest` and `discovery-client.tsx`'s `latestRequest`.
      if (pendingRequestId === latestPendingRequest.current) setPending(false);
    }
  }

  return (
    <button
      data-testid="favorite-button"
      onClick={handleClick}
      disabled={pending || initialCheckPending}
      aria-pressed={added}
      className={`group inline-flex min-h-12 w-full items-center justify-between gap-4 rounded-full border px-5 text-sm font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
        added
          ? "border-terracotta bg-terracotta text-white shadow-[0_8px_22px_rgba(158,66,43,0.24)]"
          : "border-ink/15 bg-creamLight text-ink hover:-translate-y-0.5 hover:border-terracotta/55 hover:text-terracottaDeep hover:shadow-[0_10px_28px_rgba(71,52,35,0.09)]"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`grid size-8 place-items-center rounded-full transition-colors ${
            added ? "bg-white/[0.15] text-white" : "bg-terracotta/10 text-terracotta group-hover:bg-terracotta/15"
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
      <span className={`text-[0.62rem] uppercase tracking-[0.16em] ${added ? "text-white/65" : "text-ink/35"}`} aria-hidden="true">
        {added ? "Eklendi" : "Kaydet"}
      </span>
    </button>
  );
}
