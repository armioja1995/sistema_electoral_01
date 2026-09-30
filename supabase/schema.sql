-- =====================================================================
-- SISTEMA DE REGISTRO Y SEGUIMIENTO DE RESULTADOS ELECTORALES
-- Esquema completo para Supabase (PostgreSQL 15+)
-- Ejecutar UNA vez en: Supabase Dashboard > SQL Editor > New query
-- Es idempotente en tipos/funciones/políticas salvo las tablas (create if not exists).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TIPOS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('administrador','registrador','consulta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.election_status as enum ('configuracion','en_proceso','finalizado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.table_status as enum ('pendiente','en_registro','registrada','observada','validada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. TABLAS
-- ---------------------------------------------------------------------

-- Perfiles (1:1 con auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 80),
  last_name   text not null default '' check (char_length(last_name) <= 80),
  email       text not null check (char_length(email) <= 254),
  role        public.user_role not null default 'consulta',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Proceso electoral. Una elección = una contienda (un cargo en disputa).
create table if not exists public.elections (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 3 and 150),
  description    text check (description is null or char_length(description) <= 1000),
  election_date  date not null,
  position       text not null default 'Alcalde' check (char_length(btrim(position)) between 2 and 100),
  status         public.election_status not null default 'configuracion',
  is_active      boolean not null default false,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists elections_name_uq on public.elections (lower(btrim(name)));
-- Solo una elección activa a la vez (la que se muestra en el sistema)
create unique index if not exists elections_one_active on public.elections (is_active) where is_active;

-- Locales de votación
create table if not exists public.polling_places (
  id           uuid primary key default gen_random_uuid(),
  election_id  uuid not null references public.elections(id) on delete cascade,
  code         text not null check (code ~ '^[A-Za-z0-9_-]{1,20}$'),
  name         text not null check (char_length(btrim(name)) between 2 and 200),
  address      text check (address is null or char_length(address) <= 300),
  district     text not null default '' check (char_length(district) <= 100),
  province     text not null default '' check (char_length(province) <= 100),
  department   text not null default '' check (char_length(department) <= 100),
  reference    text check (reference is null or char_length(reference) <= 300),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint polling_places_code_uq unique (election_id, code)
);
create unique index if not exists polling_places_name_uq
  on public.polling_places (election_id, lower(btrim(name)), lower(district));
create index if not exists polling_places_location_idx
  on public.polling_places (election_id, department, province, district);

-- Mesas de votación
create table if not exists public.polling_tables (
  id                 uuid primary key default gen_random_uuid(),
  election_id        uuid not null references public.elections(id) on delete cascade,
  polling_place_id   uuid not null references public.polling_places(id) on delete cascade,
  code               text not null check (code ~ '^[A-Za-z0-9_-]{1,20}$'),
  registered_voters  integer not null default 0 check (registered_voters between 0 and 100000),
  status             public.table_status not null default 'pendiente',
  assigned_to        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint polling_tables_code_uq unique (election_id, code)
);
create index if not exists polling_tables_place_idx    on public.polling_tables (polling_place_id);
create index if not exists polling_tables_status_idx   on public.polling_tables (election_id, status);
create index if not exists polling_tables_assigned_idx on public.polling_tables (assigned_to);

-- Partidos políticos
create table if not exists public.political_parties (
  id           uuid primary key default gen_random_uuid(),
  election_id  uuid not null references public.elections(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 150),
  acronym      text not null check (char_length(btrim(acronym)) between 1 and 20),
  color        text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url     text check (logo_url is null or logo_url ~ '^https://'),
  list_number  integer check (list_number is null or list_number between 1 and 999),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists parties_acronym_uq on public.political_parties (election_id, lower(btrim(acronym)));
create unique index if not exists parties_name_uq    on public.political_parties (election_id, lower(btrim(name)));
create unique index if not exists parties_number_uq  on public.political_parties (election_id, list_number) where list_number is not null;

-- Candidatos
create table if not exists public.candidates (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null references public.elections(id) on delete cascade,
  party_id          uuid not null references public.political_parties(id) on delete cascade,
  full_name         text not null check (char_length(btrim(full_name)) between 3 and 200),
  candidate_number  integer check (candidate_number is null or candidate_number between 1 and 999),
  position          text not null check (char_length(btrim(position)) between 2 and 100),
  photo_url         text check (photo_url is null or photo_url ~ '^https://'),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists candidates_name_uq
  on public.candidates (election_id, lower(btrim(position)), lower(btrim(full_name)));
create unique index if not exists candidates_number_uq
  on public.candidates (election_id, lower(btrim(position)), candidate_number) where candidate_number is not null;
create index if not exists candidates_party_idx on public.candidates (party_id);

-- Resultado (acta) por mesa. Solo se escribe mediante la función save_table_result().
create table if not exists public.table_results (
  id                 uuid primary key default gen_random_uuid(),
  polling_table_id   uuid not null unique references public.polling_tables(id) on delete cascade,
  election_id        uuid not null references public.elections(id) on delete cascade,
  registered_voters  integer not null check (registered_voters >= 0),  -- copia al momento del registro
  votes_cast         integer not null default 0 check (votes_cast >= 0),  -- total de votantes según acta
  valid_votes        integer not null default 0 check (valid_votes >= 0), -- = suma de votos por candidato
  null_votes         integer not null default 0 check (null_votes >= 0),
  blank_votes        integer not null default 0 check (blank_votes >= 0),
  did_not_vote       integer generated always as (registered_voters - votes_cast) stored,
  is_final           boolean not null default false,
  observation        text check (observation is null or char_length(observation) <= 1000),
  registered_by      uuid references public.profiles(id) on delete set null,
  registered_at      timestamptz not null default now(),
  updated_by         uuid references public.profiles(id) on delete set null,
  updated_at         timestamptz,
  finalized_by       uuid references public.profiles(id) on delete set null,
  finalized_at       timestamptz,
  -- Un acta cerrada debe cuadrar, salvo que un administrador haya registrado una observación
  constraint table_results_consistency check (
    not is_final
    or observation is not null
    or (valid_votes + null_votes + blank_votes = votes_cast and votes_cast <= registered_voters)
  )
);
create index if not exists table_results_election_idx on public.table_results (election_id, finalized_at);

-- Votos por candidato en cada acta
create table if not exists public.candidate_votes (
  id               uuid primary key default gen_random_uuid(),
  table_result_id  uuid not null references public.table_results(id) on delete cascade,
  candidate_id     uuid not null references public.candidates(id),
  votes            integer not null check (votes between 0 and 100000),
  constraint candidate_votes_uq unique (table_result_id, candidate_id)
);
create index if not exists candidate_votes_candidate_idx on public.candidate_votes (candidate_id);

-- Auditoría
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  timestamp  timestamptz not null default now(),
  details    jsonb not null default '{}'::jsonb
);
create index if not exists audit_logs_ts_idx     on public.audit_logs (timestamp desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_user_idx   on public.audit_logs (user_id);

-- ---------------------------------------------------------------------
-- 3. FUNCIONES AUXILIARES DE SEGURIDAD
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'administrador', false)
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_role() is not null
$$;

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','elections','polling_places','polling_tables','political_parties','candidates'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Crear perfil al crear usuario en Auth.
-- El rol se toma SOLO de app_metadata (no editable por el usuario). Por defecto: consulta.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.user_role := 'consulta';
begin
  if new.raw_app_meta_data ? 'role'
     and new.raw_app_meta_data->>'role' in ('administrador','registrador','consulta') then
    v_role := (new.raw_app_meta_data->>'role')::public.user_role;
  end if;
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data->>'first_name', ''), 80),
    left(coalesce(new.raw_user_meta_data->>'last_name', ''), 80),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nunca dejar el sistema sin administrador activo
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'administrador' and old.active
     and (new.role <> 'administrador' or not new.active)
     and not exists (select 1 from public.profiles
                     where role = 'administrador' and active and id <> old.id) then
    raise exception 'Debe existir al menos un administrador activo.' using errcode = 'P0001';
  end if;
  new.email := old.email;  -- el email se gestiona desde Auth
  return new;
end $$;
drop trigger if exists trg_protect_last_admin on public.profiles;
create trigger trg_protect_last_admin before update on public.profiles
  for each row execute function public.protect_last_admin();

-- Sincronizar election_id desde el padre (evita inconsistencias entre elecciones)
create or replace function public.sync_table_election()
returns trigger language plpgsql as $$
begin
  select election_id into new.election_id from public.polling_places where id = new.polling_place_id;
  if new.election_id is null then
    raise exception 'El local de votación indicado no existe.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_table_election on public.polling_tables;
create trigger trg_sync_table_election before insert or update of polling_place_id on public.polling_tables
  for each row execute function public.sync_table_election();

create or replace function public.sync_candidate_election()
returns trigger language plpgsql as $$
begin
  select election_id into new.election_id from public.political_parties where id = new.party_id;
  if new.election_id is null then
    raise exception 'El partido indicado no existe.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_candidate_election on public.candidates;
create trigger trg_sync_candidate_election before insert or update of party_id on public.candidates
  for each row execute function public.sync_candidate_election();

-- Proteger estado y población de mesas: el estado solo cambia mediante funciones del sistema
create or replace function public.guard_polling_table()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pendiente' and coalesce(current_setting('app.allow_status', true), '') <> 'on' then
      new.status := 'pendiente';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status
     and coalesce(current_setting('app.allow_status', true), '') <> 'on' then
    raise exception 'El estado de la mesa solo puede cambiarse desde el registro de resultados.' using errcode = 'P0001';
  end if;
  if new.registered_voters is distinct from old.registered_voters
     and old.status in ('registrada','observada','validada') then
    raise exception 'No se pueden cambiar los electores habilitados de una mesa con acta cerrada. Reabra la mesa primero.' using errcode = 'P0001';
  end if;
  if new.election_id is distinct from old.election_id
     and exists (select 1 from public.table_results where polling_table_id = old.id) then
    raise exception 'No se puede mover a otra elección una mesa con resultados.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_polling_table on public.polling_tables;
create trigger trg_guard_polling_table before insert or update on public.polling_tables
  for each row execute function public.guard_polling_table();

-- Auditoría genérica de tablas de configuración
create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_action text;
  v_details jsonb;
begin
  if coalesce(current_setting('app.skip_audit', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    v_id := new.id; v_action := 'crear'; v_details := jsonb_build_object('datos', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    v_id := old.id; v_action := 'eliminar'; v_details := jsonb_build_object('datos', to_jsonb(old));
  else
    v_id := new.id; v_action := 'modificar';
    select jsonb_object_agg(n.key, jsonb_build_object('antes', to_jsonb(old)->n.key, 'despues', n.value))
      into v_details
      from jsonb_each(to_jsonb(new)) n
     where n.key not in ('updated_at') and (to_jsonb(old)->n.key) is distinct from n.value;
    if v_details is null then return new; end if;
    v_details := jsonb_build_object('cambios', v_details);
  end if;
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), v_action, tg_table_name, v_id, v_details);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','elections','polling_places','polling_tables','political_parties','candidates'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_changes()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. REGISTRO DE RESULTADOS (operación atómica y validada en servidor)
-- ---------------------------------------------------------------------
-- p_votes: [{"candidate_id":"uuid","votes":123}, ...]
-- p_votes_cast: total de votantes según el acta (votos emitidos)
-- p_finalize=false -> borrador ("en_registro"); true -> cierra el acta ("registrada")
-- Si el acta no cuadra, solo un administrador puede cerrarla indicando una observación ("observada").
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

-- Cambios de estado administrativos: validar, observar, reabrir, quitar validación
create or replace function public.admin_set_table_status(
  p_table_id uuid, p_status public.table_status, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table  public.polling_tables%rowtype;
  v_result public.table_results%rowtype;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de una mesa.' using errcode = '42501';
  end if;
  select * into v_table from public.polling_tables where id = p_table_id for update;
  if not found then raise exception 'La mesa indicada no existe.' using errcode = 'P0002'; end if;
  select * into v_result from public.table_results where polling_table_id = p_table_id;

  perform set_config('app.allow_status', 'on', true);
  perform set_config('app.skip_audit', 'on', true);

  if p_status = 'validada' then
    if v_table.status <> 'registrada' then
      raise exception 'Solo se pueden validar mesas en estado "Registrada".' using errcode = 'P0001';
    end if;
  elsif p_status = 'registrada' then
    if v_table.status <> 'validada' then
      raise exception 'Solo se puede quitar la validación a una mesa "Validada".' using errcode = 'P0001';
    end if;
  elsif p_status = 'observada' then
    if v_result.id is null or not v_result.is_final then
      raise exception 'Solo se pueden observar mesas con acta cerrada.' using errcode = 'P0001';
    end if;
    if v_note is null then
      raise exception 'Indique el motivo de la observación.' using errcode = 'P0001';
    end if;
    update public.table_results set observation = v_note, updated_by = auth.uid(), updated_at = now()
     where id = v_result.id;
  elsif p_status = 'en_registro' then
    if v_result.id is null then
      raise exception 'La mesa no tiene acta para reabrir.' using errcode = 'P0001';
    end if;
    update public.table_results set is_final = false, finalized_by = null, finalized_at = null,
           updated_by = auth.uid(), updated_at = now()
     where id = v_result.id;
  else
    raise exception 'Cambio de estado no permitido.' using errcode = 'P0001';
  end if;

  update public.polling_tables set status = p_status where id = p_table_id;

  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'cambiar_estado', 'polling_tables', p_table_id,
          jsonb_build_object('mesa', v_table.code, 'antes', v_table.status, 'despues', p_status, 'nota', v_note));

  perform set_config('app.allow_status', 'off', true);
  perform set_config('app.skip_audit', 'off', true);
  return jsonb_build_object('status', p_status);
end $$;

-- ---------------------------------------------------------------------
-- 6. ESTADÍSTICAS Y PROYECCIÓN (agregadas en la base de datos)
-- Se cuentan como "procesadas" las mesas Registradas y Validadas.
-- Las Observadas quedan fuera del conteo hasta su resolución.
-- ---------------------------------------------------------------------
create or replace function public.get_election_stats(p_election_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  with t as (
    select status, registered_voters from public.polling_tables where election_id = p_election_id
  ),
  counted as (
    select tr.* from public.table_results tr
    join public.polling_tables pt on pt.id = tr.polling_table_id
    where tr.election_id = p_election_id and pt.status in ('registrada','validada')
  ),
  sums as (
    select count(*) as n, coalesce(sum(registered_voters),0) as reg, coalesce(sum(votes_cast),0) as cast_,
           coalesce(sum(valid_votes),0) as valid, coalesce(sum(null_votes),0) as nul,
           coalesce(sum(blank_votes),0) as blank, coalesce(sum(did_not_vote),0) as dnv
    from counted
  ),
  cand as (
    select ca.id, ca.full_name, ca.position, ca.candidate_number, ca.photo_url, ca.active,
           p.id as party_id, p.name as party_name, p.acronym, p.color,
           coalesce(sum(cv.votes), 0)::bigint as votes
    from public.candidates ca
    join public.political_parties p on p.id = ca.party_id
    left join public.candidate_votes cv
      on cv.candidate_id = ca.id and cv.table_result_id in (select id from counted)
    where ca.election_id = p_election_id
    group by ca.id, p.id
    having ca.active or coalesce(sum(cv.votes), 0) > 0
  ),
  tl as (
    select row_number() over w as rn, count(*) over () as total, finalized_at,
           sum(votes_cast) over w as cum_cast, sum(valid_votes) over w as cum_valid
    from counted
    window w as (order by finalized_at, id)
  )
  select jsonb_build_object(
    'total_places', (select count(*) from public.polling_places where election_id = p_election_id and active),
    'total_tables', (select count(*) from t),
    'status_counts', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                      from (select status, count(*) as n from t group by status) s),
    'registered_voters_total', (select coalesce(sum(registered_voters),0) from t),
    'processed_tables', s.n,
    'registered_voters_counted', s.reg,
    'votes_cast', s.cast_, 'valid_votes', s.valid, 'null_votes', s.nul,
    'blank_votes', s.blank, 'did_not_vote', s.dnv,
    'candidates', (select coalesce(jsonb_agg(to_jsonb(c) order by c.votes desc, c.full_name), '[]'::jsonb) from cand c),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('n', rn, 'at', finalized_at,
                   'votes_cast', cum_cast, 'valid_votes', cum_valid) order by rn), '[]'::jsonb)
                 from tl where rn = total or rn % greatest(1, ceil(total / 200.0)::int) = 0),
    'generated_at', now()
  )
  from sums s
