create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$' or code ~ '^[A-F0-9]{8}$'),
  name text not null check (char_length(name) between 1 and 48),
  topic text not null default 'Untitled topic' check (char_length(topic) between 1 and 80),
  host_participant_id uuid,
  round_number integer not null default 1 check (round_number > 0),
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.rooms
  drop constraint if exists rooms_code_check;

alter table public.rooms
  add constraint rooms_code_check
  check (code ~ '^[A-F0-9]{6}$' or code ~ '^[A-F0-9]{8}$');

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  credential_hash text not null unique,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

alter table public.participants
  add column if not exists avatar_url text;

alter table public.participants
  drop constraint if exists participants_avatar_url_check;

alter table public.participants
  add constraint participants_avatar_url_check
  check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://[^[:space:]]+$'));

alter table public.rooms
  drop constraint if exists rooms_host_participant_id_fkey;

alter table public.rooms
  add constraint rooms_host_participant_id_fkey
  foreign key (host_participant_id) references public.participants(id) on delete set null;

create table if not exists public.votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  participant_id uuid not null references public.participants(id) on delete cascade,
  value text not null check (value in ('0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '?')),
  updated_at timestamptz not null default now(),
  primary key (room_id, round_number, participant_id)
);

create index if not exists participants_room_active_idx
  on public.participants(room_id, joined_at)
  where removed_at is null;

create table if not exists public.join_rate_limits (
  scope text not null check (scope in ('create', 'join')),
  key_hash text not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1,
  primary key (scope, key_hash)
);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.votes enable row level security;
alter table public.join_rate_limits enable row level security;

revoke all on public.rooms, public.participants, public.votes, public.join_rate_limits from public, anon, authenticated;
grant all on public.rooms, public.participants, public.votes, public.join_rate_limits to service_role;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  insert into public.join_rate_limits (scope, key_hash, window_started_at, attempt_count)
  values (p_scope, p_key, now(), 1)
  on conflict (scope, key_hash) do update
    set window_started_at = case
          when join_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
          else join_rate_limits.window_started_at
        end,
        attempt_count = case
          when join_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
          else join_rate_limits.attempt_count + 1
        end
  returning attempt_count <= p_limit into v_allowed;

  return v_allowed;
end;
$$;

create or replace function public.create_room(p_name text, p_topic text, p_credential_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
  v_code text;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 32 then
    raise exception 'invalid_room_name';
  end if;
  if p_topic is null or char_length(btrim(p_topic)) not between 1 and 80 then
    raise exception 'invalid_room_name';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, name, topic)
  values (v_code, btrim(p_name), btrim(p_topic))
  returning * into v_room;

  insert into public.participants (room_id, name, credential_hash)
  values (v_room.id, btrim(p_name), p_credential_hash)
  returning id into v_participant_id;

  update public.rooms
  set host_participant_id = v_participant_id
  where id = v_room.id;

  return jsonb_build_object(
    'roomId', v_room.id,
    'participantId', v_participant_id,
    'code', v_room.code
  );
end;
$$;

create or replace function public.join_room(
  p_room_id uuid,
  p_room_code text,
  p_name text,
  p_credential_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 32 then
    raise exception 'invalid_room_name';
  end if;

  select * into v_room
  from public.rooms r
  where (p_room_id is not null and r.id = p_room_id)
     or (p_room_id is null and p_room_code is not null and r.code = upper(p_room_code))
  for update;

  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;

  insert into public.participants (room_id, name, credential_hash)
  values (v_room.id, btrim(p_name), p_credential_hash)
  returning id into v_participant_id;

  update public.rooms set expires_at = now() + interval '7 days' where id = v_room.id;

  return jsonb_build_object(
    'roomId', v_room.id,
    'participantId', v_participant_id,
    'code', v_room.code
  );
end;
$$;

create or replace function public.get_room_snapshot(p_room_id uuid, p_credential_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
  v_members jsonb;
begin
  select * into v_room
  from public.rooms r
  where r.id = p_room_id;

  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;

  select p.id into v_participant_id
  from public.participants p
  where p.room_id = p_room_id
    and p.credential_hash = p_credential_hash
    and p.removed_at is null;

  if not found then return null; end if;

  update public.participants set last_seen_at = now()
  where id = v_participant_id;
  update public.rooms set expires_at = now() + interval '7 days'
  where id = p_room_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'avatarUrl', p.avatar_url,
        'isHost', p.id = v_room.host_participant_id,
        'hasVoted', v.participant_id is not null,
        'vote', case when v_room.revealed then v.value else null end
      ) order by p.joined_at, p.id
    ),
    '[]'::jsonb
  ) into v_members
  from public.participants p
  left join public.votes v
    on v.room_id = p.room_id
   and v.participant_id = p.id
   and v.round_number = v_room.round_number
  where p.room_id = p_room_id
    and p.removed_at is null;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'code', v_room.code,
      'name', v_room.name,
      'topic', v_room.topic,
      'hostParticipantId', v_room.host_participant_id,
      'round', v_room.round_number,
      'revealed', v_room.revealed,
      'expiresAt', v_room.expires_at
    ),
    'members', v_members,
    'currentParticipantId', v_participant_id,
    'myVote', (
      select v.value from public.votes v
      where v.room_id = p_room_id
        and v.round_number = v_room.round_number
        and v.participant_id = v_participant_id
    )
  );
end;
$$;

