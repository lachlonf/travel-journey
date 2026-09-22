# Paper ground, and colour as the reward for having been somewhere

The site was first built as a phosphor terminal: ASCII glyphs on near-black, warm amber for anything alive, with a visited country unlocking into photographic satellite terrain. We have inverted it. The globe now rests as ink glyphs on paper, and a visited country unlocks into a flat **tapestry hue** from a curated palette rather than into photo terrain.

The original reasoning still holds and is the reason for the change rather than against it: a globe that is colourful everywhere is generic, and the contrast between dead world and living world is the whole story. What changed is which half carries the colour. On a light ground, photographic terrain punched into the page reads as a hole, and satellite imagery at country scale is muddy regardless of palette. Flat woven colour blooming out of a dotted grey-blue sketch says "I have been here" far more directly, and it lets the photographs be the only photographic thing on the page.

## Considered options

- **Keep the dark ground.** Rejected: the terminal look is overused, and it was never the reason the concept worked.
- **Light ground, photo terrain unlock.** Rejected for the reasons above.
- **Light ground, tapestry hue unlock.** Chosen.

## Consequences

- Countries need colours, so there is a curated country → tapestry hue map in code. Country stays a derived concept: it gains no stored record and no admin field.
- Colour means _country_ and nothing else. Trips deliberately carry no colour, so that a trip crossing a border does not put two colour languages on screen at once.
- The globe shader is rewritten rather than retinted: the shimmer, the glyph palette and the unlock target all change.
- Every token in the stylesheet changes, and the admin inherits them.