$$;

-- Estimación por razón (ratio estimator) con mesas como conglomerados.
-- share_i = votos_i / válidos (mesas procesadas)
-- SE(share_i) = sqrt((1 - n/N) * s² * n) / X, s² = Σ(y - share·x)² / (n-1)
-- Total válidos proyectado = válidos_procesados * (electores_totales / electores_procesados)
-- ADVERTENCIA: supone que las mesas procesadas son representativas (no es muestreo aleatorio).
create or replace function public.get_projection(p_election_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  with counted as (
    select tr.id, tr.valid_votes, tr.votes_cast, tr.registered_voters
    from public.table_results tr
    join public.polling_tables pt on pt.id = tr.polling_table_id
    where tr.election_id = p_election_id and pt.status in ('registrada','validada')
  ),
  pop as (
    select count(*) as n_total, coalesce(sum(registered_voters),0) as reg_total
    from public.polling_tables where election_id = p_election_id
  ),
  samp as (
    select count(*) as n, coalesce(sum(registered_voters),0) as reg,
           coalesce(sum(valid_votes),0) as valid, coalesce(sum(votes_cast),0) as cast_
    from counted
  ),
  per_cand as (
    select ca.id as candidate_id, c.valid_votes as x, coalesce(cv.votes, 0) as y
    from public.candidates ca
    cross join counted c
    left join public.candidate_votes cv on cv.table_result_id = c.id and cv.candidate_id = ca.id
    where ca.election_id = p_election_id
  ),
  agg as (
    select candidate_id, sum(y)::numeric as y_sum, sum(x)::numeric as x_sum
    from per_cand group by candidate_id
  ),
  var as (
    select pc.candidate_id,
           sum(power(pc.y - (a.y_sum / nullif(a.x_sum, 0)) * pc.x, 2)) as ss
    from per_cand pc join agg a using (candidate_id)
    group by pc.candidate_id
  ),
  res as (
    select ca.id, ca.full_name, p.acronym, p.name as party_name, p.color,
           a.y_sum::bigint as votes,
           case when a.x_sum > 0 then a.y_sum / a.x_sum end as share,
           case when s.n >= 2 and a.x_sum > 0 then
             sqrt(greatest(0, 1 - s.n::numeric / nullif(po.n_total, 0)) * (v.ss / (s.n - 1)) * s.n) / a.x_sum
           end as se
    from public.candidates ca
    join public.political_parties p on p.id = ca.party_id
    join agg a on a.candidate_id = ca.id
    join var v on v.candidate_id = ca.id
    cross join samp s cross join pop po
    where ca.election_id = p_election_id and (ca.active or a.y_sum > 0)
  )
  select jsonb_build_object(
    'processed_tables', s.n,
    'total_tables', po.n_total,
    'registered_voters_counted', s.reg,
    'registered_voters_total', po.reg_total,
    'valid_votes_counted', s.valid,
    'votes_cast_counted', s.cast_,
    'turnout_observed', case when s.reg > 0 then round(s.cast_::numeric / s.reg, 6) end,
    'projected_valid_votes', case when s.reg > 0 then round(s.valid::numeric * po.reg_total / s.reg) end,
    'candidates', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'full_name', r.full_name, 'acronym', r.acronym, 'party_name', r.party_name, 'color', r.color,
        'votes', r.votes,
        'share', round(r.share, 6),
        'se', round(r.se, 6),
        'share_low', round(greatest(0, r.share - 1.96 * r.se), 6),
        'share_high', round(least(1, r.share + 1.96 * r.se), 6)
      ) order by r.votes desc), '[]'::jsonb) from res r),
    'generated_at', now()
  )
  from samp s cross join pop po
