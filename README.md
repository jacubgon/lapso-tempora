# Lapso

Registro de horas por proyecto para equipos (tipo Clockify). Next.js 16 + Supabase.

## Puesta en marcha

1. **Supabase**: crea un proyecto (región UE) en supabase.com.
2. **Esquema**: en *SQL Editor*, pega y ejecuta `supabase/migrations/0001_init.sql`.
3. **Variables**: copia `.env.example` a `.env.local` y rellena las claves
   (*Project Settings → API*). La `service_role` solo se usa en servidor y en el seed.
4. **Auth**: en *Authentication → Sign In / Providers*, desactiva “Allow new users to sign up”
   (los usuarios los crea producción). En *Authentication → URL Configuration* pon como
   *Site URL* la URL pública y añade `<url>/auth/confirm` (y `http://localhost:3100/auth/confirm`
   en desarrollo) a *Redirect URLs*: lo usa el enlace de «¿Has olvidado tu contraseña?».
   Para producción, configura un SMTP propio (*Authentication → Emails → SMTP*): el correo
   incluido en Supabase solo envía unos pocos emails por hora.
5. **Datos demo** (opcional): `npm run seed` → crea usuarios ficticios `@lapso.demo`,
   5 proyectos y ~3 meses de horas.
6. `npm run dev` → http://localhost:3000

### Primer administrador sin seed

Crea el usuario en *Authentication → Users* y luego en SQL:

```sql
update public.profiles set role = 'admin' where email = 'tu@email.com';
```

## Modelo

| Tabla | Qué guarda |
|---|---|
| `profiles` | usuario, rol (`user` / `admin`), departamento (opcional) |
| `projects` / `project_members` | proyectos creados por producción y a quién se asignan |
| `tasks` | subtareas por proyecto, creadas por los usuarios (sin duplicados por mayúsculas) |
| `time_entries` | entradas de tiempo; `ended_at = null` → cronómetro en marcha |
| `time_entry_audit` | historial de cambios de cada entrada (quién, cuándo, antes/después) |
| `app_settings` | fecha de bloqueo de edición y ciclo de reuniones (14 días) |

La seguridad está en la base de datos (RLS + triggers): cada usuario solo ve y edita lo suyo,
solo registra en proyectos asignados y no puede tocar periodos cerrados. Producción ve todo.

## Marca

Nombre, lema e inicial en `src/config/brand.ts`; colores en `src/app/globals.css`.
