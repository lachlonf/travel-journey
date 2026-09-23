# Journey

A personal travel journal. Experience my travel journey with me and relive memories!

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Until Supabase is connected, the site reads a sample Peru trip from `data/seed.json`. Anything you add is saved to `.data/journey.json`, and uploaded photos go in `public/uploads/`. Both are gitignored.

The admin is at http://localhost:3000/admin. A `.env.local` was created with `ADMIN_PASSWORD=change-me` and a random `SESSION_SECRET`. Change the password.

| Command             | What it does          |
| ------------------- | --------------------- |
| `npm run dev`       | Development server    |
| `npm test`          | Unit tests (Vitest)   |
| `npm run typecheck` | TypeScript            |
| `npm run lint`      | ESLint                |
| `npm run build`     | Production build      |
| `npm run sweep`     | Sweep unused uploads  |

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the files in `supabase/migrations/` in order. `0001_init.sql` creates the `trips`, `places` and `photos` tables, plus a public `photos` storage bucket. `0002_story_blocks.sql` turns each place's story into ordered text and photo blocks, converting any existing rows, and gives the `photos` bucket an allowed-image-type list and a 25 MB per-file limit.
3. From Project Settings → API, copy the project URL and the `service_role` key into `.env.local`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   The service role key bypasses row-level security. It's only ever used on the server. Never give it a `NEXT_PUBLIC_` prefix.
4. Restart `npm run dev`. The database starts empty, so the sample trip disappears.

### Check Supabase by hand

The Supabase store isn't unit tested, because its tests would only prove the mocks. Run through this against a real project whenever that store changes. Last run in full on 18 September 2026:

- [ ] Running `0002_story_blocks.sql` on a project holding old rows leaves every place's story reading as it did before: the old text first, then its photos in their old order.
- [ ] Adding a trip, a city and a spot all save.
- [ ] Adding a photo uploads it straight to the bucket: the progress bar moves, the photo appears on the place, and the object is in `photos` under the place's id.
- [ ] Killing the network mid-upload fails that photo alone, and **Retry** sends it again without the caption being retyped.
- [ ] A file that isn't an allowed image is refused. The admin refuses it on **Upload**, naming the types it takes; to see the bucket refuse it too, PUT something else (a `.txt`) to a signed URL by hand and watch it come back 400.
- [ ] A file over 25 MB is refused by the bucket, and that photo is reported as failed rather than recorded. Photos the browser can decode are resized to 2400px and re-encoded before they go up, so they land well under the cap: test this with something the browser can't decode, such as a large HEIC outside Safari, which goes up as it came off the camera.
- [ ] Confirming an upload whose bytes never arrived returns "That upload didn't arrive". Prepare a target, skip the PUT, and confirm it.
- [ ] A text file renamed `fake-photo.jpg` is refused on confirm with "That upload didn't arrive", and no photo appears on the place. The browser declares it `image/jpeg` on its name, so everything up to confirming takes it; confirming reads its first bytes. The object stays in the bucket, like an upload nobody confirmed; `npm run sweep` lists it a day later, and `npm run sweep -- --delete` collects it.
- [ ] An upload target older than ten minutes is refused on confirm, leaving no photo behind.
- [ ] Editing a photo's caption shows the new caption on the place's page.
- [ ] Deleting a photo removes its row _and_ the object from the `photos` bucket: its old public URL stops working within about a minute. Storage reports it gone at once, but the CDN keeps serving a copy it has already cached; adding a query string to the URL shows the 400 straight away.
- [ ] Editing a place's details and arranging its story both survive a reload.
- [ ] Deleting a trip leaves its places on the globe, now on no trip.
- [ ] Deleting a spot removes its row _and_ its photos' objects from the `photos` bucket; deleting a city with spots left is refused.
- [ ] `npm run sweep` names no object that a photo points at, and leaves the fake above alone until a day has passed. A day later it lists it, and `npm run sweep -- --delete` removes exactly what was listed, leaving every real photo on its place.

### Sweep unreferenced uploads

Bytes reach the `photos` bucket that no photo ever points at. Supabase signs an upload URL for two hours and won't sign it for less, so bytes can arrive long after our own ten-minute target has lapsed; a browser can go away between sending them and confirming them; and bytes turned away for not being the image they claimed are left where they are on purpose, because deleting what someone just watched go up is the one mistake with no way back.

```bash
npm run sweep              # lists what no photo points at, and removes nothing
npm run sweep -- --delete  # removes exactly what the listing showed
```

An object is collected only when no `photos.storage_path` row points at it *and* it is over a day old. The age matters: an upload being confirmed right now has no row either, so a young object is never touched. Rows pointing at an object that has gone are reported as their own section and never acted on.

Run it yourself, when you mean to. Nothing schedules it.

## Check the globe by hand

The globe shader has no unit tests, because asserting on WebGL output would only prove the harness. Run through this in a browser whenever the engine, the shaders or the palette change. The sample data holds one country, so add a few places in the admin first: two neighbours and somewhere the palette has no entry for. Last run in full on 23 September 2026:

