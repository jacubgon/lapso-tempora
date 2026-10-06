-- ============================================================================
-- Lapso · estadísticas de uso de la base de datos (panel "Uso" de producción)
-- Devuelve el tamaño total de la base de datos y el de cada tabla de la app.
-- Solo producción (admin) puede llamarla. Idempotente.
-- ============================================================================

create or replace function public.usage_db_stats()
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo producción' using errcode = '42501';
  end if;
  return json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (
      select json_agg(json_build_object(
        'name', c.relname,
        'bytes', pg_total_relation_size(c.oid),
        'rows', c.reltuples::bigint
      ) order by pg_total_relation_size(c.oid) desc)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    )
  );
end;
$$;

revoke execute on function public.usage_db_stats() from public, anon;
grant execute on function public.usage_db_stats() to authenticated;
