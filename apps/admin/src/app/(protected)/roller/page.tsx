"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiHttpError } from "@gurmego/api-client";
import { useAuth } from "@/lib/auth-context";
import { searchUsers, assignRole } from "@/lib/api";
import type { AdminUserSearchResult } from "@gurmego/shared";

export default function RollerPage() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<AdminUserSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // Guards against an out-of-order response: firing a second search before the first resolves
  // (e.g. user edits the term and re-submits quickly) must not let the FIRST response's later
  // arrival overwrite the SECOND, more recent one -- same pattern as (protected)/kuyruk/page.tsx's
  // `latestQueueRequest`.
  const latestSearchRequest = useRef(0);

  const token = session?.access_token;
  const canSearch = term.trim().length >= 2;

  async function handleUnauthorized(setError: (message: string) => void) {
    try {
      const result = await signOut();
      if (result?.error) setError("Çıkış yapılamadı. Tekrar deneyin.");
      else router.push("/giris");
    } catch {
      setError("Çıkış yapılamadı. Tekrar deneyin.");
    }
  }

  async function runSearch() {
    if (!token || !canSearch) return;
    setAssignError(null);
    const requestId = ++latestSearchRequest.current;
    try {
      const data = await searchUsers(token, term.trim());
      if (requestId !== latestSearchRequest.current) return; // a newer search has since started
      setResults(data);
      setSearchError(null);
    } catch (err) {
      if (requestId !== latestSearchRequest.current) return;
      if (err instanceof ApiHttpError && err.status === 401) {
        await handleUnauthorized(setSearchError);
        return;
      }
      setSearchError(
        err instanceof ApiHttpError && err.status === 403
          ? "Bu aramayı yapmaya yetkiniz yok."
          : "Arama başarısız oldu. Tekrar deneyin.",
      );
    }
  }

  async function handleAssign(userId: string) {
    if (!token) return;
    setAssigningId(userId);
    setAssignError(null);
    try {
      await assignRole(token, userId, "curator");
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 401) {
        await handleUnauthorized(setAssignError);
      } else {
        setAssignError(
          err instanceof ApiHttpError && err.status === 403
            ? "Bu işlemi yapmaya yetkiniz yok."
            : "İşlem gerçekleştirilemedi. Tekrar deneyin.",
        );
      }
      setAssigningId(null);
      return;
    }
    // The role change itself succeeded at this point -- a failure below is only the list
    // refresh, and must never be reported as "the assign failed" (that would be false: the
    // backend already committed the new role).
    try {
      const data = await searchUsers(token, term.trim());
      setResults(data);
    } catch {
      setAssignError("Rol atandı ama liste güncellenemedi. Sayfayı yenileyin.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <main
      data-testid="roller-page"
      className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mx-auto w-full max-w-[60rem]">
        <header className="mb-5 border-b border-slate-300 pb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
            GurmeGo / Operasyon
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Roller</h1>
        </header>

        <form
          className="mb-5 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="search" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              E-posta ara
            </label>
            <input
              id="search"
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!canSearch}
            className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Ara
          </button>
        </form>

        {searchError && (
          <div role="alert" className="mb-4 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-sm text-rose-900">
            {searchError}
          </div>
        )}
        {assignError && (
          <div role="alert" className="mb-4 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-sm text-rose-900">
            {assignError}
          </div>
        )}

        {!searchError &&
          results !== null &&
          (results.length === 0 ? (
            <p className="text-sm font-semibold text-slate-800">Eşleşen kullanıcı bulunamadı.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((user) => (
                <li key={user.id} className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{user.email}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{user.role}</p>
                  </div>
                  <button
                    type="button"
                    disabled={assigningId === user.id}
                    onClick={() => void handleAssign(user.id)}
                    className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Küratör yap
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </main>
  );
}
