# Sistema de Registro y Seguimiento de Resultados Electorales

Aplicación web para registrar actas de mesa y seguir el avance del conteo en tiempo real.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · componentes propios estilo shadcn/ui · Recharts · Supabase (Auth, PostgreSQL, Row Level Security, Realtime) · despliegue en Vercel.

---

## 1. Análisis previo y decisiones de diseño

Antes de escribir código se identificaron estos problemas de diseño y se resolvieron así:

| Problema detectado | Decisión |
|---|---|
| "No votaron" es un dato derivado: si se escribe a mano puede contradecir la ecuación. | Se **calcula**: `no votaron = habilitados − emitidos` (columna generada en PostgreSQL). El registrador escribe los emitidos del acta y el sistema valida `válidos + nulos + blancos = emitidos` y `emitidos ≤ habilitados`. |
| Si el cliente escribe directamente en `table_results` y `candidate_votes`, un acta puede quedar a medias o saltarse validaciones. | Las actas **solo** se escriben con la función `save_table_result` (una transacción: valida, guarda, cambia estado y audita). No hay políticas de INSERT/UPDATE directas sobre esas tablas. |
| Un usuario podría auto-asignarse el rol administrador en el registro (metadatos editables). | El rol se toma solo de `app_metadata` (no editable por el usuario). Por defecto: *consulta*. El primer admin se promueve por SQL. |
| Contar actas "observadas" en los totales mezclaría datos dudosos. | Mesas **procesadas** = *Registrada* + *Validada*. Las observadas quedan fuera hasta su resolución. |
| Una elección puede tener varios cargos, lo que complica la validación "suma de candidatos = válidos". | Una elección = una contienda (campo *cargo*, p. ej. "Alcalde"). Para otro cargo se crea otro proceso. Solo un proceso está **activo** a la vez. |
| El tiempo real "descargando filas" no escala a miles de mesas. | Realtime solo **avisa**; el navegador vuelve a pedir un agregado calculado en PostgreSQL (una fila JSON). |
| Proyección presentada como resultado. | Página separada, advertencia fija, texto "Estimación basada en X de Y mesas registradas", intervalos y lenguaje no concluyente. |

### Arquitectura

```
Navegador (React / Next.js cliente)
   │  anon key + JWT de sesión (cookies)
   ▼
Next.js (Vercel)
   ├── middleware.ts ........ refresca sesión y protege rutas
   ├── Server Components ..... verifican rol (requireAccess) antes de renderizar
   └── /api/admin/users ...... única ruta con service_role (opcional, solo servidor)
   ▼
Supabase
   ├── Auth ................. correo + contraseña
   ├── PostgreSQL ........... tablas, constraints, triggers, funciones RPC, vistas
   ├── RLS .................. permisos por rol en cada tabla (la seguridad real)
   └── Realtime ............. avisos de cambios en polling_tables / table_results
```

Capas del código: `app/` (páginas y vistas) → `hooks/` (estado, tiempo real) → `services/` (acceso a datos, único lugar que habla con Supabase) → `supabase/` (esquema SQL).

### Modelo de datos y relaciones

```
elections ─┬─< polling_places ─< polling_tables ─── table_results ─< candidate_votes >─ candidates
           ├─< political_parties ─< candidates                                            │
           └──────────────────────────────────────────────────────────────────────────────┘
profiles ─< audit_logs          profiles ─< polling_tables.assigned_to (registrador asignado)
```

- `polling_tables` 1 ─ 0..1 `table_results` (una sola acta por mesa, `unique`).
- `candidate_votes` tiene clave única (acta, candidato) → no hay votos duplicados.
- Únicos: código de local por elección, código de mesa por local, sigla de partido y número de candidato por elección.
- Checks: votos ≥ 0, `válidos + nulos + blancos = emitidos`, `emitidos ≤ habilitados`.
- Triggers mantienen `election_id` coherente con el padre, impiden cambiar el estado de una mesa fuera de las funciones autorizadas y registran auditoría automática en tablas de configuración.

### Flujo de autenticación

