# Next pass: a journal you can keep writing

Status: ready for an agent. Once an issue tracker is configured (`/setup-matt-pocock-skills`), publish with the `ready-for-agent` label.

## Problem Statement

The globe works, but it isn't yet a journal I can keep up as I travel.

Once I add a place, I can't touch it again. I can't fix a typo in a story, move a pin I dropped in the wrong spot, or delete a photo I didn't mean to upload. And when I go back to a city I've already been to, the admin refuses to add it, so the return trip isn't recorded anywhere.

A place's page doesn't read like a journal either. All the writing comes first and every photo is piled underneath, when the whole point was to tell the story with photos placed where they belong in it.

Uploading is fragile too. Photos go through the web server on the way to storage, so large files can hit the host's request limit. That's exactly the kind of failure I'd hit on hotel wifi, with no way to fix it from my phone.

## Solution

I can edit and delete anything I've added: trips, cities, specific spots and photos. Recording a return visit is one action from the place I've already added. A place's story is an ordered sequence of text and photos that I arrange myself, and visitors read it in that order.

Photos upload straight from my browser into storage. The server only hands out permission to upload and then records the photo once it has arrived, so photo size no longer depends on the host's request limit.

## User Stories

### Writing the journal

1. As the journal owner, I want a place's story to be a sequence of text passages and photos, so that the page reads like a story instead of an essay followed by a gallery.
2. As the journal owner, I want to insert a photo between two paragraphs, so that it appears at the moment in the story it belongs to.
3. As the journal owner, I want to move a photo or text passage up and down in a place's story, so that I can rearrange the telling after the fact.
4. As the journal owner, I want newly uploaded photos to land at the end of the story, so that nothing I upload is ever lost or hidden.
5. As the journal owner, I want to split a text passage where I insert a photo, so that I don't have to cut and paste text around.
6. As the journal owner, I want blank lines in a text passage to still start new paragraphs, so that writing feels like writing, not form-filling.
7. As the journal owner, I want to edit a photo's caption after uploading, so that I can add context once I've had time to think.
8. As the journal owner, I want to remove a photo from a place, so that accidental or duplicate uploads don't stay in my journal.
9. As the journal owner, I want removing a photo to also delete the stored file, so that deleted photos don't stay reachable by URL.
10. As the journal owner, I want existing places to keep their current story and photos when this ships, so that nothing I've already written needs redoing.

### Editing places

11. As the journal owner, I want to rename a place, so that I can fix typos or use the name I actually call it.
12. As the journal owner, I want to change a place's coordinates, so that I can correct a pin that landed in the wrong spot.
13. As the journal owner, I want the nearest-city suggestion to update when I change a spot's coordinates, while never overwriting a parent city I chose myself, so that corrections stay easy but deliberate.
14. As the journal owner, I want to change which city a specific spot folds into, so that I can regroup it (Huaraz rather than Carhuaz).
15. As the journal owner, I want to change a place's country code, so that I can fix a spot near a border that got the neighbouring country.
16. As the journal owner, I want to change or clear the trip a place belongs to, so that I can reorganise my trips later.
17. As the journal owner, I want to delete a specific spot, so that I can remove places I added by mistake.
18. As the journal owner, I want deleting a city that still has spots to be refused with a clear message, so that I can't wipe out several places and their photos with one click.
19. As the journal owner, I want deleting a place to delete its photos and their stored files, so that nothing is left orphaned.
20. As the journal owner, I want a country to lock back into ASCII when its last place is deleted, so that the globe stays truthful.
21. As the journal owner, I want every edit to show up on the public pages right away, so that I don't have to redeploy or wait.

### Return visits

22. As the journal owner, I want to add another visit date to a place I've already added, so that going back somewhere is recorded.
23. As the journal owner, I want the admin to offer "add a visit" when I try to add a city that already exists, so that I'm guided to the right action instead of hitting an error.
24. As the journal owner, I want to remove a visit date I entered wrongly, so that the dates stay accurate.
25. As the journal owner, I want a place's visit dates kept in order and free of duplicates, so that the dates it shows make sense.
26. As a visitor, I want to see every date a place was visited, so that I can tell it was a place worth returning to.
27. As a visitor, I want a country's date range to include return visits, so that its summary reflects the whole history.

### Editing trips

28. As the journal owner, I want to edit a trip's name, dates and story, so that trips can be refined as I remember more.
29. As the journal owner, I want to delete a trip without deleting its places, so that I can dissolve a grouping without losing memories.
30. As a visitor, I want a deleted trip to simply disappear from the trip list, so that I never land on a broken story.

