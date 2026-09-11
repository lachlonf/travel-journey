-- A place's story becomes an ordered list of text and photo blocks.
-- Photos lose their sort order: a photo's position is where its block sits.
-- One transaction, so a failure can't drop the old columns before every row is converted.
begin;

alter table places
  add column story_blocks jsonb not null default '[]'
  check (jsonb_typeof(story_blocks) = 'array');

-- Existing places read the same as before: the old story text as one text block,
-- followed by the place's photos in their old sort order.
update places
set story_blocks =
  case when story ~ '^\s*$' then '[]'::jsonb
       else jsonb_build_array(jsonb_build_object('type', 'text', 'text', story))
  end
  || coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('type', 'photo', 'photoId', photos.id)
        order by photos.sort_order, photos.created_at, photos.id
      )
      from photos
      where photos.place_id = places.id
    ),
    '[]'::jsonb
  );

alter table places drop column story;
alter table photos drop column sort_order;

commit;
