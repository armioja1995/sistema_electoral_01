-- =====================================================================
-- MIGRACIÓN: los registradores pueden registrar actas en TODAS las mesas
-- (ya no se exige que la mesa esté asignada a su usuario).
-- Ejecutar una vez en Supabase > SQL Editor. Es idempotente.
-- =====================================================================

create or replace function public.save_table_result(
  p_table_id     uuid,
  p_votes        jsonb,
  p_null_votes   integer,
  p_blank_votes  integer,
  p_votes_cast   integer,
  p_finalize     boolean default false,
  p_observation  text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_role      public.user_role := public.current_user_role();
  v_table     public.polling_tables%rowtype;
  v_election  public.elections%rowtype;
  v_result    public.table_results%rowtype;
  v_old       jsonb;
  v_existing  boolean;
  v_valid     bigint := 0;
  v_item      jsonb;
  v_cid       uuid;
  v_n         bigint;
  v_status    public.table_status;
  v_obs       text := nullif(btrim(coalesce(p_observation, '')), '');
  v_action    text;
  v_total     bigint;
begin
  if v_uid is null or v_role is null then
    raise exception 'No autorizado: inicie sesión con un usuario activo.' using errcode = '42501';
  end if;
  if v_role = 'consulta' then
    raise exception 'Su rol (consulta) no permite registrar resultados.' using errcode = '42501';
  end if;

  select * into v_table from public.polling_tables where id = p_table_id for update;
  if not found then
    raise exception 'La mesa indicada no existe.' using errcode = 'P0002';
  end if;
  select * into v_election from public.elections where id = v_table.election_id;

  if v_election.status = 'finalizado' then
    raise exception 'El proceso electoral está finalizado; no se admiten cambios.' using errcode = 'P0001';
  end if;

  -- El registrador puede registrar cualquier mesa del proceso (assigned_to es solo referencial).
  if v_role = 'registrador' then
    if v_election.status <> 'en_proceso' then
      raise exception 'El registro de resultados no está habilitado: el proceso electoral no está "En proceso".' using errcode = 'P0001';
    end if;
    if v_table.status in ('registrada','observada','validada') then
      raise exception 'El acta de esta mesa ya fue cerrada. Solo un administrador puede modificarla.' using errcode = '42501';
    end if;
  end if;

  -- Validaciones numéricas
  if p_null_votes is null or p_blank_votes is null or p_votes_cast is null then
    raise exception 'Complete votos nulos, votos en blanco y total de votos emitidos.' using errcode = 'P0001';
  end if;
  if p_null_votes < 0 or p_blank_votes < 0 or p_votes_cast < 0 then
    raise exception 'Los votos no pueden ser negativos.' using errcode = 'P0001';
  end if;
  if p_votes is null or jsonb_typeof(p_votes) <> 'array' then
    raise exception 'Formato de votos por candidato inválido.' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_votes) loop
    if jsonb_typeof(v_item->'votes') <> 'number'
       or (v_item->>'votes') !~ '^[0-9]+$' then
      raise exception 'Los votos por candidato deben ser números enteros no negativos.' using errcode = 'P0001';
    end if;
    begin
      v_cid := (v_item->>'candidate_id')::uuid;
    exception when others then
      raise exception 'Identificador de candidato inválido.' using errcode = 'P0001';
    end;
    v_n := (v_item->>'votes')::bigint;
    if v_n > 100000 then
      raise exception 'Cantidad de votos fuera de rango.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.candidates
                   where id = v_cid and election_id = v_table.election_id) then
      raise exception 'Uno de los candidatos no pertenece a esta elección.' using errcode = 'P0001';
    end if;
    v_valid := v_valid + v_n;
  end loop;

  if (select count(*) from jsonb_array_elements(p_votes))
     <> (select count(distinct e->>'candidate_id') from jsonb_array_elements(p_votes) e) then
    raise exception 'Hay candidatos repetidos en el registro.' using errcode = 'P0001';
  end if;

  v_total := v_valid + p_null_votes + p_blank_votes;

  if p_finalize then
    if v_table.registered_voters <= 0 then
      raise exception 'La mesa no tiene electores habilitados registrados. Regístrelos antes de cerrar el acta.' using errcode = 'P0001';
    end if;
    if v_total = p_votes_cast and p_votes_cast <= v_table.registered_voters then
      v_status := 'registrada';
      if v_role <> 'administrador' then v_obs := null; end if;
    elsif v_role = 'administrador' and v_obs is not null then
      v_status := 'observada';
    elsif p_votes_cast > v_table.registered_voters then
      raise exception 'Los votos emitidos (%) superan el número de electores habilitados (%).', p_votes_cast, v_table.registered_voters using errcode = 'P0001';
    else
      raise exception 'La suma de votos válidos, nulos y blancos (%) no coincide con el total de votos emitidos (%).', v_total, p_votes_cast using errcode = 'P0001';
    end if;
  else
    v_status := 'en_registro';
    if greatest(v_total, p_votes_cast) > v_table.registered_voters and v_table.registered_voters > 0 then
      raise exception 'Los votos registrados superan el número de electores habilitados (%).', v_table.registered_voters using errcode = 'P0001';
    end if;
    v_obs := case when v_role = 'administrador' then v_obs else null end;
  end if;

  perform set_config('app.skip_audit', 'on', true);
  perform set_config('app.allow_status', 'on', true);

  select * into v_result from public.table_results where polling_table_id = p_table_id;
  v_existing := found;

  if not v_existing then
    insert into public.table_results (
      polling_table_id, election_id, registered_voters, votes_cast, valid_votes, null_votes, blank_votes,
      is_final, observation, registered_by, registered_at, finalized_by, finalized_at)
    values (
      p_table_id, v_table.election_id, v_table.registered_voters, p_votes_cast, v_valid, p_null_votes, p_blank_votes,
      p_finalize, v_obs, v_uid, now(),
      case when p_finalize then v_uid end, case when p_finalize then now() end)
    returning * into v_result;
    v_action := case when v_status = 'observada' then 'registrar_acta_observada'
                     when p_finalize then 'registrar_acta' else 'guardar_borrador' end;
  else
    v_old := jsonb_build_object(
      'estado', v_table.status, 'votos_emitidos', v_result.votes_cast, 'validos', v_result.valid_votes,
      'nulos', v_result.null_votes, 'blancos', v_result.blank_votes,
      'votos_candidatos', (select coalesce(jsonb_agg(jsonb_build_object('candidate_id', candidate_id, 'votes', votes)), '[]'::jsonb)
                           from public.candidate_votes where table_result_id = v_result.id));
    update public.table_results set
      registered_voters = v_table.registered_voters,
      votes_cast = p_votes_cast, valid_votes = v_valid,
      null_votes = p_null_votes, blank_votes = p_blank_votes,
      is_final = p_finalize, observation = v_obs,
      updated_by = v_uid, updated_at = now(),
      finalized_by = case when p_finalize then v_uid end,
      finalized_at = case when p_finalize then coalesce(case when v_result.is_final then v_result.finalized_at end, now()) end
    where id = v_result.id
    returning * into v_result;
    v_action := case
      when v_table.status in ('registrada','observada','validada') then 'modificar_acta'
      when p_finalize then 'registrar_acta'
      else 'guardar_borrador' end;
  end if;

  delete from public.candidate_votes where table_result_id = v_result.id;
  insert into public.candidate_votes (table_result_id, candidate_id, votes)
  select v_result.id, (e->>'candidate_id')::uuid, (e->>'votes')::int
    from jsonb_array_elements(p_votes) e;

  update public.polling_tables set status = v_status where id = p_table_id;

  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (v_uid, v_action, 'table_results', v_result.id, jsonb_build_object(
    'mesa', v_table.code, 'polling_table_id', v_table.id, 'estado', v_status,
    'anterior', v_old,
    'nuevo', jsonb_build_object('votos_emitidos', p_votes_cast, 'validos', v_valid,
      'nulos', p_null_votes, 'blancos', p_blank_votes, 'votos_candidatos', p_votes),
    'observacion', v_obs));

  perform set_config('app.skip_audit', 'off', true);
  perform set_config('app.allow_status', 'off', true);

  return jsonb_build_object('result_id', v_result.id, 'status', v_status);
end $$;
