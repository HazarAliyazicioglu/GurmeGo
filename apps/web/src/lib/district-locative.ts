// Turkish locative case needs vowel harmony -- a single "'de" suffix is wrong for words ending in
// an unvoiced consonant ("Beşiktaş'ta", not "Beşiktaş'de") or certain consonant clusters
// ("Beyoğlu'nda", not "Beyoğlu'de"). The MVP scope is a fixed, small set of districts
// (docs/product-overview.md), so a lookup table is simpler and safer than general Turkish
// morphology rules; any name outside that set falls back to the common "'de" form.
const KNOWN_LOCATIVE: Record<string, string> = {
  "Kadıköy": "Kadıköy'de",
  "Beşiktaş": "Beşiktaş'ta",
  "Beyoğlu": "Beyoğlu'nda",
};

export function districtLocative(districtName: string): string {
  return KNOWN_LOCATIVE[districtName] ?? `${districtName}'de`;
}