### Uploading

31. As the journal owner, I want photos to upload straight from my browser to storage, so that the host's request size limit doesn't cause failures.
32. As the journal owner, I want to see each photo's upload progress and which photos failed, so that I know what to retry.
33. As the journal owner, I want to retry a failed upload without re-entering its caption, so that a bad connection costs me as little as possible.
34. As the journal owner, I want photos still resized in my browser before upload when possible, so that uploads are fast on mobile data.
35. As the journal owner, I want only JPEG, PNG, WebP, AVIF and HEIC files accepted, so that nothing unsafe gets published.
36. As the journal owner, I want a photo to be recorded only after its file has actually arrived in storage, so that the journal never shows broken images.
37. As the journal owner, I want a clear warning when a HEIC photo couldn't be converted in my browser, so that I know it may not display for visitors on non-Apple devices.
38. As the journal owner, I want the location and date read from each photo before upload to still pre-fill the place form, so that direct uploads don't lose that convenience.

### Reading

39. As a visitor, I want a place's page to show text and photos in the order the owner arranged, so that I experience the story as it was meant to be told.
40. As a visitor in story mode, I want each stop to use the same arranged story, so that following a trip reads the same as exploring.
41. As a visitor, I want a photo whose file is missing to be skipped rather than shown broken, so that pages always look intentional.

### Safety

42. As the journal owner, I want every editing action to require my admin session on the server, so that nobody can change my journal by calling the endpoints directly.
43. As the journal owner, I want upload permission to be scoped to one place, one file type and a short expiry, so that a leaked upload link can't be used to fill my storage.

## Implementation Decisions

