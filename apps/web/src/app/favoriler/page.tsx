"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getFavoriteLists, createFavoriteList } from "@/lib/api";
import type { FavoriteList } from "@gurmego/shared";

export default function FavorilerPage() {
  const { user, session, loading, signOut } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<FavoriteList[] | null>(null);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  // Guards against the privacy-sensitive race where a `getFavoriteLists` request (or a
  // `createFavoriteList` submission) is still in flight when the session changes (e.g. logout
  // followed by a different user logging back in before the first request settles) -- without
  // this, a stale response could resolve AFTER the session change and render User A's data into
  // User B's view. Every session-identity change (see the render-time reset below and the effect)
  // bumps this counter, so any response captured under the old requestId is discarded, whether it
  // came from the GET fetch or from a create-list submission. Mirrors the same `requestId` guard
  // `favorite-button.tsx` uses for its own session-change race.
  const latestListsRequest = useRef(0);
  // Sixth Codex cross-model review pass (Task 27, MAJOR): `latestListsRequest` is shared with the
  // GET-fetch effect below, which bumps it on every `session?.access_token` change -- including a
  // same-user token refresh that has nothing to do with a create-list submission's own staleness.
  // Using `identity` (a plain string) instead of that counter fixed the token-refresh case, but
  // introduced its own: if identity flips A -> B -> A while an OLD A request is still in flight,
  // and a NEW A request then starts, the old request's `identity` (captured back when it started)
  // matches `listsIdentityRef.current` again by the time it resolves -- indistinguishable from
  // still being current. A dedicated, monotonic counter -- bumped ONLY by an actual identity
  // change (render-time reset below) and by handleCreateList's own start, never by the GET-fetch
  // effect's unrelated token-refresh re-runs -- has neither flaw: it can't be "same value again"
  // like a re-used identity string can, and it isn't polluted by same-identity token refreshes.
  const latestCreateRequest = useRef(0);

  // `user?.id` is the identity `lists` was rendered for. This is intentionally checked and, if
  // stale, corrected DURING render (React's "adjusting state while rendering" pattern) rather than
  // in a `useEffect` -- an effect only runs AFTER React commits/paints, which leaves a real window
  // where a committed frame shows User A's `lists` under User B's already-active session. Comparing
  // against a ref recorded on a previous render and calling `setState` synchronously here means
  // React discards this render's output and re-renders with `lists` already cleared BEFORE
  // anything paints -- no committed frame with mismatched owner and session ever exists.
  const identity = user?.id ?? null;
  const listsIdentityRef = useRef<string | null>(identity);
  if (listsIdentityRef.current !== identity) {
    listsIdentityRef.current = identity;
    ++latestListsRequest.current;
    ++latestCreateRequest.current;
    if (lists !== null) setLists(null);
    // MAJOR fix (final whole-branch review): the render-time identity-gated clear above only
    // reset `lists`. `newListName` (the create-list input's typed-but-not-submitted text) and
    // `creating` (the create-list mutation's loading flag) are separate session-scoped UI state
    // that were NOT cleared -- meaning if User A typed a partial list name (or had a create-list
    // submission in flight) and the session then changed to User B, User B could still see User
    // A's typed text (or a stuck loading state) in the shared input. Same class of cross-account
    // leak this identity-gated clear exists to close; extend it to all session-scoped local state
    // in this component, not just `lists`.
    if (newListName !== "") setNewListName("");
    if (creating) setCreating(false);
  }

  async function handleSignOut() {
    setSignOutError(null);
    try {
      const result = await signOut();
      // Supabase's signOut() resolves with `{ error }` rather than rejecting on failure -- checking
      // only for a rejected promise would miss that and redirect as if sign-out succeeded, leaving
      // the stale session in place. Same pattern as apps/admin's protected layout.
      if (result?.error) {
        setSignOutError("Çıkış yapılamadı. Tekrar deneyin.");
        return;
      }
      router.push("/giris");
    } catch {
      setSignOutError("Çıkış yapılamadı. Tekrar deneyin.");
    }
  }

  async function handleCreateList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name || !session?.access_token || creating) return;
    setCreating(true);
    const requestId = ++latestCreateRequest.current;
    try {
      const created = await createFavoriteList(session.access_token, name);
      if (requestId !== latestCreateRequest.current) {
        // The session changed while this create-list request was in flight -- applying it now
        // would append User A's newly-created list into User B's `lists` state. Drop it silently
        // (matching how the stale-GET response case is handled) rather than mutate the wrong
        // session's data.
        console.warn("Discarded createFavoriteList response: session changed before it resolved.");
        return;
      }
      setLists((prev) => [...(prev ?? []), created]);
      setNewListName("");
    } finally {
      // TASK 27 fix (Codex cross-model review of Task 26, MAJOR): this used to be an unconditional
      // `setCreating(false)`. A stale (session-changed) request's `finally` still fires whenever it
      // eventually settles, with no check that it's still the latest request -- it would clobber a
      // NEWER request's own genuinely-in-flight `creating` state back to `false`, letting the new
      // session's submit button re-enable (and be double-clicked) while its own request is still
      // pending. `latestCreateRequest` (see its own comment above) is dedicated to exactly this
      // check, so it's neither polluted by the GET-effect's same-user token refreshes nor
      // re-usable like an identity string across an A -> B -> A round trip.
      if (requestId === latestCreateRequest.current) setCreating(false);
    }
  }

  useEffect(() => {
    const requestId = ++latestListsRequest.current;
    if (!loading && !user) {
      router.push("/giris");
      return;
    }
    if (session?.access_token) {
      // Clear any previous session's lists immediately rather than leaving them on screen until
      // the new fetch resolves -- a session change should never risk flashing the prior user's
      // favorites, even for a moment.
      //
      // Eighth Codex cross-model review pass (Task 27): this effect re-runs and re-blanks `lists`
      // on ANY `session?.access_token` change, including a same-user token refresh. If that
      // refresh's own refetch happens to be IN FLIGHT when a create-list request (started before
      // the refresh) succeeds, the create's append is visible only until this effect's own,
      // pre-creation GET snapshot resolves and replaces `lists` wholesale -- there is no guarantee
      // a LATER refetch corrects this; without one (no further token change, no manual reload), the
      // created list stays missing from view until the curator navigates away and back. The list
      // still exists server-side throughout. This is a pre-existing trait of "always re-blank-and-
      // refetch on any token change" (present before Task 27's `latestCreateRequest`/
      // `latestListsRequest` split too -- the original single counter just discarded the create's
      // own response outright in this window instead), not a regression the split introduced.
      setLists(null);
      getFavoriteLists(session.access_token)
        .then((data) => {
          if (requestId === latestListsRequest.current) setLists(data);
        })
        .catch(() => {
          if (requestId === latestListsRequest.current) router.push("/giris");
        });
    }
    // Depend on `user?.id` / `session?.access_token` (stable primitives), not the `user`/`session`
    // objects themselves -- some auth-context consumers hand back a fresh object reference on
    // every render even when the underlying session hasn't changed, which would otherwise re-run
    // this effect (and reset `lists`) spuriously on every render.
  }, [user?.id, session?.access_token, loading, router]);

  if (!loading && !user) return null;

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Yükleniyor…
      </p>
    );
  }

  return (
    <main data-testid="favoriler-page" className="relative overflow-hidden pt-8 sm:pt-12 lg:pt-16">
      <div className="pointer-events-none absolute -right-32 top-10 -z-10 size-80 rounded-full bg-terracottaLight/10 blur-3xl" aria-hidden="true" />

      <header className="border-b border-ink/12 pb-6 sm:pb-8">
        <div className="flex items-center gap-2 text-[0.64rem] font-black uppercase tracking-[0.2em] text-terracottaDeep">
          <span className="h-px w-6 bg-current" aria-hidden="true" />
          Kişisel seçkin
        </div>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-serif text-[2.7rem] font-semibold leading-[0.95] tracking-[-0.055em] text-ink sm:text-6xl">
              Favorilerin
            </h1>
            <p className="mt-3 max-w-[44ch] text-sm font-medium leading-relaxed text-ink/55">
              Yeniden dönmek istediğin lezzet duraklarını burada bir arada tut.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lists && lists.length > 0 && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-ink/12 bg-creamLight px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-ink/55">
                <span className="size-1.5 rounded-full bg-terracotta" aria-hidden="true" />
                {lists.length} liste
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="text-xs font-semibold text-ink/55 underline-offset-2 hover:text-ink hover:underline"
            >
              Çıkış yap
            </button>
          </div>
        </div>
        {signOutError && (
          <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">
            {signOutError}
          </p>
        )}
      </header>

      {lists !== null && (
        <form onSubmit={handleCreateList} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-ink/70">
            Liste adı
            <input
              type="text"
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              placeholder="Örn. Kadıköy Kahveleri"
              className="mt-1.5 block w-full rounded-full border border-ink/15 bg-creamLight px-4 py-2.5 text-sm font-medium text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !newListName.trim()}
            className="min-h-11 rounded-full bg-terracotta px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(158,66,43,0.28)] transition-all hover:-translate-y-0.5 hover:bg-terracottaDark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Oluştur
          </button>
        </form>
      )}

      {lists === null ? (
        <section className="grid gap-3 py-6 sm:grid-cols-2 sm:gap-4 sm:py-8" aria-label="Favoriler yükleniyor" aria-busy="true">
          {[0, 1].map((item) => (
            <div key={item} className="min-h-44 animate-pulse rounded-[1.4rem] border border-ink/[0.08] bg-creamLight/70 p-5 sm:p-6">
              <div className="size-10 rounded-full bg-ink/[0.07]" />
              <div className="mt-7 h-6 w-2/3 rounded-full bg-ink/[0.07]" />
              <div className="mt-3 h-3 w-1/2 rounded-full bg-ink/[0.05]" />
            </div>
          ))}
        </section>
      ) : lists.length === 0 ? (
        <section className="py-6 sm:py-8" aria-labelledby="empty-favorites-title">
          <div className="relative overflow-hidden rounded-[1.6rem] bg-ink px-5 py-8 text-cream shadow-[0_18px_45px_rgba(32,29,24,0.13)] sm:px-8 sm:py-10">
            <svg viewBox="0 0 160 160" className="absolute -right-8 -top-10 size-48 text-terracottaLight/15 sm:size-56" aria-hidden="true">
              <circle cx="80" cy="80" r="59" fill="none" stroke="currentColor" strokeWidth="14" />
              <path d="M80 117 45 84C22 62 55 32 80 59c25-27 58 3 35 25l-35 33Z" fill="currentColor" />
            </svg>

            <div className="relative max-w-xl">
              <span className="grid size-12 place-items-center rounded-full bg-terracotta text-white shadow-[0_8px_24px_rgba(215,93,59,0.28)]" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-5 fill-none">
                  <path d="M12 20.3 4.6 13.4C-.2 8.9 6.8 2.7 12 8.1c5.2-5.4 12.2.8 7.4 5.3L12 20.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-6 text-[0.62rem] font-black uppercase tracking-[0.19em] text-terracottaLight">İlk favorini bekliyor</p>
              <h2 id="empty-favorites-title" className="mt-2 max-w-[15ch] font-serif text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.5rem]">
                Henüz favori yok, keşfe başla.
              </h2>
              <p className="mt-3 max-w-[42ch] text-sm font-medium leading-relaxed text-cream/60">
                Hoşuna giden bir mekanda kalbe dokun; sonraki rotanı hazırlarken burada seni beklesin.
              </p>
              <Link
                href="/"
                className="group mt-6 inline-flex min-h-12 w-full items-center justify-between gap-4 rounded-full bg-terracotta px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(158,66,43,0.28)] transition-all hover:-translate-y-0.5 hover:bg-terracottaDark focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:w-auto"
              >
                Mekanları keşfet
                <svg viewBox="0 0 20 20" className="size-4 fill-none transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                  <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 py-6 sm:grid-cols-2 sm:gap-4 sm:py-8" aria-label="Favori listelerin">
          {lists.map((list, index) => (
            <article
              key={list.id}
              className="group relative min-h-44 overflow-hidden rounded-[1.4rem] border border-ink/12 bg-creamLight p-5 shadow-[0_1px_0_rgba(32,29,24,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_14px_36px_rgba(71,52,35,0.10)] sm:p-6"
            >
              <span className="absolute inset-y-0 left-0 w-1 origin-bottom scale-y-0 bg-terracotta transition-transform duration-300 group-hover:scale-y-100" aria-hidden="true" />
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-10 place-items-center rounded-full bg-terracotta/10 text-terracottaDeep" aria-hidden="true">
                    <svg viewBox="0 0 20 20" className="size-4">
                      <path d="M10 17.2 3.8 11.4C-.2 7.7 5.6 2.5 10 7c4.4-4.5 10.2.7 6.2 4.4L10 17.2Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="font-serif text-sm font-semibold tabular-nums text-ink/35">0{index + 1}</span>
                </div>
                <h2 className="mt-5 font-serif text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-ink transition-colors group-hover:text-terracottaDeep">
                  {list.name}
                </h2>
                {list.favorites.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {list.favorites.map((favorite) => (
                      <li key={favorite.id}>
                        <Link
                          href={`/mekan/${favorite.venue.slug}`}
                          className="text-sm font-semibold text-ink/70 underline decoration-terracotta/40 underline-offset-2 hover:text-terracottaDeep"
                        >
                          {favorite.venue.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-auto pt-5 text-[0.65rem] font-black uppercase tracking-[0.15em] text-ink/38">
                    Kişisel mekan listen
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