create or replace function public.submit_room_vote(
  p_room_id uuid,
  p_credential_hash text,
  p_value text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;
  if v_room.revealed then raise exception 'round_revealed'; end if;
  if p_value not in ('0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '?') then
    raise exception 'invalid_vote';
  end if;

  select id into v_participant_id from public.participants
  where room_id = p_room_id and credential_hash = p_credential_hash and removed_at is null;
  if not found then raise exception 'participant_not_found'; end if;

  insert into public.votes (room_id, round_number, participant_id, value)
  values (p_room_id, v_room.round_number, v_participant_id, p_value)
  on conflict (room_id, round_number, participant_id)
  do update set value = excluded.value, updated_at = now();

  update public.rooms set expires_at = now() + interval '7 days' where id = p_room_id;
  return true;
end;
$$;

create or replace function public.set_participant_avatar(
  p_room_id uuid,
  p_credential_hash text,
  p_avatar_url text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_avatar text;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;

  v_avatar := nullif(btrim(coalesce(p_avatar_url, '')), '');
  if v_avatar is not null and (char_length(v_avatar) > 500 or v_avatar !~ '^https://[^[:space:]]+$') then
    raise exception 'invalid_avatar';
  end if;

  update public.participants
  set avatar_url = v_avatar
  where room_id = p_room_id
    and credential_hash = p_credential_hash
    and removed_at is null;
  if not found then raise exception 'participant_not_found'; end if;

  return true;
end;
$$;

create or replace function public.perform_room_action(
  p_room_id uuid,
  p_credential_hash text,
  p_action text,
  p_value text default null,
  p_target_participant_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_actor_id uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;

  select id into v_actor_id from public.participants
  where room_id = p_room_id
    and id = v_room.host_participant_id
    and credential_hash = p_credential_hash
    and removed_at is null;
  if not found then raise exception 'host_required'; end if;

  if p_action = 'reveal' then
    update public.rooms set revealed = true where id = p_room_id;
  elsif p_action = 'clear' then
    delete from public.votes where room_id = p_room_id;
    update public.rooms
    set round_number = round_number + 1, revealed = false
    where id = p_room_id;
  elsif p_action in ('rename_room', 'rename_topic') then
    if p_value is null or char_length(btrim(p_value)) not between 1 and 80 then
      raise exception 'invalid_room_name';
    end if;
    if p_action = 'rename_room' then
      if char_length(btrim(p_value)) > 48 then raise exception 'invalid_room_name'; end if;
      update public.rooms set name = btrim(p_value) where id = p_room_id;
    else
      update public.rooms set topic = btrim(p_value) where id = p_room_id;
    end if;
  elsif p_action = 'transfer_host' then
    if p_target_participant_id is null or p_target_participant_id = v_actor_id then
      raise exception 'target_not_found';
    end if;
    perform 1 from public.participants
    where id = p_target_participant_id and room_id = p_room_id and removed_at is null;
    if not found then raise exception 'target_not_found'; end if;
    update public.rooms set host_participant_id = p_target_participant_id where id = p_room_id;
  elsif p_action = 'remove_member' then
    if p_target_participant_id is null or p_target_participant_id = v_actor_id then
      raise exception 'target_not_found';
    end if;
    update public.participants
    set removed_at = now()
    where id = p_target_participant_id
      and room_id = p_room_id
      and removed_at is null
      and id <> v_room.host_participant_id;
    if not found then raise exception 'target_not_found'; end if;
    delete from public.votes where room_id = p_room_id and participant_id = p_target_participant_id;
  else
    raise exception 'invalid_action';
  end if;

  update public.rooms set expires_at = now() + interval '7 days' where id = p_room_id;
  return true;
end;
$$;

create or replace function public.leave_room(p_room_id uuid, p_credential_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then raise exception 'room_not_found'; end if;

  select id into v_participant_id
  from public.participants
  where room_id = p_room_id
    and credential_hash = p_credential_hash
    and removed_at is null;

  if not found then raise exception 'participant_not_found'; end if;

  if v_participant_id = v_room.host_participant_id then
    update public.rooms set host_participant_id = null where id = p_room_id;
    delete from public.rooms where id = p_room_id;
    return true;
  end if;

  delete from public.votes
  where room_id = p_room_id and participant_id = v_participant_id;

  update public.participants
  set removed_at = now()
  where id = v_participant_id;

  return false;
end;
$$;

create or replace function public.delete_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.rooms where expires_at <= now();
  get diagnostics v_deleted = row_count;
  delete from public.join_rate_limits where window_started_at < now() - interval '1 day';
  return v_deleted;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_room(text, text, text) from public, anon, authenticated;
revoke execute on function public.join_room(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_room_snapshot(uuid, text) from public, anon, authenticated;
revoke execute on function public.submit_room_vote(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.set_participant_avatar(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.perform_room_action(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.leave_room(uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_expired_rooms() from public, anon, authenticated;

grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.create_room(text, text, text) to service_role;
grant execute on function public.join_room(uuid, text, text, text) to service_role;
grant execute on function public.get_room_snapshot(uuid, text) to service_role;
grant execute on function public.submit_room_vote(uuid, text, text) to service_role;
grant execute on function public.set_participant_avatar(uuid, text, text) to service_role;
grant execute on function public.perform_room_action(uuid, text, text, text, uuid) to service_role;
grant execute on function public.leave_room(uuid, text) to service_role;
grant execute on function public.delete_expired_rooms() to service_role;
