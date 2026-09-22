# Design: Travel Journey Globe

The original design, agreed in a design interview before the scaffold was built. It's the source for the decisions behind the code. For what the scaffold did and didn't build, see the README's "Scaffold status". The next round of work is in [next-pass.md](next-pass.md).

## Concept

A personal, link-only site where my travels live on a 3D globe, instead of social media. No feed, no algorithm, no likes.

## Decisions and why

### Aesthetic

Revised on 19 September 2026, after the first build was up and didn't feel right. The framing is now **printed matter before screens**: transit signage, luggage labels, guidebooks, typed captions on the back of photographs. See [ADR-0001](../adr/0001-paper-ground-and-colour-as-the-reward.md) for the inversion, and `CONTEXT.md` for the vocabulary these decisions use.

> **Superseded.** The original aesthetic was a phosphor terminal: ASCII glyphs on near-black, warm amber for anything alive, and a visited country unlocking into real photo texture. Its reasoning was that the contrast between dead grey glyphs and vivid terrain is the whole story, and that a colourful globe everywhere would be generic. **That argument still stands and is why colour is now a reward rather than a default** — only the polarity changed. The terminal look was dropped because it's overused and was never the part that made the concept work.

- **The site rests on paper: an off-white, faintly grained ground, drawn in a single ink.**
  - Why: the dark version read as a generic developer aesthetic. One disciplined ink is also what makes the colour that does appear feel like an event.
- **The ink is the early-web hyperlink blue, aged down so it isn't fluorescent.**
  - Why: period-correct by derivation rather than by taste, which is the kind of choice that holds up.
- **The globe rests as ink glyphs on paper. A country I've visited unlocks into its tapestry hue.**
  - Why: photographic terrain punched into a light page reads as a hole, and satellite imagery at country scale is muddy anyway. Flat woven colour blooming out of a dotted sketch says "I've been here" directly, and it leaves the photographs as the only photographic thing on screen.
- **Tapestry hues come from a curated country → colour map in code.**
  - Why: an admin field is a form I'd fill in once and maintain forever; hashing gives no control and will eventually put a hot pink somewhere it doesn't suit. Country stays a derived concept, with no stored record.
- **Colour means country and nothing else. Trips carry no colour.**
  - Why: a trip crossing a border would put two colour languages on screen at once. One meaning per signal.
- **The unlock dissolves glyph by glyph with a shimmer sweeping across the country, over about 1.5–2 seconds, once per country.**
  - Why: I weighed a simple crossfade against a more elaborate reveal and chose the fancier version. It's a one-off event per country, so it costs nothing ongoing.
- **Pins are minimal: a dot and a label, with no photo thumbnails on the globe.**
  - Why: thumbnails would clash with the ASCII restraint, add load time, and spoil the photos before the click.
- **Type is Cabin for display, Literata for body, Courier for meta.**
  - Why: the first build used a modern screen serif, which read as polished — the one quality I'm trying to lose. The fault turned out to be sharpness, not serifs: high stroke contrast and pointed terminals. Literata is soft, round and low-contrast while still being a serif. Cabin descends from Gill Sans, drawn by Edward Johnston's student, so the headlines carry the signage warmth I wanted from Johnston itself, which is licensed and can't ship here. Courier is a typewriter face, not a terminal one, which is exactly on theme.
- **Texture goes on the ground and the edges, never on the photographs.**
  - Why: paper grain and slightly irregular rules give the hand-made feel. Dithering or halftoning the photos would destroy the thing the site exists to show.
- **The camera arcs over the globe between places, like a flight, rather than cutting or dollying straight.** Animations must be very smooth.
  - Why: it should feel like travelling from place to place, especially when following a trip.

### Data model

- **Three levels: country → city → specific spot.**
  - Country (level 1) carries a light summary: name and visited date range.
  - City (level 2) holds its own photos and story directly.
  - A specific spot (level 3, e.g. Laguna 513) sits under a parent city and folds into that city's pin when zoomed out.
  - Why: a city I only passed through should still get a pin and photos, without inventing a fake spot. Remote spots need their own precise pin.
- **Parent city is chosen when the spot is entered, pre-filled with the nearest city from a cities database, and freely editable.**
  - Why: I imagined automatic nearest-city matching, but the database's nearest city often isn't the one I'd use. For Laguna 513, it suggests a nearby village rather than Huaraz.
- **Coordinates can be typed in by hand.**
  - Why: remote places like Laguna 513 won't be in any cities database.