1. `/login` → `supabase.auth.signInWithPassword`. La sesión se guarda en cookies (`@supabase/ssr`).
2. `middleware.ts` refresca la sesión en cada petición; sin sesión → `/login?next=…`; con sesión en `/login` → `/dashboard`.
3. El layout protegido carga el perfil; si `active = false` muestra "cuenta inactiva".
4. Cada página llama a `requireAccess(módulo)`; el menú se filtra por rol. Aun si alguien fuerza una URL o llama a la API directamente, **RLS** rechaza la operación.

### Flujo de registro de una mesa

1. *Registro de resultados* → búsqueda por código de mesa o local (el registrador ve y elige cualquier mesa del proceso activo; Enter abre la mesa si hay un único resultado).
2. Pantalla única del acta: mesa, local, electores habilitados, estado, candidatos con campos numéricos.
3. Mientras se escribe, un resumen muestra la ecuación `válidos + nulos + blancos = emitidos`, no votaron, participación y abstención, con errores inmediatos.
4. **Guardar borrador** → estado *En registro* (permite datos incompletos pero nunca negativos ni > habilitados).
5. **Finalizar** → diálogo de confirmación → `save_table_result(..., p_finalize = true)` → estado *Registrada*.
6. Si no cuadra, se bloquea. Solo un administrador puede cerrar con **observación** escrita → *Observada*.
7. El administrador puede *Validar*, *Observar* o *Reabrir* (`admin_set_table_status`). Todo queda en `audit_logs` con usuario y hora; el acta muestra quién la registró y quién la modificó.

### Tiempo real

`polling_tables` y `table_results` están en la publicación `supabase_realtime`. Dashboard, Estadísticas, Proyección y la pantalla del acta se suscriben a `postgres_changes` filtrado por la elección activa. Cada aviso dispara (con *debounce* de 800 ms) una nueva llamada a `get_election_stats` / `get_projection`. Un indicador muestra el estado de la conexión; al volver a la pestaña también se refresca.

### Cálculo de estadísticas

`get_election_stats(election_id)` hace todo en PostgreSQL con índices y devuelve un único JSON: totales de locales y mesas, conteo por estado, electores, sumas de emitidos/válidos/nulos/blancos/no votaron de las mesas procesadas, votos por candidato y la serie acumulada para el gráfico de evolución. La participación se calcula sobre los electores **de las mesas procesadas** (no sobre el padrón total).

### Estimación (proyección)

- Proporción de cada candidato: `p = Σ votos del candidato / Σ válidos` en mesas procesadas (estimador de razón).
- Total estimado de válidos: `válidos contabilizados × (electores totales / electores en mesas procesadas)`.
- Estimación orientativa por candidato: `p × total estimado de válidos`.
- Rango ≈ 95 %: cada mesa se trata como conglomerado; `SE = √((1 − n/N) · s² · n) / X`, con `s²` la varianza de los residuos `yᵢ − p·xᵢ`; rango `p ± 1,96·SE`. La corrección `(1 − n/N)` hace que el rango se cierre al acercarse al 100 %.
- Limitación explícita: las mesas no llegan al azar, por lo que el rango es orientativo. Con menos de 30 mesas se muestra un aviso adicional.

### Seguridad

- **RLS en todas las tablas**. Lectura: usuarios activos. Escritura de configuración: solo administrador. Actas: solo vía RPC, que comprueba el rol, que el proceso esté *En proceso* y que el acta no esté cerrada.
- Rol `anon` sin permisos. Vistas con `security_invoker` (respetan RLS).
- Funciones `security definer` con `search_path` fijo y verificación de rol interna.
- No se puede desactivar o degradar al último administrador (trigger).
- Validación en frontend (inmediata) **y** en backend (constraints + RPC).
- Sanitización de textos, búsquedas (caracteres de filtro PostgREST) y CSV (anti inyección de fórmulas al exportar).
- `SUPABASE_SERVICE_ROLE_KEY` es opcional, sin prefijo `NEXT_PUBLIC_`, solo se usa en `app/api/admin/users` tras verificar que quien llama es administrador activo.
- Cabeceras de seguridad (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) en `next.config.ts`.

---

