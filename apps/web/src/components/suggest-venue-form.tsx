"use client";
import { useState } from "react";
import { suggestVenue } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import type { District } from "@gurmego/shared";

const INPUT_CLASS =
  "mt-2 w-full rounded-2xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-ink/35 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta";

export function SuggestVenueForm({ districts }: { districts: District[] }) {
  const [name, setName] = useState("");
  const [districtSlug, setDistrictSlug] = useState(districts[0]?.slug ?? "");
  const [category, setCategory] = useState(Object.keys(CATEGORY_LABELS)[0] ?? "");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await suggestVenue({
        name,
        districtSlug,
        category,
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSubmitted(true);
    } catch {
      setError("Öneri gönderilemedi, lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="flex items-center gap-2 text-sm font-bold text-ink/75">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-terracotta/12 text-terracottaDeep" aria-hidden="true">
          ✓
        </span>
        Teşekkürler, önerin kürasyon ekibine iletildi.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="suggest-name" className="text-sm font-semibold text-ink/60">
          Mekan adı
        </label>
        <input
          id="suggest-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={120}
          required
          className={INPUT_CLASS}
          placeholder="Örn. Moda Kahvecisi"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="suggest-district" className="text-sm font-semibold text-ink/60">
            İlçe
          </label>
          <select
            id="suggest-district"
            value={districtSlug}
            onChange={(event) => setDistrictSlug(event.target.value)}
            required
            className={INPUT_CLASS}
          >
            {districts.map((district) => (
              <option key={district.slug} value={district.slug}>
                {district.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="suggest-category" className="text-sm font-semibold text-ink/60">
            Kategori
          </label>
          <select
            id="suggest-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
            className={INPUT_CLASS}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="suggest-address" className="text-sm font-semibold text-ink/60">
          Adres (opsiyonel)
        </label>
        <input
          id="suggest-address"
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={200}
          className={INPUT_CLASS}
          placeholder="Sokak, no"
        />
      </div>

      <div>
        <label htmlFor="suggest-note" className="text-sm font-semibold text-ink/60">
          Not (opsiyonel)
        </label>
        <textarea
          id="suggest-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
          className={INPUT_CLASS}
          placeholder="Neden butik/özel olduğunu düşünüyorsun?"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-terracottaDeep">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-terracotta px-5 text-sm font-black text-white transition-colors hover:bg-terracottaDark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-creamLight"
      >
        {submitting ? "Gönderiliyor…" : "Gönder"}
      </button>
    </form>
  );
}