- **The cities database is only for search and placement.** Only places I explicitly add appear on the globe. No population data is needed.
  - Why: the globe shows my journey, not a generic map of the world's cities.
- **Home is a visited country like any other, with no special state.**
  - Why: I might call somewhere else home one day. The only home I have is mother earth.
- **Trips are a first-class, optional grouping.**
  - A trip has a name, a date range and a story, and can span multiple countries.
  - A place belongs to zero or one trip. A country can hold loose places, places grouped into trips, or both.
  - Why: a summary derived only from dates felt unhuman. Real trips cross borders.
- **Dates live on places, as a list so return visits count.** Photo metadata (EXIF) pre-fills location and date, stays editable, and falls back to manual entry.
  - Why: it removes most data entry for places I photographed.

### Navigation

- **Drill in by clicking (country, then city, then spot), not by free continuous zoom.**
  - Why: it's a personal journey site, not a navigation tool. Deliberate clicks fit "reveal a memory", and it's simpler to build.
- **The landing page offers two modes: "Explore freely" and "Follow a trip".**
  - Why: story mode should be a real, discoverable way in, not a hidden button. It replaces the social-media narrative for the people I share the link with.
- **The landing is a title and those two choices, sitting over the live globe.** Trips opens a panel over the same globe rather than a separate page.
  - Why (revised 19 September 2026): the first build made the landing a separate document listing every trip, so the globe — the reason the site exists — was hidden until the second click. One globe loads once and never unmounts, which is also the fastest version.
- **A place's story opens as a panel for a preview, and takes over the screen as a full page to read.**
  - Why (revised 19 September 2026): the globe is context and the story is content, and in the first build they fought over one screen. A 34rem panel is narrower than a phone is tall, which left no room for the story to be laid out as anything but a column.
- **Story mode steps through a trip in order at the viewer's pace ("next"), never on autoplay.**
  - Why: these are memories. People should be able to linger on a photo or a caption.
- **Clicking a place on a trip while exploring shows that place, with a "part of [trip]" link into story mode. It never redirects to the start of the trip.**
  - Why: you clicked that place on purpose, so being taken somewhere else would be jarring.

### Content and admin

- **Everything is managed in an admin UI backed by a database. No files in the repo.**
  - Why: I'll keep adding countries and photos as I travel the world, not just Peru.
- **The admin sits behind one shared password.**
  - Why: I'm the only editor, so a full login system isn't worth it. A password is easy to type on a phone.
- **Photos upload from the browser into storage and are optimised on the way in.** An offline upload queue is deferred.
  - Why: adding photos mid-trip should work from a phone. I probably won't, but who knows.
- **A place's page is a blog-like scroll, with photos woven in among captions and text.**
  - Why: a grid with a lightbox is exactly the Instagram pattern I'm getting away from. I want to play around with the layout and make it feel personal.
- **Photos appear as prints resting on the paper: a mat brighter than the ground, a whisper of shadow, and a slight tilt.** Sizes vary and the column is deliberately imperfect.
  - Why (revised 19 September 2026): the first build made every photo identical and full-bleed, which is the grid I was running from. The aesthetic should feel hand-made even though the interactions stay polished.
- **A print's tilt and size are derived from its photo's id, never random and never stored.**
  - Why: imperfection that changes on every render reads as a bug, and a stored field is a knob I'd tune twice and then resent. Derived values are stable, free, and give each photo its own character.
- **Prints never overlap, except for one deliberate interlocked pair per story, chosen by position.**
  - Why: a loose scattered pile is the most scrapbook-looking option and the most hostile one — on a phone it hides part of a photo with no way to see it, and it breaks reading order. One interlocked pair buys the gesture without the layout ever being uncertain.

### Stack and reach

- **Three.js for the globe.**
  - Why: raw WebGL is months of plumbing, and higher-level globe libraries would fight the custom ASCII shader. Three.js is the right level to learn on.
- **Next.js on Vercel, with Supabase for the database and photo storage.**
  - Why: one codebase and one deploy, and the most documented path while I'm learning.
- **Unlisted.** Shared by link, not indexed, no login for visitors.
  - Why: it fits the anti-social-media intent, with no moderation or privacy setup needed.
- **Mobile is first-class, with a lighter rendering path on low-power devices rather than a lesser fallback experience.**
  - Why: I'll share the link on Instagram, so most viewers will be on phones.

## Deliberately deferred

- Route lines drawn between a trip's stops
- An offline upload queue
- A full geographic cities database