## 2. Estructura de carpetas

```
sistema-electoral/
├── app/
│   ├── layout.tsx, globals.css, page.tsx
│   ├── login/                    Página de acceso
│   ├── api/admin/users/          Crear usuario / restablecer contraseña (service role, solo servidor)
│   └── (app)/                    Rutas protegidas (layout con sidebar)
│       ├── dashboard/            Tarjetas, progreso, gráficos en vivo
│       ├── configuracion/        Procesos electorales, activar, datos demo
│       ├── locales/              CRUD + filtros por ubicación + CSV
│       ├── mesas/                CRUD + electores + asignación de registrador + CSV
│       ├── partidos/             CRUD + CSV
│       ├── candidatos/           CRUD + CSV
│       ├── registro/             Lista de mesas y [id]/ formulario del acta
│       ├── estadisticas/         5 gráficos + tabla + exportación CSV
│       ├── proyeccion/           Estimación con intervalos y advertencias
│       ├── usuarios/             Roles, activación, alta de usuarios
│       └── auditoria/            Bitácora paginada con filtros y detalle
├── components/                   StatCard, DataTable, Modal, ConfirmDialog, StatusBadge,
│   ├── ui/                       CandidateVoteInput, ProgressBar, ChartCard, States…
│   ├── charts/                   Gráficos Recharts
│   └── layout/                   AppShell (sidebar + header), SignOutButton
├── hooks/                        useApp, useAsync, useDebounce, useRealtimeStats, useLiveStats
├── lib/                          supabase/ (client, server, admin, middleware), auth, permissions
├── services/                     Acceso a datos por módulo
├── types/                        Tipos TypeScript del dominio
├── utils/                        formato, validación, sanitización, errores, CSV
├── supabase/
│   ├── schema.sql                Esquema completo: tablas, índices, RLS, funciones, vistas, realtime
│   ├── create_admin.sql          Promover el primer administrador
│   └── seed.sql                  Datos demo (opcional)
├── middleware.ts
└── .env.example
```

---

## 3. Instalación paso a paso

