-- ============================================================================
-- Lapso · rendimiento de informes
-- 1) Políticas RLS con (select ...) para que is_admin()/auth.uid() se evalúen
--    una vez por consulta y no una vez por fila (recomendación de Supabase).
-- 2) report_entries(): devuelve las entradas filtradas en un único JSON
--    (un solo viaje en vez de paginar de 1000 en 1000).
-- Ejecutar en Supabase → SQL Editor. Es idempotente: se puede ejecutar varias veces.
-- ============================================================================

-- app_settings
drop policy if exists "settings: admin edita" on public.app_settings;
create policy "settings: admin edita" on public.app_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- departments
drop policy if exists "departments: admin gestiona" on public.departments;
create policy "departments: admin gestiona" on public.departments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profiles
drop policy if exists "profiles: yo o admin" on public.profiles;
create policy "profiles: yo o admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles: edito mi nombre" on public.profiles;
create policy "profiles: edito mi nombre" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "profiles: admin gestiona" on public.profiles;
create policy "profiles: admin gestiona" on public.profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- projects
drop policy if exists "projects: miembros o admin" on public.projects;
create policy "projects: miembros o admin" on public.projects
  for select to authenticated using ((select public.is_admin()) or public.was_project_member(id));
drop policy if exists "projects: admin gestiona" on public.projects;
create policy "projects: admin gestiona" on public.projects
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- project_members
drop policy if exists "members: los míos o admin" on public.project_members;
create policy "members: los míos o admin" on public.project_members
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "members: admin gestiona" on public.project_members;
create policy "members: admin gestiona" on public.project_members
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- tasks
drop policy if exists "tasks: de mis proyectos o admin" on public.tasks;
create policy "tasks: de mis proyectos o admin" on public.tasks
  for select to authenticated using ((select public.is_admin()) or public.was_project_member(project_id));
drop policy if exists "tasks: admin gestiona" on public.tasks;
create policy "tasks: admin gestiona" on public.tasks
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- time_entries
drop policy if exists "entries: las mías o admin" on public.time_entries;
create policy "entries: las mías o admin" on public.time_entries
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "entries: creo las mías" on public.time_entries;
create policy "entries: creo las mías" on public.time_entries
  for insert to authenticated with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "entries: edito las mías" on public.time_entries;
create policy "entries: edito las mías" on public.time_entries
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "entries: borro las mías" on public.time_entries;
create policy "entries: borro las mías" on public.time_entries
  for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- time_entry_audit
drop policy if exists "audit: admin lee" on public.time_entry_audit;
create policy "audit: admin lee" on public.time_entry_audit
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Informe: entradas terminadas, filtradas, en un único JSON compacto.
-- Cada elemento: [user_id, project_id, task_id, inicio_epoch, fin_epoch]
-- security invoker → se aplican las mismas reglas RLS que a una consulta normal.
-- ---------------------------------------------------------------------------
create or replace function public.report_entries(
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_users   uuid[]      default null,
  p_project uuid        default null,
  p_task    uuid        default null
)
returns json
language sql stable security invoker set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_array(
        e.user_id, e.project_id, e.task_id,
        extract(epoch from e.started_at)::bigint,
        extract(epoch from e.ended_at)::bigint
      )
      order by e.started_at, e.id
    ),
    '[]'::json
  )
  from public.time_entries e
  where e.ended_at is not null
    and (p_from    is null or e.started_at >= p_from)
    and (p_to      is null or e.started_at <  p_to)
    and (p_users   is null or e.user_id = any (p_users))
    and (p_project is null or e.project_id = p_project)
    and (p_task    is null or e.task_id = p_task);
$$;

revoke execute on function public.report_entries(timestamptz, timestamptz, uuid[], uuid, uuid) from public, anon;
grant execute on function public.report_entries(timestamptz, timestamptz, uuid[], uuid, uuid) to authenticated;
