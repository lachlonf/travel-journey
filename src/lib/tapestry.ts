/** A flat woven colour, as a six-digit hex. */
export type TapestryHue = `#${string}`;

/**
 * The colour each country wears once unlocked, drawn from Andean textile dyes.
 * The only place a tapestry hue is decided: edit an entry to recolour a country.
 * Country is a derived concept (ADR-0001), so no hue is ever stored against one.
 */
export const TAPESTRY_HUES: Readonly<Record<string, TapestryHue>> = {
  PE: "#a8324a", // cochineal
  BO: "#c2683c", // terracotta
  CL: "#2f4b7c", // indigo
  AR: "#4f7a4a", // coca leaf
  EC: "#d4a12a", // chicha gold
  CO: "#8a5a3b", // walnut husk
  BR: "#3f7d6e", // malachite
  MX: "#b04a2f", // annatto
  AU: "#c98a2b", // ochre
  NZ: "#35606a", // river slate
  JP: "#6d4a7c", // purple corn
  ID: "#9c7a2e", // tara pod
  IN: "#b5622c", // madder
  NP: "#7b2f3c", // deep cochineal
  TH: "#5a7c33", // mint leaf
  VN: "#2e6b5e", // jade
  GB: "#4a5a8c", // woad
  IE: "#557a3f", // moss
  FR: "#6b4f8a", // logwood
  ES: "#c4762f", // saffron
  IT: "#8a4a55", // brazilwood
  PT: "#3c6d8c", // faded indigo
  DE: "#6a6a3c", // birch bark
  IS: "#5c7a8c", // glacier
  MA: "#b58a3c", // desert ochre
  ZA: "#8c5f2e", // red earth
  KE: "#a35c3a", // acacia
  US: "#4a6b7c", // storm blue
  CA: "#3f5f52", // spruce
  TR: "#9c4a6b", // rose madder
};

/**
 * Worn by a country the palette has no entry for yet, so adding a country is
 * never blocked on a design decision. Undyed alpaca: it reads as a colour
 * without claiming to be a chosen one.
 */
export const FALLBACK_HUE: TapestryHue = "#8f8577";

/**
 * What colour does this country wear once unlocked? Takes an ISO alpha-2 code in
 * any case. Nothing is validated: a code that isn't a country simply isn't in the
 * palette, and wears the fallback like an uncurated one.
 */
export function tapestryHue(countryCode: string): TapestryHue {
  return TAPESTRY_HUES[countryCode.toUpperCase()] ?? FALLBACK_HUE;
}