Requisitos: Node.js 20 o superior, cuenta gratuita en [supabase.com](https://supabase.com) y (para publicar) en [vercel.com](https://vercel.com).

### 3.1 Crear el proyecto en Supabase

1. En Supabase: **New project**. Elija nombre, contraseña de base de datos y región cercana.
2. Espere a que el proyecto termine de aprovisionarse.

### 3.2 Crear las tablas, RLS y funciones

1. Menú **SQL Editor → New query**.
2. Copie el contenido completo de `supabase/schema.sql`, péguelo y pulse **Run**.
3. Debe terminar sin errores. Este único script crea tipos, tablas, constraints, índices, funciones, vistas, **todas las políticas RLS** y registra las tablas en Realtime. No hay que configurar RLS a mano: puede revisarlo en **Authentication → Policies** o **Table Editor** (cada tabla indica "RLS enabled").

### 3.3 Configurar Auth

1. **Authentication → Sign In / Providers → Email**: habilitado.
2. Recomendado: desactive **Allow new users to sign up** (el sistema es de acceso restringido; los usuarios los crea el administrador).
3. Si no configurará un servidor de correo, al crear usuarios desde el panel marque **Auto Confirm User**.

### 3.4 Crear el primer administrador

1. **Authentication → Users → Add user → Create new user**: correo y contraseña, marque *Auto Confirm User*.
2. En **SQL Editor**, abra `supabase/create_admin.sql`, reemplace `admin@ejemplo.com` por ese correo y ejecútelo.
3. La consulta final debe mostrar el usuario con rol `administrador`.

> Cualquier usuario nuevo entra con rol **consulta**. El administrador cambia roles desde el módulo *Usuarios*.

### 3.5 Variables de entorno

En **Project Settings → API** (o *Data API / API Keys*):

```bash
cp .env.example .env.local
```

| Variable | Dónde obtenerla | ¿Obligatoria? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `anon` / *publishable* | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` / *secret* | No. Solo para crear usuarios y restablecer contraseñas desde la app. **Nunca** con prefijo `NEXT_PUBLIC_`. |

### 3.6 Ejecutar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000, ingrese con el administrador.

### 3.7 Datos demo

En **Configuración electoral → Crear datos demo** (o ejecutando `supabase/seed.sql`). Se crea el proceso "Elecciones Municipales 2026 – DATOS DEMO" con 5 locales, 20 mesas, 3 partidos, 3 candidatos y 8 actas ya registradas. Todo lleva la marca **(DEMO)** y la aplicación muestra un banner **DATOS DEMO** mientras esa elección está activa. Se eliminan con un botón (o `select public.delete_demo_data();`) sin tocar datos reales.

### 3.8 Desplegar en Vercel

1. Suba el proyecto a un repositorio de GitHub/GitLab (el `.gitignore` excluye `.env.local`).
2. En Vercel: **Add New → Project**, importe el repositorio (framework detectado: Next.js).
3. En **Environment Variables** agregue las mismas variables de la tabla anterior.
4. **Deploy**.
5. En Supabase → **Authentication → URL Configuration**, ponga la URL de Vercel en *Site URL*.

---

## 4. Importación y exportación CSV

Cada módulo tiene el botón **Importar CSV** con plantilla descargable. Columnas (primera fila = encabezados, UTF-8):

| Módulo | Columnas |
|---|---|
| Locales | `code,name,address,department,province,district,reference` |
| Mesas | `codigo_mesa,codigo_local,electores_habilitados` |
| Partidos | `nombre,sigla,color,numero_lista` |
| Candidatos | `nombre_completo,sigla_partido,cargo,numero` |

Se valida cada fila y se informan los errores por número de línea. **Exportar resultados** (Estadísticas) descarga una fila por mesa con estado, totales, votos por candidato, quién registró y cuándo.

---

## 5. Prueba de los criterios de aceptación

1. Iniciar sesión como administrador → Dashboard.
2. *Configuración electoral* → crear proceso y marcarlo **activo** (o crear datos demo).
3. *Locales* → crear un local. *Mesas* → crear mesa con electores habilitados y asignar un registrador.
4. *Partidos* y *Candidatos* → crear al menos dos.
5. *Usuarios* → crear (o promover) un **registrador** y un usuario **consulta**.
6. En otra ventana (o navegador privado) entrar como *consulta* y dejar abierto el Dashboard.
7. Como registrador: *Registro de resultados* → la mesa → escribir votos, nulos, blancos y emitidos → ver no votaron y la ecuación → **Finalizar** → confirmar.
8. La ventana del usuario *consulta* se actualiza sola: avance, votos acumulados y gráficos.
9. *Proyección* muestra "Estimación basada en X de Y mesas registradas" con la advertencia.
10. Como administrador: abrir la mesa → *Historial*, y *Auditoría* para ver quién registró o modificó.
11. *Estadísticas → Exportar resultados CSV*.
12. Verificar restricciones: el usuario *consulta* no ve menús de edición; el registrador no puede modificar un acta ya cerrada.

---

## 6. Rendimiento

- Listados paginados en servidor (25 filas) con `count` exacto; filtros ejecutados en PostgreSQL.
- Índices en claves foráneas, estado, códigos y `audit_logs(timestamp)`.
- Estadísticas y proyección agregadas en una sola llamada RPC.
- Realtime solo como disparador (sin transferir filas); refresco con *debounce*.
- Exportación por bloques de 1000 filas.

Funciona en el plan gratuito de Supabase para miles de mesas. (El plan gratuito pausa proyectos inactivos durante una semana; reactívelo desde el panel antes de una jornada electoral.)

## 7. Limitaciones conocidas

- Un proceso = un cargo. Para varios cargos simultáneos cree procesos separados y actívelos por turnos, o amplíe el modelo con una tabla de contiendas.
- Los logos y fotografías son URLs `https://` (no se usa Supabase Storage para mantener la instalación simple).
- La proyección asume que las mesas procesadas son representativas; es orientativa y no reemplaza el cómputo oficial.
- Sin servidor de correo propio, la recuperación de contraseña la hace el administrador (módulo *Usuarios* con service role, o el panel de Supabase).