$$;

-- ---------------------------------------------------------------------
-- 7. VISTAS (security_invoker: respetan RLS del usuario)
-- ---------------------------------------------------------------------
create or replace view public.v_polling_places with (security_invoker = true) as
select pp.*,
  (select count(*) from public.polling_tables pt where pt.polling_place_id = pp.id)::int as table_count,
  (select count(*) from public.polling_tables pt where pt.polling_place_id = pp.id
     and pt.status in ('registrada','validada'))::int as processed_count,
  (select coalesce(sum(pt.registered_voters),0) from public.polling_tables pt where pt.polling_place_id = pp.id)::int as registered_voters
from public.polling_places pp;

create or replace view public.v_polling_tables with (security_invoker = true) as
select pt.*,
  pp.code as place_code, pp.name as place_name, pp.district, pp.province, pp.department,
  nullif(btrim(pa.first_name || ' ' || pa.last_name), '') as assigned_name,
  tr.id as result_id, tr.votes_cast, tr.valid_votes, tr.null_votes, tr.blank_votes, tr.did_not_vote,
  tr.is_final, tr.observation, tr.registered_at, tr.updated_at as result_updated_at, tr.finalized_at,
  nullif(btrim(pr.first_name || ' ' || pr.last_name), '') as registered_by_name,
  nullif(btrim(pu.first_name || ' ' || pu.last_name), '') as updated_by_name
