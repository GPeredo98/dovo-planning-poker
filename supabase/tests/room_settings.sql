-- Run after schema.sql against a disposable database.
begin;

do $$
declare
  settings jsonb := '{"allowVoteChanges":true,"allowReactions":false,"voteScale":"fibonacci"}';
  shirts jsonb := '{"allowVoteChanges":false,"allowReactions":true,"voteScale":"shirts"}';
  numbers jsonb := '{"allowVoteChanges":true,"allowReactions":false,"voteScale":"numbers"}';
  v_room_id uuid;
  snapshot jsonb;
  host_member jsonb;
begin
  insert into public.rooms (code, name, topic)
  values ('ABC123', 'Default settings test', 'Topic')
  returning id into v_room_id;
  if exists (
    select 1 from public.rooms r
    where r.id = v_room_id and (
      r.settings <> '{"allowVoteChanges":true,"allowReactions":true,"voteScale":"fibonacci"}'::jsonb
      or r.round_settings <> '{"allowVoteChanges":true,"allowReactions":true,"voteScale":"fibonacci"}'::jsonb
    )
  ) then raise exception 'incorrect room defaults'; end if;
  delete from public.rooms where id = v_room_id;

  v_room_id := (public.create_room('Host', 'Topic', 'host-test', settings)->>'roomId')::uuid;
  perform public.join_room(v_room_id, null, 'Guest', 'guest-test');
  perform public.submit_room_vote(v_room_id, 'host-test', '3');
  perform public.submit_room_vote(v_room_id, 'guest-test', '5');
  snapshot := public.get_room_snapshot(v_room_id, 'guest-test');
  if exists (select 1 from jsonb_array_elements(snapshot->'members') member where member->'vote' <> 'null'::jsonb) then
    raise exception 'hidden vote leaked';
  end if;

  begin
    perform public.update_room_settings(v_room_id, 'guest-test', shirts);
    raise exception 'non-host changed settings';
  exception when others then
    if sqlerrm <> 'host_required' then raise; end if;
  end;
  perform public.update_room_settings(v_room_id, 'host-test', shirts);
  if exists (select 1 from public.votes where votes.room_id = v_room_id) then
    raise exception 'scale change did not clear hidden votes';
  end if;
  begin
    perform public.submit_room_vote(v_room_id, 'guest-test', '3');
    raise exception 'old scale accepted';
  exception when others then
    if sqlerrm <> 'invalid_vote' then raise; end if;
  end;
  perform public.submit_room_vote(v_room_id, 'host-test', 'M');
  perform public.perform_room_action(v_room_id, 'host-test', 'reveal');
  perform public.update_room_settings(v_room_id, 'host-test', numbers);
  snapshot := public.get_room_snapshot(v_room_id, 'host-test');
  if snapshot->'room'->'settings'->>'voteScale' <> 'numbers'
     or snapshot->'room'->'roundSettings'->>'voteScale' <> 'shirts' then
    raise exception 'revealed-round settings changed early';
  end if;
  begin
    perform public.submit_room_vote(v_room_id, 'host-test', 'L');
    raise exception 'disabled adjustment accepted';
  exception when others then
    if sqlerrm <> 'round_revealed' then raise; end if;
  end;
  perform public.perform_room_action(v_room_id, 'host-test', 'clear');
  snapshot := public.get_room_snapshot(v_room_id, 'host-test');
  if snapshot->'room'->'roundSettings'->>'voteScale' <> 'numbers' then
    raise exception 'pending settings not applied';
  end if;
  perform public.submit_room_vote(v_room_id, 'host-test', '3');
  perform public.perform_room_action(v_room_id, 'host-test', 'reveal');
  perform public.submit_room_vote(v_room_id, 'host-test', '4');
  snapshot := public.get_room_snapshot(v_room_id, 'guest-test');
  select member into host_member from jsonb_array_elements(snapshot->'members') member where (member->>'isHost')::boolean;
  if host_member->>'vote' <> '4' or host_member->>'originalVote' <> '3' then
    raise exception 'changed and original votes not visible';
  end if;
  begin
    perform public.submit_room_vote(v_room_id, 'host-test', '5');
    raise exception 'two-step adjustment accepted';
  exception when others then
    if sqlerrm <> 'invalid_vote' then raise; end if;
  end;
  begin
    perform public.submit_room_vote(v_room_id, 'guest-test', '3');
    raise exception 'new vote after reveal accepted';
  exception when others then
    if sqlerrm <> 'invalid_vote' then raise; end if;
  end;
  perform public.submit_room_vote(v_room_id, 'host-test', '2');
  snapshot := public.get_room_snapshot(v_room_id, 'guest-test');
  select member into host_member from jsonb_array_elements(snapshot->'members') member where (member->>'isHost')::boolean;
  if host_member->>'vote' <> '2' or host_member->>'originalVote' <> '3' then
    raise exception 'downward adjustment failed';
  end if;
  perform public.submit_room_vote(v_room_id, 'host-test', '3');
  snapshot := public.get_room_snapshot(v_room_id, 'guest-test');
  select member into host_member from jsonb_array_elements(snapshot->'members') member where (member->>'isHost')::boolean;
  if host_member->'originalVote' <> 'null'::jsonb then
    raise exception 'original indicator remained after reverting';
  end if;
  perform public.perform_room_action(v_room_id, 'host-test', 'clear');
  perform public.submit_room_vote(v_room_id, 'host-test', '?');
  perform public.perform_room_action(v_room_id, 'host-test', 'reveal');
  perform public.submit_room_vote(v_room_id, 'host-test', '10');
  begin
    perform public.submit_room_vote(v_room_id, 'host-test', '9');
    raise exception 'boundary adjustment exceeded one step';
  exception when others then
    if sqlerrm <> 'invalid_vote' then raise; end if;
  end;
  begin
    perform public.update_room_settings(v_room_id, 'host-test', '{"allowVoteChanges":true,"allowReactions":"yes","voteScale":"numbers"}');
    raise exception 'invalid settings accepted';
  exception when others then
    if sqlerrm <> 'invalid_settings' then raise; end if;
  end;
end;
$$;

rollback;
