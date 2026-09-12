-- Shared contract for the installed events CHECKs and the form declarations.
-- Vitest reads the tagged JSON below without requiring a running database.
-- PostgreSQL builds the expected CHECKs itself so quoting and normalization
-- follow the same rules as the effective schema after every migration.

begin;

select plan(1);

create temporary table expected_events_checks (
  label text,
  description text,
  icon text
);

do $$
declare
  contract jsonb := $events_validation_contract$
  {
    "labelMaxLength": 100,
    "descriptionMaxLength": 500,
    "icons": ["ring", "plane", "calendar"]
  }
  $events_validation_contract$::jsonb;
  icon_literals text;
begin
  -- %L quotes each complete string, including punctuation, quotes and escapes.
  -- Preserve contract order because PostgreSQL's normalized IN array does too.
  select string_agg(format('%L', value), ', ' order by position)
    into icon_literals
    from jsonb_array_elements_text(contract -> 'icons') with ordinality
      as icons(value, position);

  execute format(
    'alter table pg_temp.expected_events_checks
       add check (char_length(label) <= %s),
       add check (char_length(description) <= %s),
       add check (icon in (%s))',
    (contract ->> 'labelMaxLength')::integer,
    (contract ->> 'descriptionMaxLength')::integer,
    icon_literals
  );
end;
$$;

-- Compare every CHECK, including duplicate definitions, without filtering by
-- constraint name. An added, dropped or replaced CHECK must change this array.
-- is() prints both complete definition arrays when the effective schema drifts.
select is(
  (select array_agg(pg_get_constraintdef(oid) order by pg_get_constraintdef(oid))
     from pg_constraint
    where conrelid = 'public.events'::regclass and contype = 'c'),
  (select array_agg(pg_get_constraintdef(oid) order by pg_get_constraintdef(oid))
     from pg_constraint
    where conrelid = 'pg_temp.expected_events_checks'::regclass and contype = 'c'),
  'EV-DB-037: all installed events CHECK definitions match the shared validation contract'
);

select * from finish();

rollback;