from public.polling_tables pt
join public.polling_places pp on pp.id = pt.polling_place_id
left join public.profiles pa on pa.id = pt.assigned_to
left join public.table_results tr on tr.polling_table_id = pt.id
left join public.profiles pr on pr.id = tr.registered_by
left join public.profiles pu on pu.id = tr.updated_by;

create or replace view public.v_results_export with (security_invoker = true) as
select pt.election_id, pp.code as local_codigo, pp.name as local_nombre, pp.department as departamento,
  pp.province as provincia, pp.district as distrito, pt.code as mesa, pt.status as estado,
  pt.registered_voters as electores_habilitados, tr.votes_cast as votos_emitidos, tr.valid_votes as votos_validos,
  tr.null_votes as votos_nulos, tr.blank_votes as votos_blancos, tr.did_not_vote as no_votaron,
  tr.observation as observacion,
  nullif(btrim(pr.first_name || ' ' || pr.last_name), '') as registrado_por, tr.registered_at as fecha_registro,
  nullif(btrim(pu.first_name || ' ' || pu.last_name), '') as modificado_por, tr.updated_at as fecha_modificacion,
  (select jsonb_object_agg(p.acronym || ' - ' || c.full_name, cv.votes)
     from public.candidate_votes cv
     join public.candidates c on c.id = cv.candidate_id
     join public.political_parties p on p.id = c.party_id
    where cv.table_result_id = tr.id) as votos_candidatos
