# Prototype: does the tapestry unlock read on paper? (#18)

**Question.** Does a country blooming from ink glyphs into flat tapestry colour actually read
well on a light ground? On near-black, dead glyphs against vivid terrain were obvious. On paper
the risks were that the hue reads muddy, that it reads as a sticker pasted on, or that the
shimmer on the sweep front disappears.

Run it: `npm run dev`, then `/explore?variant=A` … `D`. The bar at the bottom cycles variants
(← / → also work) and `replay unlocks` forgets `journey:seen-countries` so the sweep plays again.
Ten demo countries are unlocked on top of the seed data so neighbouring hues can be judged
against each other. `UNLOCK_MS` / `UNLOCK_STAGGER_MS` at the top of `engine.ts` at 9000 / 6000
runs the sweep in slow motion, which is the only way to actually watch the front.

## Answer

**Yes — the hue reads. Flat does not.** Andean textile colour against `#f4f1e9` paper is strong
and unambiguous even at world altitude, and nothing about the light ground makes it muddy: the
worry about muddiness was wrong. Two of the three original worries were right, though, and both
are about *how* the colour is laid down, not about the colour:

1. **Dead-flat fill reads as a sticker** (variant A). A uniform hue with a hard vector edge
   against paper looks like a political-map infographic pasted over the sketch — the one thing
   the redesign is trying not to be. What fixes it is keeping terrain in the colour: multiplying
   the hue by the earth's brightness (`0.8 + 0.3 * terrain`) leaves relief visible inside the
   country, so the patch sits *in* the paper. This is the single most important finding.
2. **The shimmer has to change colour.** Amber (`SHIMMER = #ffc76b`) on paper is dirt — it has
   nowhere to go against a light ground. The front needs to be the *darkest dye of the country's
   own hue* (`mix(hue, INK, 0.5)`) instead: dark-on-light is the only contrast direction that
   exists on paper, so the sweep reads by getting darker, never brighter.
3. **The per-cell random dissolve breaks down.** On black, cells flicking to terrain read as a
   reveal. On paper, cells flicking to flat hue read as scattered colour confetti — the front
   stops being a front. Tightening the cell jitter to about a third (a ragged travelling line
   rather than scattered cells) restores it, and drawing the band itself as dense hue-dyed
   *glyphs* keeps the sweep made of marks rather than of blocks.

An off-register ink rim (the plate printed 2–3px out from the colour) is the cheapest way to stop
the edge looking mechanical — it costs one extra texture sample and reads as printing.

## The variants

| | What it does | Verdict |
|---|---|---|
| **A** Dye bath | The spec at its word: glyphs dissolve, flat hue soaks the shape. | Reads, but sticker-flat, and the dissolve is confetti. |
| **B** Woven glyphs | No fill at all — glyphs take the hue and densify. | Most harmonious with the sketch, but the reward is too quiet and borders between neighbours blur. |
| **C** Letterpress | Hard wipe, off-register ink rim, terrain left in the hue. | Best settled state by a distance. The wipe edge is too mechanical in motion. |
| **D** Printed bloom | C's plate behind B's band of dyed glyphs, dissolve tightened to a torn line. | **The recommendation.** Settles like C, moves like B. |

## What the shader work should do differently

For #19 (the resting world):

- The resting sketch is currently **far too faint on paper**. Inverting `PAPER` / `INK` alone
  gives a pale dotted ring: ocean glyphs nearly vanish and the limb barely holds. The glyph ramp
  needs a floor on paper — `mix(PAPER, INK, 0.18 + 0.82 * level)` rather than scaling ink towards
  the ground — and the limb needs an explicit push into the level (`+ limb * 0.55`) or the globe
  has no edge.

For #20 (the unlock):

- Keep the sweep; keep the stagger; keep the once-per-browser memory.
- Replace `SHIMMER` with a per-country derived dye, not a constant. There is no one shimmer colour
  on paper.
- The hue must be modulated by terrain, not painted flat.
- Tighten the dissolve and draw the front as glyphs.
- The glyph pass needs the country's hue, which pass 1 doesn't carry today. The prototype's
  packing works and is cheap: pass 1 writes `r = terrain brightness, g = country index / 255,
  b = limb, a = unlock`, the render target is sampled `NearestFilter` so the index survives, and
  the glyph pass looks the hue up in a 256×1 texture written from `tapestryHue()`. No MRT needed.

Unresolved, worth a look during #19:

- **Ink on dark hues.** Pin labels and rules are `#1c1cc9`; Chile's indigo is `#2f4b7c` and
  Japan's purple corn `#6d4a7c`. Ink on those is close to invisible. Either labels get a paper
  chip behind them over unlocked land, or the dark end of the palette lightens.
- Nothing here was checked at country or city altitude, or at 400px, or on the low-power path.