- **Admin commands module (new, deep).** All writes go through a single admin-commands module built on top of the existing storage interface: validation, parent-city resolution, duplicate detection, visit dates, story arrangement, upload preparation and confirmation. It doesn't know about Next.js, cookies or HTTP. Server actions become thin: check the admin session, call one command, revalidate, and return the command's result unchanged.
- **Command results.** A command returns either the updated entity or a typed error with a stable code and a human message. Codes include: invalid coordinates, invalid country, invalid date, unknown place, unknown trip, city already exists (carrying the existing city's id so the admin can offer "add a visit"), city still has spots, photo not in this place, upload not found, and unsupported file type. Commands throw only for unexpected failures, such as storage outages.
- **Commands.**
  - Trips: create, update, delete. Deleting a trip clears the trip from its places and keeps the places.
  - Places: add, update, delete (refused for a city that still has spots), add visit, remove visit.
  - Story: set a place's story blocks. Photos: update caption, delete.
  - Uploads: prepare an upload, confirm an upload.
- **Parent cities.** When a spot is added or its parent changes, the parent city is matched by name within the country, or created. A city created this way joins no trip and records no visit, keeping the behaviour from the review fix.
- **Story blocks replace the story text on places.** A place's story is an ordered list of blocks, each either a text block (paragraph splitting on blank lines stays) or a photo block referencing one of that place's photos. Photos no longer carry a sort order: their position is where they appear in the blocks.
- **Read model.** The journey read model exposes each place's resolved story: blocks in order, with photo blocks resolved to photos. Blocks pointing at missing photos are dropped, and photos not referenced by any block are appended at the end. The story panel in both explore and story mode renders only this resolved story.
- **Trips keep plain story text.** A trip's introduction remains paragraphs only.
- **Setting blocks is validated.** Every photo block must reference a photo belonging to that place, and each photo may appear at most once. Text blocks that are empty after trimming are dropped.
- **Uploads become two steps.**
  1. Prepare: given a place and a content type from the allowlist, the storage layer returns an upload target (a destination the browser can send the file to directly, plus an opaque upload id) that expires quickly.
  2. Confirm: given the upload id plus caption, date taken and coordinates, the command checks that the file arrived and matches the declared type, records the photo, and appends a photo block to the place's story.
- **Upload targets per store.** The Supabase store issues signed upload URLs into the photos bucket. The bucket enforces the image allowlist and a per-file size cap as defense in depth. The local development store issues a target backed by a development-only upload endpoint that writes into the local uploads folder.
- **Browser upload flow.** Read metadata, resize when the browser can decode the format, prepare, send the file directly, confirm. Failures are reported per photo and can be retried from the prepare step with the caption preserved. The server action body size limit goes back to the framework default, since photo bytes no longer pass through actions.
- **Visits.** A place's visit dates stay a list. Adding a visit inserts the date, dedupes and sorts. Removing a visit removes that one date. A place keeps at most one trip, as agreed in the design interview.
- **Deletion.** Deleting a photo removes its stored file and any block referencing it. Deleting a spot deletes its photos and their files. Deleting a city is refused while it has spots; a city without spots is deleted with its photos. Country unlock state already derives from the places present, so a country with no places locks again with no extra work.
- **Storage interface grows.** It adds update and delete for trips, places and photos, setting a place's story blocks, creating an upload target, and finalizing an upload into a stored photo. Both stores implement it.
- **Schema change (Supabase migration 0002).**
  - Places gain a story-blocks column (an ordered JSON array) that replaces the story text column.
  - Photos drop their sort order.
  - Existing rows are migrated: the story text becomes a single text block, followed by photo blocks in the old sort order.
  - The photos bucket gets an allowed-MIME-type list and a file size limit.
- **Local data migration.** The local JSON store and the seed file are upgraded on read. A place with the old story text and ordered photos is converted to blocks in the same way, so existing local data keeps working.
- **Admin UI.**
  - Each place in the admin list opens an edit view with the place's fields, visit dates, and a story arranger. The arranger lists blocks with move up, move down, insert text, split text at a paragraph, and remove.
  - Adding a city that already exists shows an "add a visit to …" action instead of an error.
  - Trips get the same edit and delete treatment.
- **Viewer pages.** No changes beyond rendering the resolved story and showing all visit dates.

## Testing Decisions

- **What a good test is.** It drives the system only through its public surface and asserts what the owner or a visitor would observe: a command's result, and what the journey read model shows afterwards. Tests don't reach into storage files, row shapes or private helpers, and don't assert how a result was computed.
- **The one seam.** The admin commands module, run against the real local JSON store in a temporary directory, with outcomes checked through the journey read model built from the store's data. Examples:
  - Adding a spot under a new parent city shows the city with the spot folded in, and the city isn't a stop on the spot's trip.
  - Adding an existing city returns the city-exists error with that city's id; adding a visit then shows both dates on the place and widens the country's date range.
  - Deleting a city with spots is refused; deleting the spots and then the city locks the country.
  - Inserting a photo between two text blocks makes the resolved story read text, photo, text.
  - Deleting a photo removes it from the resolved story.
  - Prepare, then send bytes to the local upload target, then confirm, yields a photo at the end of the resolved story. Confirming without the bytes returns upload-not-found, and a disallowed content type is rejected at prepare.
  - Deleting a trip removes it from trip stops while its places remain.
- **Read-model coverage.** The existing journey tests are extended for resolved stories, including dropping blocks with missing photos and appending unreferenced photos.
- **Migration coverage.** Upgrading old local data (story text plus ordered photos) is tested through the store's load, checking the resolved story that results.
- **Prior art.**
  - The local repository tests: a real store in a temporary directory, reopened between steps to prove persistence.
  - The journey and navigation tests: a shared fixture, with assertions on the read model.
  - TDD as in the scaffold: write the failing test first, and run a single test file while iterating.
- **Not unit tested.**
  - The Supabase store and its signed uploads. These are verified manually against a real Supabase project, following a checklist in the README.
  - React components and the globe engine. The admin editing flow and story rendering are verified in the running app, on desktop and a phone-sized viewport.

## Out of Scope

- Tagging one place to more than one trip, or tying individual visits to different trips.
- Rich text beyond paragraphs (headings, links, emphasis).
- Server-side image conversion or resizing, including converting HEIC for non-Apple browsers.
- An offline or background upload queue.
- Weaving photos into trip introductions.
- Route lines between a trip's stops.
- Sharper globe imagery when zoomed in.
- Login rate limiting and multiple admin users.
- Undo, edit history or soft delete.
- Reordering trips or countries on the landing page.

## Further Notes

- **Open question: trips on return visits.** A place still belongs to at most one trip, so returning to a city on a second trip can record the date but can't add the city to the second trip's story. If this bites in practice, the next model change is visits that each carry their own trip, which would replace the single trip on a place.
- **HEIC.** HEIC photos uploaded from browsers that can't decode them will show on Apple devices but may not show elsewhere. The admin should say so at upload time rather than failing silently.
- **Seen unlocks.** Per-browser unlock memory doesn't need changing. A country that relocks and is later unlocked again won't replay its dissolve for someone who has already seen it.
- **No glossary yet.** This spec uses the vocabulary in the code: journey, place, city, specific spot, trip, photo, story, country unlock, explore mode, story mode, store. Setting up a domain glossary would pin these down.