from public.polling_tables pt
join public.polling_places pp on pp.id = pt.polling_place_id
left join public.table_results tr on tr.polling_table_id = pt.id
left join public.profiles pr on pr.id = tr.registered_by
left join public.profiles pu on pu.id = tr.updated_by;

create or replace view public.v_audit_logs with (security_invoker = true) as
select a.*, p.email as user_email,
       nullif(btrim(p.first_name || ' ' || p.last_name), '') as user_name
from public.audit_logs a
left join public.profiles p on p.id = a.user_id;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.elections         enable row level security;
alter table public.polling_places    enable row level security;
alter table public.polling_tables    enable row level security;
alter table public.political_parties enable row level security;
alter table public.candidates        enable row level security;
alter table public.table_results     enable row level security;
alter table public.candidate_votes   enable row level security;
alter table public.audit_logs        enable row level security;

-- profiles: cada uno ve su perfil; usuarios activos ven todos (para mostrar quién registró); solo admin edita
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Tablas de configuración: lectura para usuarios activos, escritura solo administrador
do $$ declare t text; begin
  foreach t in array array['elections','polling_places','polling_tables','political_parties','candidates'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_active_user())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Resultados: lectura para usuarios activos. Sin políticas de escritura:
-- solo se escriben mediante save_table_result() / admin_set_table_status() (security definer).
drop policy if exists table_results_select on public.table_results;
create policy table_results_select on public.table_results for select to authenticated
  using (public.is_active_user());
