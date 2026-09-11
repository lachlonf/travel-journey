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
2. In the SQL editor, run `supabase/migrations/0001_init.sql`. It creates the `trips`, `places` and `photos` tables, plus a public `photos` storage bucket.
3. From Project Settings → API, copy the project URL and the `service_role` key into `.env.local`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   The service role key bypasses row-level security. It's only ever used on the server. Never give it a `NEXT_PUBLIC_` prefix.
4. Restart `npm run dev`. The database starts empty, so the sample trip disappears.

## Deploy

Import the repo into Vercel and set `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Search engines are told not to index the site, so share the link directly.

## How it fits together

- **`src/lib/`** is the domain, with no framework code and unit tests alongside:
  - `journey.ts` builds the country → city → spot tree and orders trips.
  - `navigation.ts` handles the three drill-in levels, which pins show at each, and where the camera goes.
  - `geo.ts` has the sphere maths and the arcing great-circle camera flights.
  - `session.ts`, `exif.ts` and `cities.ts` cover the admin cookie, reading photo GPS and dates, and city search.
- **`src/components/globe/`** is the Three.js engine. It renders the globe off-screen, storing each country's unlock progress in the alpha channel. A second pass then draws locked pixels as glyphs and lets unlocked pixels show through, cell by cell, with a shimmer at the edge.
- **`src/lib/repository/`** holds the Supabase store and the local JSON store, both behind one interface.
- **`src/app/`** has the pages: `/` landing, `/explore`, `/trips/[id]` (story mode) and `/admin`.

## Scaffold status

Working end to end:

- ASCII globe with the dissolve unlock
- Drill-in navigation with arcing camera flights
- Explore mode and story mode, with story links from explore
- Journal-style story panel
- Mobile bottom sheet and a lighter rendering path for phones
- Password-gated admin: add trips, cities and spots, city search, nearest-city suggestion, EXIF location and date pre-fill, and photo upload with in-browser resizing

Not built yet:

- Editing or deleting trips, places and photos
- A second visit to a city you've already added (adding it again is refused; there's no "add another date" yet)
- Reordering photos or placing them between paragraphs
- Sharper imagery when zoomed into a city (the earth texture is 2048px)
- Route lines between a trip's stops
- An offline upload queue
- Login rate limiting (failed attempts are only slowed down)
- Colour unlock for countries too small for the atlas; their pins still work

## Credits

- Earth texture: `earth_atmos_2048.jpg` from the three.js examples (MIT).
- Country shapes: [world-atlas](https://github.com/topojson/world-atlas), from Natural Earth (public domain).
- Cities: [cities.json](https://github.com/lutangar/cities.json), from GeoNames (CC BY 4.0).
