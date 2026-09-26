import { z } from "zod";

// POST /venue-suggestions body (apps/api's VenueSuggestionsController -> VenueSuggestionsService),
// stored as a `ContributionQueue` row with `type: "NEW_VENUE"` and `venueId: null` -- there is no
// `Venue` row yet, that's the point of this endpoint. Same shape used by the web submission form.
export const SuggestVenueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  districtSlug: z.string().min(1),
  category: z.string().min(1),
  address: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});
export type SuggestVenue = z.infer<typeof SuggestVenueSchema>;

export const SuggestVenueResponseSchema = z.object({ ok: z.literal(true) });