drop policy if exists candidate_votes_select on public.candidate_votes;
create policy candidate_votes_select on public.candidate_votes for select to authenticated
  using (public.is_active_user());

-- Auditoría: solo administradores leen; nadie escribe directamente
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- Sin acceso anónimo a nada
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 9. DATOS DEMO (función invocable desde la app por un administrador)
-- ---------------------------------------------------------------------
create or replace function public.seed_demo_data(p_with_results boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_election uuid;
  v_place uuid;
  v_party uuid;
  v_cands uuid[] := '{}';
  v_table uuid;
  v_reg int; v_cast int; v_nul int; v_blank int; v_a int; v_b int; v_c int;
  i int; j int;
  v_places text[][] := array[
    ['DL01','I.E. San Martín (DEMO)','Distrito Demo Norte'],
    ['DL02','I.E. José Olaya (DEMO)','Distrito Demo Norte'],
    ['DL03','Colegio Nacional Central (DEMO)','Distrito Demo Centro'],
    ['DL04','I.E. Micaela Bastidas (DEMO)','Distrito Demo Sur'],
    ['DL05','Coliseo Municipal (DEMO)','Distrito Demo Sur']];
  v_parties text[][] := array[
    ['Movimiento Regional ABC (DEMO)','MRA','#2F6DB5','1','Juan Pérez'],
    ['Partido Democrático Unido (DEMO)','PDU','#C0392B','2','María López'],
    ['Alianza Progreso Local (DEMO)','APL','#2E8B57','3','Carlos Díaz']];
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un administrador puede crear datos demo.' using errcode = '42501';
  end if;
  if exists (select 1 from public.elections where is_demo) then
    raise exception 'Ya existen DATOS DEMO. Elimínelos antes de volver a crearlos.' using errcode = 'P0001';
  end if;

  perform set_config('app.skip_audit', 'on', true);
  perform set_config('app.allow_status', 'on', true);

  insert into public.elections (name, description, election_date, position, status, is_demo, is_active)
  values ('Elecciones Municipales 2026 - DATOS DEMO',
          'DATOS DEMO para pruebas. No representan resultados reales.',
          date '2026-10-04', 'Alcalde', 'en_proceso', true,
          not exists (select 1 from public.elections where is_active))
  returning id into v_election;

  for i in 1..3 loop
    insert into public.political_parties (election_id, name, acronym, color, list_number)
    values (v_election, v_parties[i][1], v_parties[i][2], v_parties[i][3], v_parties[i][4]::int)
    returning id into v_party;
    insert into public.candidates (election_id, party_id, full_name, candidate_number, position)
    values (v_election, v_party, v_parties[i][5], i, 'Alcalde') returning id into v_table;
    v_cands := v_cands || v_table;
  end loop;

  for i in 1..5 loop
    insert into public.polling_places (election_id, code, name, address, district, province, department, reference)
    values (v_election, v_places[i][1], v_places[i][2], 'Av. Demo ' || (i * 100), v_places[i][3],
            'Provincia Demo', 'Departamento Demo', 'Referencia de prueba')
    returning id into v_place;
    for j in 1..4 loop
      v_reg := 200 + ((i * 37 + j * 23) % 100);
      insert into public.polling_tables (election_id, polling_place_id, code, registered_voters, assigned_to)
      values (v_election, v_place, 'DEMO-' || lpad(((i - 1) * 4 + j)::text, 3, '0'), v_reg, auth.uid())
      returning id into v_table;

      if p_with_results and ((i - 1) * 4 + j) <= 8 then
        v_cast  := round(v_reg * (0.78 + ((i + j) % 10) / 100.0));
        v_nul   := 4 + (i + j) % 7;
        v_blank := 2 + (i * j) % 6;
        v_a := round((v_cast - v_nul - v_blank) * (0.36 + (i % 3) / 50.0));
        v_b := round((v_cast - v_nul - v_blank) * (0.33 - (j % 3) / 60.0));
        v_c := (v_cast - v_nul - v_blank) - v_a - v_b;
        with r as (
          insert into public.table_results (polling_table_id, election_id, registered_voters, votes_cast,
            valid_votes, null_votes, blank_votes, is_final, registered_by, registered_at, finalized_by, finalized_at)
          values (v_table, v_election, v_reg, v_cast, v_a + v_b + v_c, v_nul, v_blank, true, auth.uid(),
                  now() - make_interval(mins => (9 - ((i - 1) * 4 + j)) * 15), auth.uid(),
                  now() - make_interval(mins => (9 - ((i - 1) * 4 + j)) * 15))
          returning id)
        insert into public.candidate_votes (table_result_id, candidate_id, votes)
        select r.id, x.cid, x.v from r,
          (values (v_cands[1], v_a), (v_cands[2], v_b), (v_cands[3], v_c)) as x(cid, v);
        update public.polling_tables set status = 'registrada' where id = v_table;
      end if;
    end loop;
  end loop;

  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'crear_datos_demo', 'elections', v_election,
          jsonb_build_object('locales', 5, 'mesas', 20, 'partidos', 3, 'candidatos', 3, 'con_resultados', p_with_results));

  perform set_config('app.skip_audit', 'off', true);
  perform set_config('app.allow_status', 'off', true);
  return v_election;
