-- Run once in Supabase SQL Editor. No service-role key is used by BOLET.
create table if not exists public.bolet_records (
  user_id uuid not null references auth.users(id),
  entity_type text not null check (entity_type in ('decks','cards','prefs','events','history','sessions','activity')),
  entity_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);
alter table public.bolet_records enable row level security;
drop policy if exists "Read own BOLET records" on public.bolet_records;
create policy "Read own BOLET records" on public.bolet_records for select to authenticated using ((select auth.uid()) = user_id);
-- Mutations go through the checked merge function, never a raw last-writer upsert.
revoke all on public.bolet_records from anon, authenticated;
grant select on public.bolet_records to authenticated;

create or replace function public.bolet_merge_record(incoming jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  kind text := incoming->>'entityType';
  eid text := incoming->>'entityId';
  old jsonb;
  merged jsonb;
  fields jsonb;
  versions jsonb;
  k text;
  v jsonb;
  parent_id text;
  must_purge boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if kind not in ('decks','cards','prefs','events','history','sessions','activity') or eid is null or length(eid) = 0
    or jsonb_typeof(incoming->'fields') is distinct from 'object'
    or jsonb_typeof(incoming->'versions') is distinct from 'object' then
    raise exception 'Invalid BOLET envelope';
  end if;
  -- Serialize merges for this account, including parent deletion and child writes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select payload into old from public.bolet_records where user_id = uid and entity_type = kind and entity_id = eid;
  parent_id := incoming->'fields'->'deckId'->>'value';
  must_purge := coalesce((old->>'purged')::boolean, false) or coalesce((incoming->>'purged')::boolean, false);
  if kind in ('cards','events','history','sessions') and exists (
    select 1 from public.bolet_records where user_id = uid and entity_type = 'decks' and entity_id = parent_id and payload->>'purged' = 'true'
  ) then must_purge := true; end if;
  if must_purge then
    merged := jsonb_build_object('entityType',kind,'entityId',eid,'fields','{}'::jsonb,'versions','{}'::jsonb,'purged',true);
  else
    fields := coalesce(old->'fields', '{}'::jsonb);
    versions := coalesce(old->'versions', '{}'::jsonb);
    for k,v in select * from jsonb_each(incoming->'fields') loop
      if jsonb_typeof(v) is distinct from 'object' or v->>'stamp' is null or not (v ? 'value') then raise exception 'Invalid field'; end if;
      if not (fields ? k) or (v->>'stamp') collate "C" > (fields->k->>'stamp') collate "C"
        or ((v->>'stamp') = (fields->k->>'stamp') and (v->'value')::text collate "C" > (fields->k->'value')::text collate "C") then
        fields := jsonb_set(fields, array[k], v);
      end if;
    end loop;
    for k,v in select * from jsonb_each(incoming->'versions') loop
      versions := jsonb_set(versions, array[k], coalesce(versions->k, '{}'::jsonb) || v);
    end loop;
    merged := jsonb_build_object('entityType',kind,'entityId',eid,'fields',fields,'versions',versions);
  end if;
  insert into public.bolet_records(user_id, entity_type, entity_id, payload)
    values(uid,kind,eid,merged)
    on conflict(user_id,entity_type,entity_id) do update set payload = excluded.payload, updated_at = now();
  if kind = 'decks' and must_purge then
    update public.bolet_records set payload = jsonb_build_object('entityType',entity_type,'entityId',entity_id,'fields','{}'::jsonb,'versions','{}'::jsonb,'purged',true), updated_at = now()
      where user_id = uid and entity_type in ('cards','events','history','sessions') and payload->'fields'->'deckId'->>'value' = eid;
  end if;
  return merged;
end;
$$;
revoke all on function public.bolet_merge_record(jsonb) from public, anon;
grant execute on function public.bolet_merge_record(jsonb) to authenticated;
