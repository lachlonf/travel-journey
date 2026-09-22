-- The glossary calls a specific place inside a city a "spot", so the stored kind says so too.
-- Nothing else changes: the same rows, the same parents, the same stories.
-- One transaction, so the constraints can never be off while rows still say 'poi'.
begin;

-- Both checks name 'poi', so they have to go before the rows can be rewritten. Dropped by
-- definition rather than by name: 0001 left them unnamed, and Postgres' generated names are
-- not worth trusting a migration to.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'places'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%poi%'
  loop
    execute format('alter table places drop constraint %I', c.conname);
  end loop;
end
$$;

update places set kind = 'spot' where kind = 'poi';

alter table places
  add constraint places_kind_check check (kind in ('city', 'spot')),
  -- Only spots collapse into a parent city.
  add constraint places_parent_only_for_spots check (kind = 'spot' or parent_id is null);

commit;
