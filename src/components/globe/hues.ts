import { tapestryHue } from "@/lib/tapestry";
import { channels } from "./ink";

/** A country as the mask knows it: its ISO alpha-2 code, and the row it was painted with. */
export interface HuedCountry {
  code: string;
  index: number;
}

/**
 * Lay the visited countries' tapestry hues out as one rgb row each, indexed by
 * country, for the glyph pass to look up as a country blooms. Rewrites the whole
 * table, so a country that has left the journey goes back to being uncoloured.
 */
export function writeTapestryHues(rows: Uint8Array, countries: Iterable<HuedCountry>): void {
  rows.fill(0);
  for (const { code, index } of countries) {
    channels(tapestryHue(code)).forEach((channel, at) => {
      rows[index * 4 + at] = Math.round(channel * 255);
    });
  }
}
