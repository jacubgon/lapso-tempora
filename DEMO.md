# Guion de demo · Lapso (≈ 10 min)

Empresa ficticia: **42 personas** en 6 departamentos (Diseño, Técnico, Producción, Comercial,
Administración, Mantenimiento), 8 proyectos y ~3 meses de horas. Reunión general cada 14 días.

| Cuenta | Email | Contraseña |
|---|---|---|
| Producción | `admin@lapso.demo` | `LapsoDemo2026!` |
| Trabajadora (Diseño) | `ana@lapso.demo` | `LapsoDemo2026!` |

## Antes de la reunión (el día antes)

- [ ] Abrir la URL y entrar: si Supabase llevaba días sin uso, así se despierta.
- [ ] `npm run seed -- --olvidado` → datos frescos hasta hoy y un cronómetro olvidado de Ana.
- [ ] Ventana de incógnito con Ana y otra normal con Producción, ya con la sesión iniciada.
- [ ] En el móvil: abrir la URL, entrar como Ana y **Añadir a pantalla de inicio**.

## 1. El día a día del trabajador (Ana) · 3 min

1. **Aviso de cronómetro olvidado**: nada más entrar aparece «¿Se te olvidó pararlo?».
   → *Ajustar hora de fin* → poner las 18:00 de ayer → *Parar con esta hora*.
   **Mensaje:** «los olvidos no inflan las horas; se corrigen en el momento».
2. **Cronómetro**: título «Revisión de propuesta», proyecto *Campaña primavera*,
   subtarea: escribir «rev» → sugiere *Revisión cliente*. **Empezar**.
   **Mensaje:** «las subtareas las crea el equipo, pero sin duplicados: «Diseño» y «diseño» son la misma».
3. **Manual**: pestaña *Manual* → ayer de 9:00 a 11:30 → *Añadir*.
   La siguiente entrada empieza sola a las 11:30 para registrar el día seguido.
4. **Histórico**: corregir una entrada (✏️), *continuar* otra (▶). Totales por día y semana.
5. **En el móvil**: abrir la app instalada; el cronómetro sigue corriendo (se guarda en el servidor).

## 2. La visión de producción · 5 min

1. **Informes → Ciclo de reunión**: «esto es lo que usas tú: de una reunión general a la siguiente».
   Flechas ◀ ▶ para comparar con el ciclo anterior.
2. **Agrupar por** Proyecto → Persona → Departamento → Subtarea → Cliente.
   Pasar el ratón por las barras. Bajar a la tabla **Personas × proyectos**.
3. **Filtros**: Departamento *Técnico* → Proyecto *Reforma oficinas Nexo* → ver sus subtareas.
4. **Detalle**: todas las entradas en orden cronológico, con separador y total por día.
   ⚠️ marca entradas de más de 10 h. ✏️ para corregir; 🕘 muestra **quién cambió qué y cuándo**.
5. **Exportar → Excel**: abrirlo (hojas Resumen, Personas × proyectos y Por periodo).

## 3. Gestión y control · 2 min

1. **Gestión → Proyectos**: crear «Proyecto cliente X», color, asignar a 3 personas.
   (Entrar como Ana: solo ve los proyectos que tiene asignados.)
2. **Personas**: alta con contraseña temporal (cada persona la cambia en *Mi cuenta*).
   Desactivar a alguien que se va: deja de poder entrar, sus horas se conservan.
3. **Ajustes → Cerrar hasta el ciclo actual**: el equipo ya no puede tocar ciclos pasados;
   producción sí, y queda registrado.

## Preguntas que pueden salir

| Pregunta | Respuesta |
|---|---|
| ¿Funciona en el móvil? | Sí, es una web instalable como app (sin pasar por tiendas). |
| ¿Quién ve qué? | Cada persona solo sus horas y proyectos. Producción todo. Lo impone la base de datos, no solo la pantalla. |
| ¿Se puede manipular el histórico? | Cada alta, cambio o borrado queda auditado; los periodos cerrados no se pueden tocar. |
| ¿Dónde están los datos? | En Supabase, en la región que elijamos (UE). En producción, en una cuenta a nombre de la empresa. |
| ¿Sirve como registro de jornada legal? | Es registro de horas por proyecto; se puede ampliar a fichaje de jornada si lo necesitan. |
| ¿Podemos traer lo de Clockify? | Sí, se puede importar su histórico (CSV de Clockify). |
| ¿Aprobación de horas por responsables? | Previsto como siguiente fase. |
| ¿Coste? | Alojamiento ~25–45 $/mes (base de datos + web) a nombre del cliente + desarrollo/mantenimiento. |

## Después de la demo

- `npm run seed` vuelve a dejar los datos limpios.
- Para un piloto real: cuenta de Supabase del cliente (plan Pro), SMTP propio, dominio y
  borrar los usuarios `@lapso.demo`.