end $$;

create or replace function public.delete_demo_data()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar datos demo.' using errcode = '42501';
  end if;
  perform set_config('app.skip_audit', 'on', true);
  delete from public.candidate_votes cv using public.table_results tr, public.elections e
   where cv.table_result_id = tr.id and tr.election_id = e.id and e.is_demo;
  delete from public.elections where is_demo;
  get diagnostics v_n = row_count;
  perform set_config('app.skip_audit', 'off', true);
  insert into public.audit_logs (user_id, action, entity, details)
  values (auth.uid(), 'eliminar_datos_demo', 'elections', jsonb_build_object('elecciones', v_n));
  return v_n;
end $$;

-- Activar una elección (desactiva las demás en una sola transacción)
create or replace function public.set_active_election(p_election_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar la elección activa.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.elections where id = p_election_id) then
    raise exception 'La elección indicada no existe.' using errcode = 'P0002';
  end if;
  update public.elections set is_active = false where is_active and id <> p_election_id;
  update public.elections set is_active = true where id = p_election_id;
end $$;

-- ---------------------------------------------------------------------
-- 10. PERMISOS DE EJECUCIÓN
-- ---------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array[
    'public.current_user_role()', 'public.is_admin()', 'public.is_active_user()',
    'public.save_table_result(uuid,jsonb,integer,integer,integer,boolean,text)',
    'public.admin_set_table_status(uuid,public.table_status,text)',
    'public.get_election_stats(uuid)', 'public.get_projection(uuid)',
    'public.seed_demo_data(boolean)', 'public.delete_demo_data()', 'public.set_active_election(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_changes() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 11. REALTIME
-- Se publican solo las tablas que cambian al registrar actas. El cliente
-- recibe el aviso (respetando RLS) y vuelve a pedir las estadísticas agregadas.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'polling_tables') then
      alter publication supabase_realtime add table public.polling_tables;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'table_results') then
      alter publication supabase_realtime add table public.table_results;
    end if;
  end if;
end $$;
