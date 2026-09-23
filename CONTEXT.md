# Journey

A personal, link-only travel journal. Places visited live on a 3D globe; each one holds writing and photographs. It exists as an alternative to social media, so it has no feed, no algorithm and no likes.

## Language

### The journey

**Journey**:
Everything the site holds: every place visited, gathered into countries and optionally into trips.

**Place**:
Somewhere visited. A place carries its own story, photographs and visit dates. Every place is either a city or a spot.
_Avoid_: location, destination, entry

**Country**:
A country holding at least one place. A country is worked out from the places inside it rather than recorded in its own right, so there is no such thing as a country nobody has visited.
_Avoid_: region, territory

**City**:
A place at the scale of a town or city. A city can hold spots, and can equally stand alone for somewhere only passed through.

**Spot**:
A specific place inside a city, such as a lake or a trailhead. A spot always names a parent city, chosen when it is entered, and folds into that city's pin when the globe is zoomed out.
_Avoid_: POI, point of interest, landmark, site

**Pin**:
A place's marker on the globe: a dot and a label. A pin is how a place is reached, not the place itself.
_Avoid_: marker, node

**Visit**:
One dated occasion of being somewhere. A place carries a list of them, so returning to the same place counts again rather than overwriting.

**Trip**:
An optional named grouping of places, with its own dates and story, which may span several countries. A place belongs to zero or one trip.

**Stop**:
A place as it is encountered within a trip, in the trip's order. The same place is a stop only in the context of a trip.
_Avoid_: leg, waypoint, step

**Story**:
The writing and photographs belonging to one place or one trip, read as a single scroll rather than a gallery.
_Avoid_: post, article, blog, gallery

**Story block**:
One unit of a story: either a passage of text or a single photograph. Blocks are ordered, and that order is the story.

### The look

**Paper**:
The off-white, faintly grained ground the whole site rests on.
_Avoid_: background, canvas, light mode

**Ink**:
The single colour every piece of chrome is drawn in: rules, labels, links, and the glyphs of the resting globe. There is exactly one ink, and nothing else in the interface is coloured.
_Avoid_: accent, primary, brand colour

**Glyph**:
One character of the ASCII world drawn on the globe. A country that has not been visited is nothing but glyphs.

**Unlock**:
The one-off moment a visited country's glyphs dissolve into its tapestry hue. Colour is the reward for having been somewhere, so an unlocked country is the only coloured thing on the globe.
_Avoid_: reveal, highlight, activate

**Tapestry hue**:
The colour a country wears once unlocked, drawn from a small curated palette. A country has one; a trip has none.
_Avoid_: country colour, theme colour, accent

**Seam**:
The line where two unlocked countries meet, drawn in the dye of whichever country it is stitching. Two neighbours can wear the same colour, and a country that has bloomed carries no glyphs to separate them, so the seam is what keeps them two countries.
_Avoid_: border, outline, stroke

**Dye**:
A country's own tapestry hue steeped darker, which is what the unlock's sweeping front is drawn in. Dark-on-light is the only contrast paper has, so the front reads by deepening rather than by brightening, and never by introducing a colour of its own.
_Avoid_: shimmer, glow, highlight

**Print**:
A photograph as it appears in a story: matted, very slightly tilted, resting on the paper as a physical print would. Prints never overlap, apart from one deliberate interlocked pair per story.
_Avoid_: image, thumbnail, card, tile

**Landing**:
The title and the two choices — Explore and Trips — resting on the globe when the site opens. The landing is a layer over the world, never a page of its own, so choosing either one never reloads the globe.
_Avoid_: home page, splash, index

**Overlay**:
Whatever rests over the globe before anywhere has been chosen: the landing, or the trips panel. There is at most one, it always sits over the whole world rather than over somewhere drilled into, and opening a place puts it away.

**Preview**:
A place's story as it opens beside the globe: enough to tell what somewhere is without leaving the world you clicked it from. The preview is where a story is met; it is never where a story is read.
_Avoid_: card, popup, detail panel

**Reading**:
A story taken over the whole screen as a page, where the writing and the prints have the room a panel can't give them. The globe is left exactly where it was underneath, so leaving the page comes back to the same preview over the same country.
_Avoid_: detail page, article view, modal, lightbox
