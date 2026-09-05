"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiHttpError } from "@gurmego/api-client";
import { useAuth } from "@/lib/auth-context";
import { importCsv } from "@/lib/api";
import type { CsvImportResult } from "@gurmego/shared";

export default function ImportPage() {
  const { session, user, signOut } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TASK 27 fix (Codex cross-model review of Task 26, MAJOR): tracks the current session's token
  // so a stale upload's delayed 401 can be told apart from one belonging to the still-current
  // session. Updated on every render (not in a `useEffect`) so it's already correct by the time an
  // in-flight request's `.catch()` reads it, however soon after a session change that happens.
  const currentTokenRef = useRef(session?.access_token);
  currentTokenRef.current = session?.access_token;

  // Fourth Codex cross-model review pass (Task 27, MAJOR): identity change only ever updated
  // `currentTokenRef` -- `result`, `error`, and the selected `file` were never cleared, so a new
  // curator signing in (same component instance, no remount) could still see the PREVIOUS
  // curator's upload summary/error, or accidentally submit the previous curator's selected file
  // under their own token. Same render-time identity-gated reset pattern as
  // apps/web/src/app/favoriler/page.tsx's `listsIdentityRef`: adjusting state DURING render (not
  // in a `useEffect`, which only runs after commit/paint) means no committed frame ever shows the
  // previous curator's data under the new session.
  const identity = user?.id ?? null;
  const identityRef = useRef<string | null>(identity);
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    if (file !== null) setFile(null);
    if (result !== null) setResult(null);
    if (error !== null) setError(null);
  }

  async function handleUpload() {
    if (!session?.access_token || !file) return;
    const requestToken = session.access_token;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importCsv(requestToken, file);
      // Second Codex cross-model review pass (Task 27, MAJOR): the first pass only guarded the
      // error/401 path below -- a stale upload that resolves SUCCESSFULLY after the session
      // changed would still have written the OLD session's result onto the NEW curator's screen.
      if (requestToken !== currentTokenRef.current) return;
      setResult(res);
    } catch (err) {
      if (requestToken !== currentTokenRef.current) {
        // The session/token changed while this upload was in flight -- a 401 (or any other error)
        // now belongs to a session that is no longer current. Signing out or showing an error here
        // would incorrectly act on the NEW session because of a request that was never its own.
        return;
      }
      if (err instanceof ApiHttpError && err.status === 401) {
        // Session expired server-side — sign out to clear the stale client session and send the
        // curator back to login instead of showing a generic, unactionable upload-failure message.
        // MAJOR fix (final whole-branch review): this used to fire-and-forget `signOut()` (not
        // awaited, not checked) before redirecting. Same established pattern as
        // (protected)/layout.tsx, erisim-yok/page.tsx, and kuyruk/page.tsx's handleSignOutFor401:
        // Supabase's `signOut()` resolves with `{ error }` rather than rejecting on failure, so an
        // unchecked call silently proceeds to redirect as if sign-out succeeded even when the
        // session was never actually cleared server-side (and an outright rejection would become
        // an unhandled promise rejection). Await it and check the result before redirecting.
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
        return;
      }
      setError(
        err instanceof ApiHttpError && err.status === 403
          ? "Bu işlemi yapmaya yetkiniz yok."
          : "Yükleme başarısız oldu. Dosyayı kontrol edip tekrar dene.",
      );
    } finally {
      // Second Codex cross-model review pass (Task 27, MAJOR): unlike the result/error paths
      // above, this page has no other mechanism that resets `uploading` for a new session --
      // guarding this too (the first pass's fix) left the button permanently disabled for the new
      // curator. Deliberately unconditional: the upload button is disabled while `uploading`, so
      // there is never a second, genuinely-concurrent upload for a stale `finally` to clobber.
      setUploading(false);
    }
  }

  return (
    <main
      data-testid="import-page"
      className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mx-auto w-full max-w-[90rem]">
        <header className="mb-5 border-b border-slate-300 pb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
            GurmeGo / Operasyon
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            CSV Toplu Import
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600">
            Mekan verilerini CSV dosyasından toplu olarak içe aktarın ve satır bazlı sonuçları
            inceleyin.
          </p>
        </header>

        <section aria-labelledby="upload-heading" className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.53 8.72a.75.75 0 0 0-1.06 1.06l4 4a.75.75 0 0 0 1.06 0l4-4a.75.75 0 1 0-1.06-1.06l-2.72 2.72V2.75ZM3.5 12a.75.75 0 0 0-1.5 0v2.75A3.25 3.25 0 0 0 5.25 18h9.5A3.25 3.25 0 0 0 18 14.75V12a.75.75 0 0 0-1.5 0v2.75a1.75 1.75 0 0 1-1.75 1.75h-9.5a1.75 1.75 0 0 1-1.75-1.75V12Z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 id="upload-heading" className="text-sm font-bold text-slate-950">Dosya yükleme</h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Yalnızca .csv uzantılı dosyalar kabul edilir.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <label
                htmlFor="csv-file"
                className="mb-2 block text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-600"
              >
                CSV dosyası
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-md border border-slate-300 bg-slate-50 text-sm text-slate-600 shadow-sm file:mr-4 file:border-0 file:border-r file:border-slate-300 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
              />
              {file && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-700">
                    <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V7.414a2.25 2.25 0 0 0-.659-1.591l-3.164-3.164A2.25 2.25 0 0 0 12.586 2H4.25Zm8 1.5v3.25c0 .552.448 1 1 1h3.25v8a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75V4.25a.75.75 0 0 1 .75-.75h8Z" clipRule="evenodd" />
                  </svg>
                  {file.name}
                </p>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none lg:w-auto lg:min-w-36"
            >
              {uploading ? (
                <>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10.75 17.25a.75.75 0 0 1-1.5 0V8.56l-2.72 2.72a.75.75 0 0 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 1 1-1.06 1.06l-2.72-2.72v8.69ZM3.5 8a.75.75 0 0 1-1.5 0V5.25A3.25 3.25 0 0 1 5.25 2h9.5A3.25 3.25 0 0 1 18 5.25V8a.75.75 0 0 1-1.5 0V5.25a1.75 1.75 0 0 0-1.75-1.75h-9.5A1.75 1.75 0 0 0 3.5 5.25V8Z" clipRule="evenodd" />
                  </svg>
                  Yükle
                </>
              )}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-rose-900 shadow-sm"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.596c.75 1.334-.213 2.982-1.742 2.982H3.48c-1.53 0-2.493-1.648-1.743-2.982L8.257 3.1ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-bold">İçe aktarma tamamlanamadı</p>
              <p className="mt-0.5 text-sm leading-5 text-rose-800">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div data-testid="import-result" className="mt-5 space-y-4">
            <section
              aria-labelledby="result-heading"
              className="border border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50 px-4 py-4 shadow-sm sm:px-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.05l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.815a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h2 id="result-heading" className="text-sm font-bold text-emerald-950">İçe aktarma tamamlandı</h2>
                    <p className="mt-0.5 text-sm text-emerald-900">
                      {result.created} mekan oluşturuldu, {result.skipped} atlandı (zaten var)
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-emerald-200 border border-emerald-200 bg-white/70">
                  <div className="min-w-24 px-4 py-2 text-center">
                    <p className="text-xl font-bold tabular-nums text-emerald-800">{result.created}</p>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-emerald-700">Oluşturuldu</p>
                  </div>
                  <div className="min-w-24 px-4 py-2 text-center">
                    <p className="text-xl font-bold tabular-nums text-slate-700">{result.skipped}</p>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">Atlandı</p>
                  </div>
                </div>
              </div>
            </section>

            {result.errors.length > 0 && (
              <section aria-labelledby="row-errors-heading" className="border border-rose-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-rose-200 bg-rose-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-rose-700">İşlem gerekli</p>
                    <h2 id="row-errors-heading" className="text-base font-bold text-slate-950">Satır bazlı import hataları</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Aşağıdaki CSV satırlarını düzeltip dosyayı yeniden yükleyin.
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-sm bg-rose-100 px-2 py-1 text-xs font-bold tabular-nums text-rose-800">
                    {result.errors.length} hata
                  </span>
                </div>
                <div className="hidden grid-cols-[7rem_minmax(0,1fr)] border-b border-slate-200 bg-slate-50 px-5 py-2 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:grid">
                  <span>CSV satırı</span>
                  <span>Hata nedeni</span>
                </div>
                <ul className="divide-y divide-slate-200">
                  {result.errors.map((err) => (
                    <li
                      key={err.row}
                      className="grid gap-2 border-l-4 border-l-rose-500 px-4 py-3.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:px-5"
                    >
                      <span className="inline-flex w-fit items-center rounded-sm bg-rose-100 px-2 py-1 text-xs font-bold tabular-nums text-rose-800">
                        Satır {err.row}
                      </span>
                      <span className="text-sm font-medium leading-5 text-slate-800">{err.message}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
