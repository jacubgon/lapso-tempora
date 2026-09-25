-- ============================================================================
-- Lapso · esquema inicial
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`).
-- ============================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Ajustes globales (fila única, id = 1)
create table public.app_settings (
  id              smallint primary key default 1 check (id = 1),
  -- Entradas que empiezan antes de esta fecha no pueden editarlas los usuarios.
  lock_before     date,
  -- Fecha de una reunión general: ancla de los "ciclos" de N días en informes.
  cycle_anchor    date,
  cycle_days      smallint not null default 14 check (cycle_days between 1 and 90),
  timezone        text not null default 'Europe/Madrid',
  updated_at      timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        citext not null unique,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          citext not null,
  full_name      text not null default '',
  role           text not null default 'user' check (role in ('user', 'admin')),
  department_id  uuid references public.departments (id) on delete set null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        citext not null unique,
  client      text,
  color       text not null default '#6366f1',
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on public.project_members (user_id);

-- Subtareas: las crean los propios usuarios dentro de cada proyecto.
-- citext + unique evita duplicados tipo "Diseño" / "diseño".
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        citext not null check (length(trim(name)) > 0),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (project_id, name)
);

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null default '',
  project_id  uuid references public.projects (id) on delete restrict,
  task_id     uuid references public.tasks (id) on delete set null,
  started_at  timestamptz not null,
  ended_at    timestamptz,               -- null = cronómetro en marcha
  source      text not null default 'manual' check (source in ('timer', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  constraint ended_after_started check (ended_at is null or ended_at > started_at),
  -- Una entrada terminada debe tener proyecto y título.
  constraint finished_is_complete check (
    ended_at is null or (project_id is not null and length(trim(title)) > 0)
  )
);
create index on public.time_entries (user_id, started_at desc);
create index on public.time_entries (project_id, started_at);
create index on public.time_entries (started_at);
-- Solo un cronómetro en marcha por usuario.
create unique index one_running_timer_per_user
  on public.time_entries (user_id) where ended_at is null;

-- Auditoría de cambios en entradas
create table public.time_entry_audit (
  id          bigint generated always as identity primary key,
  entry_id    uuid not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  changed_by  uuid,
  changed_at  timestamptz not null default now(),
  old_data    jsonb,
  new_data    jsonb
);
create index on public.time_entry_audit (entry_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.project_members m
    join public.projects p on p.id = m.project_id
    where m.project_id = p_project and m.user_id = auth.uid() and not p.archived
  );
$$;

-- Pertenencia aunque el proyecto esté archivado (solo para lectura).
create or replace function public.was_project_member(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
  );
$$;

-- ¿Cae este instante en el periodo bloqueado?
create or replace function public.is_locked(p_ts timestamptz)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p_ts < (s.lock_before::timestamp at time zone s.timezone)
       from public.app_settings s where s.id = 1),
    false
  );
$$;

-- Busca la subtarea por nombre (sin distinguir mayúsculas) o la crea.
create or replace function public.get_or_create_task(p_project uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_id uuid;
begin
  if v_name = '' then
    return null;
  end if;
  if not (public.is_admin() or public.is_project_member(p_project)) then
    raise exception 'No perteneces a este proyecto' using errcode = '42501';
  end if;

  insert into public.tasks (project_id, name, created_by)
  values (p_project, v_name, auth.uid())
  on conflict (project_id, name) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.tasks
    where project_id = p_project and name = v_name::citext;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Perfil automático al crear un usuario en auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Validaciones de entradas: bloqueo, pertenencia al proyecto, coherencia de tarea
create or replace function public.time_entries_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
begin
  -- Llamadas con service_role (seed, scripts) no tienen auth.uid(): se permiten.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if not v_admin then
    if tg_op in ('UPDATE', 'DELETE') and public.is_locked(old.started_at) then
      raise exception 'Esta entrada pertenece a un periodo cerrado y ya no se puede modificar'
        using errcode = '42501';
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      if public.is_locked(new.started_at) then
        raise exception 'No se pueden registrar horas en un periodo cerrado'
          using errcode = '42501';
      end if;
      if new.user_id <> auth.uid() then
        raise exception 'No puedes registrar horas de otra persona' using errcode = '42501';
      end if;
      if new.project_id is not null
         and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id)
         and not public.is_project_member(new.project_id) then
        raise exception 'No tienes asignado este proyecto' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.project_id = new.project_id
  ) then
    raise exception 'La subtarea no pertenece al proyecto elegido';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
    new.user_id := old.user_id;       -- el dueño no cambia
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger time_entries_guard
  before insert or update or delete on public.time_entries
  for each row execute function public.time_entries_guard();

create or replace function public.time_entries_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.time_entry_audit (entry_id, action, changed_by, old_data, new_data)
  values (
    coalesce(new.id, old.id),
    lower(tg_op),
    auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger time_entries_audit
  after insert or update or delete on public.time_entries
  for each row execute function public.time_entries_audit();

-- Un usuario no puede cambiarse el rol, departamento ni estado a sí mismo
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.department_id := old.department_id;
    new.active := old.active;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.app_settings      enable row level security;
alter table public.departments       enable row level security;
alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.tasks             enable row level security;
alter table public.time_entries      enable row level security;
alter table public.time_entry_audit  enable row level security;

-- app_settings
create policy "settings: leer" on public.app_settings
  for select to authenticated using (true);
create policy "settings: admin edita" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- departments
create policy "departments: leer" on public.departments
  for select to authenticated using (true);
create policy "departments: admin gestiona" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy "profiles: yo o admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: edito mi nombre" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin gestiona" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- projects
create policy "projects: miembros o admin" on public.projects
  for select to authenticated using (public.is_admin() or public.was_project_member(id));
create policy "projects: admin gestiona" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- project_members
create policy "members: los míos o admin" on public.project_members
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "members: admin gestiona" on public.project_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tasks (la creación va por get_or_create_task)
create policy "tasks: de mis proyectos o admin" on public.tasks
  for select to authenticated using (public.is_admin() or public.was_project_member(project_id));
create policy "tasks: admin gestiona" on public.tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- time_entries (el trigger añade bloqueo y pertenencia al proyecto)
create policy "entries: las mías o admin" on public.time_entries
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "entries: creo las mías" on public.time_entries
  for insert to authenticated with check (user_id = auth.uid() or public.is_admin());
create policy "entries: edito las mías" on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "entries: borro las mías" on public.time_entries
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- audit: solo lectura para admin (escribe el trigger)
create policy "audit: admin lee" on public.time_entry_audit
  for select to authenticated using (public.is_admin());

-- Funciones RPC expuestas
revoke execute on function public.get_or_create_task(uuid, text) from public, anon;
grant execute on function public.get_or_create_task(uuid, text) to authenticated;