- [ ] The resting world is ink on paper and nothing else. Drill in from the world to a country to one of its cities and back out again: land nobody has visited is glyphs in the one ink at all three altitudes, with no second colour anywhere, and only the glyphs' spacing against the land changes. An unlocked country is the exception, and reads as flat hue rather than glyphs once you are inside it.
- [ ] A country unlocks into its hue. Clear `journey:seen-countries` from localStorage, reload, and watch a visited country's glyphs dissolve into its tapestry hue. It plays once: reload again and that country is already coloured, with no second dissolve.
- [ ] The front runs west to east, once per country. The bloom crosses each country glyph by glyph, behind a front in that country's dye — never a colour the country doesn't wear. With several countries unlocked at once they start in turn rather than together.
- [ ] Two adjacent visited countries stay two countries. Give two neighbours places, unlock both, and look at where they meet: a seam in the dye of whichever country it stitches. Give them the same hue by hand in `src/lib/tapestry.ts`, and the seam is still what tells them apart; put it back afterwards.
- [ ] A country with no curated hue wears the fallback. Add a place in a country absent from `TAPESTRY_HUES` (Norway, say): it unlocks like any other, in undyed alpaca, and nothing errors.
- [ ] The low-power path renders the same world. Open on a phone, or in devtools with touch emulation on, and compare against desktop: coarser glyphs and a softer sphere, but the same countries unlocked and the same hues. A phone must never show fewer unlocked countries than desktop.
- [ ] Reduced motion is still the whole journey. With the OS set to reduce motion, the globe doesn't spin on its own, camera moves land instantly, and visited countries are simply already coloured — no dissolve, and nothing missing that motion would have shown.
- [ ] The globe at 400px wide is legible. Narrow it with device emulation or a phone, because a Chrome window stops at 500px: the glyphs stay readable rather than turning to noise, pins and labels don't pile up, and drilling into a city still frames it above the bottom sheet.

## Deploy

Import the repo into Vercel and set `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Search engines are told not to index the site, so share the link directly.

## How it fits together

- **`src/lib/`** is the domain, with no framework code and unit tests alongside:
  - `journey.ts` builds the country → city → spot tree and orders trips.
  - `navigation.ts` handles the three drill-in levels, which pins show at each, and where the camera goes.
  - `geo.ts` has the sphere maths and the arcing great-circle camera flights.
  - `session.ts`, `exif.ts` and `cities.ts` cover the admin cookie, reading photo GPS and dates, and city search.
- **`src/components/globe/`** is the Three.js engine. It renders the globe off-screen as one fact per channel: ink density, which country, how lit, and how far that country's unlock has swept past. A second pass then draws locked pixels as ink glyphs on paper, and blooms unlocked ones into their country's tapestry hue. The bloom sweeps west to east, glyph by glyph, behind a front of that same hue steeped darker. Each browser plays a country's unlock once, remembered in `localStorage`.
- **`src/lib/repository/`** holds the Supabase store and the local JSON store, both behind one interface.
- **`scripts/`** holds what's run by hand rather than by the app. `sweep.ts` collects bucket objects no photo points at; it runs on Node directly, which is why the imports it reaches name their `.ts` files.
- **`src/app/`** has the pages: `/` landing, `/explore`, `/trips/[id]` (story mode), `/admin`, `/admin/trips/[id]` (editing one trip) and `/admin/places/[id]` (editing one place).

## Scaffold status

Working end to end:

- ASCII globe with the dissolve unlock
- Drill-in navigation with arcing camera flights
- Explore mode and story mode, with story links from explore
- Journal-style story panel
- Mobile bottom sheet and a lighter rendering path for phones
- Password-gated admin: add trips, cities and spots, city search, nearest-city suggestion, and EXIF location and date pre-fill
- Photos uploaded straight from the browser to storage: resized first when the browser can decode them, each with its own progress, and failed ones retried without retyping a caption
- Editing a place: its name, coordinates, country code, trip, and the city a spot folds into
- Editing a trip: its name, dates and story, and dissolving a trip without losing its places
- Editing a place's photos: rewriting a caption, and deleting a photo with its stored file
- Arranging a place's story in the admin: text and photo blocks moved into the order they're read in
- Deleting a place, along with its photos and their stored files
- Recording a return visit to a place, so a city visited twice keeps both dates
- Turning away an upload whose bytes aren't the image its name claims, checked when the upload is confirmed
- Sweeping up the objects that leaves behind: `npm run sweep` lists what no photo points at, and removes it when asked

Not built yet:

- Converting HEIC for browsers that can't decode it. Such a photo goes up as it came off the camera, with a warning that it may not display for visitors on non-Apple devices.
- Sharper imagery when zoomed into a city (the earth texture is 2048px)
- Route lines between a trip's stops
- An offline upload queue
- Login rate limiting (failed attempts are only slowed down)
- Colour unlock for countries too small for the atlas; their pins still work

## Credits

- Earth texture: `earth_atmos_2048.jpg` from the three.js examples (MIT).
- Country shapes: [world-atlas](https://github.com/topojson/world-atlas), from Natural Earth (public domain).
- Cities: [cities.json](https://github.com/lutangar/cities.json), from GeoNames (CC BY 4.0).
