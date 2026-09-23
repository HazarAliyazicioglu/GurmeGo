"use client";
import { useState } from "react";
import { reportVenue } from "@/lib/api";

export function ReportForm({ venueId }: { venueId: string }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await reportVenue(venueId, reason);
      setSubmitted(true);
    } catch {
      setError("Bildirim gönderilemedi, lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="rounded-[1.5rem] border border-ink/12 bg-creamLight p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-bold text-ink/75">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-terracotta/12 text-terracottaDeep" aria-hidden="true">✓</span>
          Teşekkürler, bildirimin kürasyon ekibine iletildi.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-ink/12 bg-creamLight p-5 sm:p-6">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-ink/42">Bilgi yanlış mı?</p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="reason" className="text-sm font-semibold text-ink/60">
            Neden yanlış?
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            required
            rows={3}
            className="mt-2 w-full rounded-2xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-ink/35 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta"
            placeholder="Örn. fiyat aralığı güncel değil"
          />
        </div>
        {error && <p className="text-xs font-semibold text-terracottaDeep">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-terracotta px-5 text-sm font-black text-white transition-colors hover:bg-terracottaDark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-creamLight"
        >
          {submitting ? "Gönderiliyor…" : "Gönder"}
        </button>
      </form>
    </section>
  );
}
