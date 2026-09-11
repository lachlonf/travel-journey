create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  story text not null default '',
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('city', 'poi')),
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  country_code char(2) not null,
  parent_id uuid references places (id) on delete set null,
  trip_id uuid references trips (id) on delete set null,
  visited_on date[] not null default '{}',
  story text not null default '',
  created_at timestamptz not null default now(),
  -- Only specific spots (POIs) collapse into a parent city.
  check (kind = 'poi' or parent_id is null)
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places (id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  taken_at date,
  lat double precision,
  lng double precision,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index places_parent_id_idx on places (parent_id);
create index places_trip_id_idx on places (trip_id);
create index photos_place_id_idx on photos (place_id);

-- The site only talks to the database from the server, with the service role key.
-- RLS with no policies shuts the public API out completely.
alter table trips enable row level security;
alter table places enable row level security;
alter table photos enable row level security;

-- Photos are served straight from storage; paths are unguessable UUIDs.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
