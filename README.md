# Journey

A personal travel globe instead of social media. The world is drawn in ASCII glyphs; the countries you've been to dissolve into real colour. Drill in from country to city to specific spot, read the story and photos for each place, or follow a trip from stop to stop.

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
- [ ] A text file renamed `fake-photo.jpg` is refused on confirm with "That upload didn't arrive", and no photo appears on the place. The browser declares it `image/jpeg` on its name, so everything up to confirming takes it; confirming reads its first bytes. The object stays in the bucket, like an upload nobody confirmed, until it's removed by hand.
- [ ] An upload target older than ten minutes is refused on confirm, leaving no photo behind.
- [ ] Editing a photo's caption shows the new caption on the place's page.
- [ ] Deleting a photo removes its row _and_ the object from the `photos` bucket: its old public URL stops working within about a minute. Storage reports it gone at once, but the CDN keeps serving a copy it has already cached; adding a query string to the URL shows the 400 straight away.
- [ ] Editing a place's details and arranging its story both survive a reload.
- [ ] Deleting a trip leaves its places on the globe, now on no trip.
- [ ] Deleting a spot removes its row _and_ its photos' objects from the `photos` bucket; deleting a city with spots left is refused.

## Deploy

Import the repo into Vercel and set `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Search engines are told not to index the site, so share the link directly.

## How it fits together

- **`src/lib/`** is the domain, with no framework code and unit tests alongside:
  - `journey.ts` builds the country → city → spot tree and orders trips.
  - `navigation.ts` handles the three drill-in levels, which pins show at each, and where the camera goes.
  - `geo.ts` has the sphere maths and the arcing great-circle camera flights.
  - `session.ts`, `exif.ts` and `cities.ts` cover the admin cookie, reading photo GPS and dates, and city search.
- **`src/components/globe/`** is the Three.js engine. It renders the globe off-screen, storing each country's unlock progress in the alpha channel. A second pass then draws locked pixels as glyphs and lets unlocked pixels show through. The reveal sweeps west to east, glyph by glyph, with a shimmer at the front. Each browser plays a country's unlock once, remembered in `localStorage`.
- **`src/lib/repository/`** holds the Supabase store and the local JSON store, both behind one interface.
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

Not built yet:

- Converting HEIC for browsers that can't decode it. Such a photo goes up as it came off the camera, with a warning that it may not display for visitors on non-Apple devices.
- Sharper imagery when zoomed into a city (the earth texture is 2048px)
- Route lines between a trip's stops
- Sweeping up uploads nobody confirmed. Supabase signs an upload URL for two hours and won't sign it for less, so bytes that arrive after the target lapses, that are never confirmed, or that are turned away for not being the image they claim, sit in the bucket unreferenced until they're removed by hand.
- An offline upload queue
- Login rate limiting (failed attempts are only slowed down)
- Colour unlock for countries too small for the atlas; their pins still work

## Credits

- Earth texture: `earth_atmos_2048.jpg` from the three.js examples (MIT).
- Country shapes: [world-atlas](https://github.com/topojson/world-atlas), from Natural Earth (public domain).
- Cities: [cities.json](https://github.com/lutangar/cities.json), from GeoNames (CC BY 4.0).
