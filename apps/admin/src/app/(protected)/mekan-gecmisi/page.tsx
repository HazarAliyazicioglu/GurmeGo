"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiHttpError } from "@gurmego/api-client";
import { useAuth } from "@/lib/auth-context";
import { searchVenues, listVenueVersions, revertVenue } from "@/lib/api";
import type { AdminVenueSearchResult, AdminVenueVersionList } from "@gurmego/shared";

export default function MekanGecmisiPage() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [venues, setVenues] = useState<AdminVenueSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminVenueSearchResult[number] | null>(null);
  const [versions, setVersions] = useState<AdminVenueVersionList | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const latestSearchRequest = useRef(0);
  // Always holds the currently-selected venue's id (or null) -- read inside async callbacks to
  // detect that the selection changed (or was cleared by a new search) while a request was in
  // flight, so a slow response for a venue that's no longer selected never overwrites what the
  // curator is now looking at.
  const selectedIdRef = useRef<string | null>(null);

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
    const requestId = ++latestSearchRequest.current;
    // A new search invalidates whatever was selected from the previous result set -- otherwise
    // the old venue's "geri al" buttons stay visible even though the visible list no longer
    // includes it.
    selectedIdRef.current = null;
    setSelected(null);
    setVersions(null);
    setVersionsError(null);
    setRevertError(null);
    try {
      const data = await searchVenues(token, term.trim());
      if (requestId !== latestSearchRequest.current) return;
      setVenues(data);
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

  async function selectVenue(venue: AdminVenueSearchResult[number]) {
    if (!token) return;
    selectedIdRef.current = venue.id;
    setSelected(venue);
    setVersions(null);
    setVersionsError(null);
    setRevertError(null);
    try {
      const data = await listVenueVersions(token, venue.id);
      if (selectedIdRef.current !== venue.id) return; // a different venue is selected now
      setVersions(data);
    } catch (err) {
      if (selectedIdRef.current !== venue.id) return;
      if (err instanceof ApiHttpError && err.status === 401) {
        await handleUnauthorized(setVersionsError);
        return;
      }
      setVersionsError("Sürüm geçmişi yüklenemedi. Tekrar deneyin.");
    }
  }

  async function handleRevert(versionId: string) {
    if (!token || !selected) return;
    if (!window.confirm("Bu sürüme geri almak istediğinize emin misiniz?")) return;
    setRevertingId(versionId);
    setRevertError(null);
    try {
      await revertVenue(token, selected.id, versionId);
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 401) {
        await handleUnauthorized(setRevertError);
      } else {
        setRevertError(
          err instanceof ApiHttpError && err.status === 403
            ? "Bu işlemi yapmaya yetkiniz yok."
            : "Geri alma işlemi başarısız oldu. Tekrar deneyin.",
        );
      }
      setRevertingId(null);
      return;
    }
    const revertedVenueId = selected.id;
    try {
      const data = await listVenueVersions(token, revertedVenueId);
      if (selectedIdRef.current === revertedVenueId) setVersions(data);
    } catch {
      if (selectedIdRef.current === revertedVenueId) setRevertError("Geri alındı ama liste güncellenemedi. Sayfayı yenileyin.");
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <main
      data-testid="mekan-gecmisi-page"
      className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-8"
    >
      <div className="mx-auto w-full max-w-[70rem]">
        <header className="mb-5 border-b border-slate-300 pb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-sm bg-blue-700" aria-hidden="true" />
            GurmeGo / Operasyon
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Mekan Geçmişi</h1>
        </header>

        <form
          className="mb-5 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="venue-search" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Mekan ara (isim veya slug)
            </label>
            <input
              id="venue-search"
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

        <div className="grid gap-6 sm:grid-cols-2">
          {venues !== null && (
            <section aria-label="Mekan sonuçları">
              {venues.length === 0 ? (
                <p className="text-sm font-semibold text-slate-800">Eşleşen mekan bulunamadı.</p>
              ) : (
                <ul className="space-y-2">
                  {venues.map((venue) => (
                    <li key={venue.id}>
                      <button
                        type="button"
                        onClick={() => void selectVenue(venue)}
                        className={`w-full border px-4 py-3 text-left text-sm ${selected?.id === venue.id ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                      >
                        {venue.name}
                        <span className="ml-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{venue.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {selected && (
            <section aria-label="Sürüm geçmişi">
              {versionsError && (
                <div role="alert" className="mb-4 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-sm text-rose-900">
                  {versionsError}
                </div>
              )}
              {revertError && (
                <div role="alert" className="mb-4 border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 px-4 py-3.5 text-sm text-rose-900">
                  {revertError}
                </div>
              )}
              {versions !== null &&
                (versions.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-800">Sürüm geçmişi yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {versions.map((version) => (
                      <li key={version.id} className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold">{new Date(version.createdAt).toLocaleString("tr-TR")}</p>
                          <p className="text-xs text-slate-500">{version.createdBy ?? "sistem"}</p>
                        </div>
                        <button
                          type="button"
                          disabled={revertingId === version.id}
                          onClick={() => void handleRevert(version.id)}
                          className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                        >
                          Bu sürüme geri al
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
