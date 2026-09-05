"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiHttpError } from "@gurmego/api-client";
import { useAuth } from "@/lib/auth-context";
import { getQueue, approveQueueItem, rejectQueueItem } from "@/lib/api";
import { QueueItem } from "@/components/queue-item";
import type { AdminQueueItem } from "@gurmego/shared";

export default function KuyrukPage() {
  const { session, user, signOut } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AdminQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Two DISTINCT error states, deliberately not merged into one:
  // - loadError: the initial getQueue() failed. There is no data to show, so it is correct to hide
  //   the entire list/empty-state block while this is set.
  // - mutationError: an approve/reject on an already-loaded list failed. The list and its action
  //   buttons must stay visible and interactive so the curator can see what they were acting on and
  //   retry — this is exactly the regression a previous fix round introduced by gating the whole
  //   content block on a single shared `error` state that both paths wrote to.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  // The set of row ids currently being approved/rejected — a row's buttons are disabled while its own
  // id is in this set, so a double-click (or clicking both approve and reject) can't fire two
  // concurrent mutations against the same queue item. This MUST be a set, not a single shared id:
  // with a single id, starting row B's mutation while row A's is still in flight overwrote the
  // shared value and re-enabled row A's buttons mid-flight, allowing a double-fire on row A.
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());
  // Request-generation guard against the concurrent-refetch race: an approve/reject on one row
  // triggers its own refetch(), and a curator double-clicking approve on two different rows fires
  // two overlapping refetches. Network/scheduling order is not guaranteed to match call order, so
  // the FIRST-fired refetch's response can resolve AFTER the second's and overwrite the list with
  // stale data (e.g. showing an item as still "pending" after it was actually approved). Bumping
  // this counter on every refetch() call and only applying a response whose captured id still
  // matches the counter discards any response that is no longer the latest in flight. Same pattern
  // as apps/web/src/app/favoriler/page.tsx's `latestListsRequest` and
  // apps/web/src/components/discovery-client.tsx's `latestRequest`.
  const latestQueueRequest = useRef(0);

  const token = session?.access_token;
  // TASK 27 fix (Codex cross-model review of Task 26, MAJOR): unlike refetch()'s 401 path (already
  // guarded by `latestQueueRequest`), the mutation 401 path (handleApprove/handleReject ->
  // handleMutationError) had no staleness check at all -- a stale approve/reject call's delayed
  // 401 would sign out whichever curator's session happened to be current by the time it arrived,
  // even if that belonged to a DIFFERENT curator than the one who started the request.
  //
  // Sixth Codex cross-model review pass: comparing raw TOKEN (as this originally did) rather than
  // IDENTITY has its own problem -- a plain token REFRESH for the SAME curator also changes
  // `token`, so a same-curator mutation's own follow-up `refetch()` would be wrongly treated as
  // cross-session and skipped, leaving the just-approved/rejected row stale on screen indefinitely
  // (no permanent lock, just wrong data -- but still wrong). `identity` (the curator's user id) is
  // the real cross-session signal; a token refresh alone must not trip these guards.
  const identity = user?.id ?? null;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  // Shared 401 sign-out handler, used by both the refetch() 401 path and the mutation 401 path.
  // Established pattern (matches (protected)/layout.tsx and erisim-yok/page.tsx): Supabase's
  // `signOut()` resolves with `{ error }` rather than rejecting on failure, so it must be AWAITED
  // and its result CHECKED before redirecting — an unchecked, un-awaited `void signOut()` would
  // silently redirect to /giris as if sign-out succeeded even when the session was never actually
  // cleared server-side (and could leave an unhandled promise rejection if signOut() rejects
  // outright). On success, redirect; on failure, surface an error via the caller's own error slot
  // instead of redirecting anyway, so the curator isn't left believing they signed out cleanly.
  const handleSignOutFor401 = useCallback(
    async (setError: (message: string) => void) => {
      try {
        const result = await signOut();
        if (result?.error) {
          setError("Çıkış yapılamadı. Tekrar deneyin.");
          return;
        }
        router.push("/giris");
      } catch {
        setError("Çıkış yapılamadı. Tekrar deneyin.");
      }
    },
    [signOut, router],
  );

  const refetch = useCallback(async () => {
    if (!token) return;
    // Third Codex cross-model review pass (Task 27, MAJOR): checking identity only AFTER
    // `getQueue` resolved/rejected was not enough. Bumping the SHARED `latestQueueRequest` counter
    // BEFORE that check meant a stale call (e.g. one triggered by handleApprove/handleReject
    // succeeding after the session already changed) could still "poison" the counter -- making a
    // genuinely current refetch that started earlier (and is still pending) look stale by count
    // alone once IT resolves, discarding its legitimate response. Checking identity FIRST, before
    // touching the counter or calling `getQueue` at all, means a stale-identity call has zero side
    // effects: it never increments the counter and never makes the request.
    //
    // Sixth Codex cross-model review pass (Task 27, MAJOR): this compared TOKEN, not identity --
    // a plain token refresh for the SAME curator also changes `token`, so a same-curator mutation's
    // own follow-up refetch() was wrongly treated as cross-session and skipped, leaving the
    // just-approved/rejected row stale on screen. `identity` doesn't change on a token refresh.
    if (identity !== identityRef.current) return;
    const requestId = ++latestQueueRequest.current;
    try {
      const data = await getQueue(token, { status: "PENDING" });
      if (requestId !== latestQueueRequest.current) return; // a newer refetch has since started — discard this stale response
      setItems(data);
      setLoadError(null);
    } catch (err) {
      if (requestId !== latestQueueRequest.current) return; // stale error, a newer refetch is already in flight/resolved
      if (err instanceof ApiHttpError && err.status === 401) {
        // Session expired server-side. Sign out to clear the stale client session too, then send
        // the curator back to login rather than showing a generic, unactionable error.
        // MAJOR fix (final whole-branch review): this used to fire-and-forget `signOut()` (not
        // awaited, not checked) before redirecting. Same established pattern as
        // (protected)/layout.tsx and erisim-yok/page.tsx: Supabase's `signOut()` resolves with
        // `{ error }` rather than rejecting on failure, so an unchecked call silently proceeds to
        // redirect as if sign-out succeeded even when the session was never actually cleared
        // server-side. Await it and check the result before deciding whether to redirect.
        await handleSignOutFor401(setLoadError);
        return;
      }
      // Same pattern as apps/admin/src/app/(protected)/import/page.tsx: without this, a rejected
      // getQueue() (network error, malformed response) would leave `loading` true forever — a
      // permanently blank page with no feedback.
      setLoadError(
        err instanceof ApiHttpError && err.status === 403
          ? "Bu kuyruğu görüntüleme yetkiniz yok."
          : "Kuyruk yüklenemedi. Sayfayı yenileyip tekrar deneyin.",
      );
    } finally {
      if (requestId === latestQueueRequest.current) setLoading(false);
    }
  }, [token, identity, signOut, router, handleSignOutFor401]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function addMutatingId(id: string) {
    setMutatingIds((prev) => new Set(prev).add(id));
  }

  function removeMutatingId(id: string) {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleMutationError(err: unknown, requestIdentity: string | null) {
    if (requestIdentity !== identityRef.current) {
      // TASK 27 fix (Codex cross-model review of Task 26, MAJOR): the session changed while this
      // mutation was in flight -- this error (401 included) now belongs to a session that is no
      // longer current. Signing out or showing an error here would incorrectly act on the NEW
      // session because of a request that was never its own.
      //
      // Sixth Codex cross-model review pass: compares `identity`, not the raw token -- a same-
      // curator token refresh must not trip this guard (see `identity`'s own comment above).
      return;
    }
    if (err instanceof ApiHttpError && err.status === 401) {
      // MAJOR fix (final whole-branch review): same unawaited/unchecked `signOut()` bug as
      // refetch()'s 401 path above — see handleSignOutFor401's comment for the established
      // await + `{ error }`-check pattern this now follows.
      await handleSignOutFor401(setMutationError);
      return;
    }
    setMutationError(
      err instanceof ApiHttpError && err.status === 403
        ? "Bu işlemi yapmaya yetkiniz yok."
        : "İşlem gerçekleştirilemedi. Tekrar deneyin.",
    );
  }

  async function handleApprove(id: string) {
    if (!token) return;
    const requestToken = token;
    const requestIdentity = identity;
    addMutatingId(id);
    setMutationError(null);
    try {
      await approveQueueItem(requestToken, id);
      await refetch();
    } catch (err) {
      await handleMutationError(err, requestIdentity);
    } finally {
      removeMutatingId(id);
    }
  }

  async function handleReject(id: string) {
    if (!token) return;
    const requestToken = token;
    const requestIdentity = identity;
    addMutatingId(id);
    setMutationError(null);
    try {
      await rejectQueueItem(requestToken, id);
      await refetch();
    } catch (err) {
      await handleMutationError(err, requestIdentity);
    } finally {
      removeMutatingId(id);
    }
  }

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Yükleniyor…
      </p>
    );
  }

  return (
    <main
      data-testid="kuyruk-page"
      className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mx-auto w-full max-w-[90rem]">
        <header className="mb-5 border-b border-slate-300 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
                GurmeGo / Operasyon
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Kürasyon Kuyruğu
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600">
                Bekleyen mekan bildirimlerini inceleyin ve sonuçlandırın.
              </p>
            </div>
            {/* Gated on !loadError: `items.length` is still 0 while a load failure is showing (there's
                no data at all, not a known-empty queue), so rendering "Bekleyen 0 bildirim" here would
                falsely claim the queue is empty at the same time the error banner below says the load
                failed. */}
            {!loadError && (
              <div className="flex w-fit items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm">
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  {items.length > 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-30" />
                  )}
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      items.length > 0 ? "bg-blue-600" : "bg-slate-400"
                    }`}
                  />
                </span>
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Bekleyen
                  </p>
                  <p className="text-sm font-bold tabular-nums text-slate-900">{items.length} bildirim</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {loadError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-rose-900 shadow-sm"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.596c.75 1.334-.213 2.982-1.742 2.982H3.48c-1.53 0-2.493-1.648-1.743-2.982L8.257 3.1ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm leading-5">{loadError}</p>
          </div>
        )}

        {/* A mutation (approve/reject) failure gets its OWN banner, deliberately separate from
            loadError above: unlike a load failure, there IS data to show (the list already loaded
            successfully), so this must NOT hide the list/action buttons below — the curator needs to
            still see and retry the item they were acting on. This is the round-3 regression fix: round
            2 collapsed both cases into one `error` state and gated the whole content block on it. */}
        {mutationError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-rose-900 shadow-sm"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.596c.75 1.334-.213 2.982-1.742 2.982H3.48c-1.53 0-2.493-1.648-1.743-2.982L8.257 3.1ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm leading-5">{mutationError}</p>
          </div>
        )}

        {/* Only show list/empty-state content when the load genuinely succeeded — rendering the
            "nothing pending, all caught up" empty state alongside the load-error banner above ("Kuyruk
            yüklenemedi") would be a contradictory message to a curator, and rendering the list
            section when the load failed has nothing to show anyway. Gated on loadError ONLY —
            mutationError must never hide this block (see comment above). */}
        {!loadError &&
          (items.length === 0 ? (
            <section className="border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.05l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.815a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              </div>
              <p data-testid="empty-state" className="text-sm font-semibold text-slate-800">
                Bekleyen bildirim yok.
              </p>
              <p className="mt-1 text-xs text-slate-500">Kürasyon kuyruğu güncel.</p>
            </section>
          ) : (
            <section aria-label="Bekleyen bildirimler">
              <div className="mb-2 hidden grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.45fr)_minmax(24rem,1fr)] gap-6 px-5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
                <span>Mekan</span>
                <span className="pl-6">Bildirim</span>
                <span className="text-right">İşlem</span>
              </div>
              <ul className="space-y-2">
                {items.map((item) => (
                  <QueueItem
                    key={item.id}
                    item={item}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    pending={mutatingIds.has(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </main>
  );
}
