-- Reassign scores from one player to another by display name.
-- Aborts without changes if both players have a score for the same outing.

create or replace function thegolfapp.merge_scores(
  p_society_id text,
  p_from_player_name text,
  p_to_player_name text
)
returns jsonb
language plpgsql
security definer
set search_path = thegolfapp
as $$
declare
  v_from_id text;
  v_to_id text;
  v_from_count int;
  v_to_count int;
  v_conflicts jsonb;
  v_moved int;
begin
  p_society_id := lower(trim(coalesce(p_society_id, '')));
  p_from_player_name := trim(coalesce(p_from_player_name, ''));
  p_to_player_name := trim(coalesce(p_to_player_name, ''));

  if p_society_id = '' then
    return jsonb_build_object('success', false, 'error', 'societyId is required');
  end if;
  if p_from_player_name = '' or p_to_player_name = '' then
    return jsonb_build_object('success', false, 'error', 'fromPlayer and toPlayer are required');
  end if;
  if lower(p_from_player_name) = lower(p_to_player_name) then
    return jsonb_build_object('success', false, 'error', 'From and To player are the same');
  end if;

  select count(*) into v_from_count
  from thegolfapp.players
  where society_id = p_society_id
    and lower(trim(player_name)) = lower(p_from_player_name);

  if v_from_count = 0 then
    return jsonb_build_object(
      'success', false,
      'error', format('From player not found: %s', p_from_player_name)
    );
  end if;
  if v_from_count > 1 then
    return jsonb_build_object(
      'success', false,
      'error', format('Multiple players named "%s" in society %s', p_from_player_name, p_society_id)
    );
  end if;

  select count(*) into v_to_count
  from thegolfapp.players
  where society_id = p_society_id
    and lower(trim(player_name)) = lower(p_to_player_name);

  if v_to_count = 0 then
    return jsonb_build_object(
      'success', false,
      'error', format('To player not found: %s', p_to_player_name)
    );
  end if;
  if v_to_count > 1 then
    return jsonb_build_object(
      'success', false,
      'error', format('Multiple players named "%s" in society %s', p_to_player_name, p_society_id)
    );
  end if;

  select player_id into v_from_id
  from thegolfapp.players
  where society_id = p_society_id
    and lower(trim(player_name)) = lower(p_from_player_name);

  select player_id into v_to_id
  from thegolfapp.players
  where society_id = p_society_id
    and lower(trim(player_name)) = lower(p_to_player_name);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'outingId', f.outing_id,
      'outingDate', o.outing_date,
      'courseName', o.course_name,
      'fromTotalPoints', f.total_points,
      'toTotalPoints', t.total_points
    )
    order by o.outing_date, o.course_name
  ), '[]'::jsonb)
  into v_conflicts
  from thegolfapp.scores f
  join thegolfapp.scores t
    on t.society_id = f.society_id
   and t.outing_id = f.outing_id
  left join thegolfapp.outings o
    on o.society_id = f.society_id
   and o.outing_id = f.outing_id
  where f.society_id = p_society_id
    and f.player_id = v_from_id
    and t.player_id = v_to_id;

  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Cannot merge scores: both players have scores for the same outing(s). Delete or reassign one score per outing first.',
      'conflicts', v_conflicts,
      'fromPlayer', p_from_player_name,
      'toPlayer', p_to_player_name
    );
  end if;

  update thegolfapp.scores
  set player_id = v_to_id,
      updated_at = now()
  where society_id = p_society_id
    and player_id = v_from_id;

  get diagnostics v_moved = row_count;

  return jsonb_build_object(
    'success', true,
    'message', format(
      'Moved %s score(s) from "%s" to "%s"',
      v_moved, p_from_player_name, p_to_player_name
    ),
    'scoresMoved', v_moved,
    'fromPlayer', p_from_player_name,
    'toPlayer', p_to_player_name,
    'fromPlayerId', v_from_id,
    'toPlayerId', v_to_id
  );
end;
$$;

comment on function thegolfapp.merge_scores(text, text, text) is
  'Reassign all scores from from-player to to-player by display name. Aborts with conflicts if both have a score for the same outing.';
