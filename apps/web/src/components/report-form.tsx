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
      <section className="rounded-[1.5rem] border border-[#201d18]/12 bg-[#faf7f0] p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-bold text-[#201d18]/75">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#d75d3b]/12 text-[#9e422b]" aria-hidden="true">✓</span>
          Teşekkürler, bildirimin kürasyon ekibine iletildi.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-[#201d18]/12 bg-[#faf7f0] p-5 sm:p-6">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#201d18]/42">Bilgi yanlış mı?</p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="reason" className="text-sm font-semibold text-[#201d18]/60">
            Neden yanlış?
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            required
            rows={3}
            className="mt-2 w-full rounded-2xl border border-[#201d18]/15 bg-white px-3.5 py-2.5 text-sm font-medium text-[#201d18] placeholder:text-[#201d18]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d75d3b]"
            placeholder="Örn. fiyat aralığı güncel değil"
          />
        </div>
        {error && <p className="text-xs font-semibold text-[#9e422b]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#d75d3b] px-5 text-sm font-black text-white transition-colors hover:bg-[#bd4c30] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201d18] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f0]"
        >
          {submitting ? "Gönderiliyor…" : "Gönder"}
        </button>
      </form>
    </section>
  );
}
