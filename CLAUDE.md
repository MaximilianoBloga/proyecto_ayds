@AGENTS.md

# ComplejoSport — Sistema de Reserva de Turnos de Canchas

**Materia:** Arquitectura y Diseño de Sistemas 2026 — Comisión 5  
**Integrantes:** Monardez, Sagasti, Bloga, Uzeltinger, Bellitto, Julián  
**Slogan:** "Reservá tu cancha, jugá sin complicaciones"

Plataforma web que permite a usuarios clientes reservar canchas deportivas en complejos, gestionar equipamiento y pagos. Administradores y auxiliares gestionan complejos, canchas, inventario y estadísticas.

---

## Entregables

| # | Fecha | Contenido | Estado |
|---|-------|-----------|--------|
| 1 | 6 abr | Modelo de dominio, glosario, RF-01–RF-28, RNF-01–RNF-15, DER | ✓ Entregado |
| 2 | 27 abr | Diagrama de contexto, contenedores y componentes (C4) | ✓ Entregado |
| 3 | 18 may | Modelo de datos relacional y diccionario de datos | ✓ Entregado |
| 4 | 8 jun | Diseño de APIs (OpenAPI/Swagger) + Pipelines de datos + ADRs (5) | ✓ Entregado |

**Presentación Final:**
- 30 minutos totales: intro (5min) + arquitectura (5min) + demo video (5-8min) + conclusiones (5min) + preguntas (10min)
- Demo debe ser **video pregrabado embebido** en la presentación (no demo en vivo)
- Presentación a entregar 48 hs antes del día de exposición
- Nota sobre 10 pts: Demo funcional (3) + Coherencia arquitectura (3) + Calidad presentación (1.5) + Profundidad técnica (1.5) + Participación (1)
- Slides obligatorios: carátula, descripción del sistema, 2-3 ADRs clave, modelo de datos, APIs (endpoints + request/response), demo, desafíos y aprendizajes

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| Backend | API Routes de Next.js + servidor Express separado (`backend/`) |
| ORM | Prisma 7 con adaptador `@prisma/adapter-pg` |
| Base de datos | PostgreSQL |
| Autenticación | Clerk |
| Pagos | Mercado Pago |
| Notificaciones | Gmail API / Nodemailer |
| Contenedores | Docker |
| Package manager | pnpm |

---

## Estructura del Proyecto

```
ProyectoArqui/
├── app/                        # Next.js App Router (páginas y API routes)
│   ├── globals.css             # Tailwind v4 + variables CSS de paleta
│   ├── layout.tsx              # Layout raíz (lang=es, fuentes Geist)
│   ├── page.tsx                # Landing page (Home)
│   ├── sign-in/[[...sign-in]]/ # Página de login (Clerk)
│   ├── sign-up/[[...sign-up]]/ # Página de registro (Clerk)
│   ├── auth/redirect/          # Redirect post-login según rol
│   ├── admin/
│   │   ├── page.tsx            # Panel admin (Server Component)
│   │   └── complejos/
│   │       └── page.tsx        # Gestión de complejos ('use client') ✓ hecho
│   └── api/
│       ├── auth/complejo-auxiliar/route.ts   # GET — id_complejo del auxiliar logueado
│       └── v1/
│           ├── complejos/
│           │   ├── route.ts                  # GET (lista paginada) + POST (crear)
│           │   └── [idComplejo]/route.ts     # GET + PATCH + DELETE
│           └── webhooks/clerk/route.ts       # Webhook Clerk (user.created/updated/deleted)
├── src/
│   ├── components/             # Componentes reutilizables de UI
│   │   ├── Navbar.tsx          # 'use client' — sticky, hamburguesa mobile
│   │   ├── Hero.tsx            # 'use client' — barra de búsqueda
│   │   ├── Features.tsx        # Server Component
│   │   ├── ComplejoCard.tsx    # Server Component
│   │   ├── CanchaCard.tsx      # 'use client' — botón reservar con TODO auth
│   │   ├── HowItWorks.tsx      # Server Component
│   │   └── Footer.tsx          # Server Component
│   └── mocks/
│       └── data.ts             # Datos mockeados (reemplazar con queries Prisma al tener DB)
├── backend/                    # Servidor Express independiente
│   ├── app/prisma/prisma.ts    # Instancia Prisma del backend
│   ├── prisma/schema.prisma    # Schema Prisma (fuente de verdad del modelo)
│   ├── app.js
│   └── server.js
├── docs/
│   ├── Entregable 1/
│   │   ├── CU/                 # Casos de uso CU-01 a CU-26 (.docx)
│   │   ├── Diagrama_entidad-relacion.pdf
│   │   └── Documentacion_proyecto.pdf   # Glosario, RF-01–RF-28, RNF-01–RNF-15
│   ├── Entregable 2/
│   │   ├── Diagrama_de_contexto.pdf
│   │   ├── Diagrama_de_contenedores.pdf
│   │   └── Diagrama_de_componentes.pdf
│   ├── Entregable 3/
│   │   ├── Modelo_de_datos.pdf
│   │   └── Diccionario_de_datos.pdf
│   ├── Entregable 4/
│   │   ├── ADRs/               # ADR-001 a ADR-005 (.pdf)
│   │   ├── PIPES/              # 6 pipelines (.pdf)
│   │   └── API.yaml            # Diseño OpenAPI/Swagger
│   ├── Lineamientos_presentacion_final.pdf
│   └── Proyecto 2026.pdf       # Lineamientos y criterios de evaluación
├── public/                     # Assets estáticos
├── prisma.config.ts
├── next.config.ts
├── tsconfig.json               # paths: "@/*" → "./*"
└── package.json
```

---

## Ruteo de la Aplicación

Decisión tomada: las canchas son recursos anidados dentro de complejos. La reserva vive en el contexto de cancha → complejo.

```
/                                                   → Landing (hecha)
/sign-in                                            → Inicio de sesión (Clerk)
/sign-up                                            → Registro (Clerk)
/auth/redirect                                      → Redirect post-login según rol (cliente→/, admin→/admin, auxiliar→/auxiliar/[id])

/complejos                                          → Lista y búsqueda de complejos
/complejos/[complejo_id]                            → Detalle del complejo + sus canchas
/complejos/[complejo_id]/canchas/[cancha_id]        → Detalle de cancha (horarios, reseñas)
/complejos/[complejo_id]/canchas/[cancha_id]/reservar  → Formulario de reserva (auth requerida)

/reservas                                           → Mis reservas (auth requerida)
/reservas/[reserva_id]                              → Detalle / comprobante de reserva

/admin                                              → Panel admin (auth requerida) ✓ hecho
/admin/complejos                                    → Gestión de complejos del admin ✓ hecho
/admin/complejos/[complejo_id]/canchas              → Gestión de canchas (pendiente)

/auxiliar/[complejo_id]                             → Panel auxiliar (auth requerida, pendiente)
```

---

## Base de Datos — Estado actual

La DB está hosteada en **Neon PostgreSQL** (Vercel). Las tablas ya están creadas y las migraciones aplicadas.

**Configuración resuelta (Prisma 7 + Neon):**
- La URL va en `prisma.config.ts` (no en `schema.prisma` — breaking change de Prisma 7)
- `prisma.config.ts` usa `DATABASE_URL_UNPOOLED` para migraciones (directo, sin PgBouncer)
- Las API routes de Next.js instancian Prisma directamente con `new PrismaClient({ adapter: new PrismaPg(url) })`
- `migrate dev` no funciona sin TTY — usar `migrate deploy` para aplicar migraciones existentes

**Problema conocido con pnpm + Prisma (IMPORTANTE):**
pnpm aísla los paquetes en un store interno. El client generado por `prisma generate` debe ir directamente al store de pnpm, NO a `node_modules/.prisma/client` (raíz). El `output` en `backend/prisma/schema.prisma` ya está configurado correctamente apuntando al store:
```
output = "../../node_modules/.pnpm/@prisma+client@7.8.0_prisma_56de0e0ff1513c5868510324fbbffcfc/node_modules/.prisma/client"
```
Si después de un `pnpm install` el cliente deja de funcionar, correr `pnpm exec prisma generate` para regenerar en el lugar correcto. Si el hash del path cambia (por actualizar versiones de prisma/`@prisma/client`), actualizar el `output` con el nuevo hash.

**Para agregar campos al schema:**
1. Editar `backend/prisma/schema.prisma`
2. Escribir el SQL en un nuevo archivo `backend/prisma/migrations/<timestamp>_<nombre>/migration.sql`
3. Correr `pnpm exec prisma migrate deploy`
4. Correr `pnpm exec prisma generate`

---

## Mapa de Documentación

| Archivo | Contenido |
|---------|-----------|
| `docs/Proyecto 2026.pdf` | Lineamientos de la materia, requerimientos arquitectónicos obligatorios, criterios de evaluación |
| `docs/Lineamientos_presentacion_final.pdf` | Formato, duración, criterios y checklist de la presentación final |
| `docs/Entregable 1/Documentacion_proyecto.pdf` | Glosario del dominio, RF-01–RF-28, RNF-01–RNF-15 |
| `docs/Entregable 1/Diagrama_entidad-relacion.pdf` | DER con entidades del dominio |
| `docs/Entregable 2/Diagrama_de_contexto.pdf` | Interacciones del sistema con usuarios y sistemas externos |
| `docs/Entregable 2/Diagrama_de_contenedores.pdf` | Arquitectura distribuida: frontend, backend, DB |
| `docs/Entregable 2/Diagrama_de_componentes.pdf` | Componentes internos: Login API, Estadísticas API, Turnos API, Pagos API |
| `docs/Entregable 3/Modelo_de_datos.pdf` | Modelo relacional con todas las tablas |
| `docs/Entregable 3/Diccionario_de_datos.pdf` | Descripción de tablas, tipos, reglas de negocio |
| `docs/Entregable 4/ADRs/ADR-001.pdf` | Monolito modular como estrategia de organización del backend |
| `docs/Entregable 4/ADRs/ADR-002.pdf` | PostgreSQL como estrategia de persistencia |
| `docs/Entregable 4/ADRs/ADR-003.pdf` | API REST sobre HTTP con JSON como comunicación entre componentes |
| `docs/Entregable 4/ADRs/ADR-004.pdf` | Plataforma cloud administrada (Vercel) como estrategia de despliegue |
| `docs/Entregable 4/ADRs/ADR-005.pdf` | Mercado Pago como estrategia de procesamiento de pagos electrónicos |
| `docs/Entregable 4/API.yaml` | Diseño completo de la API REST (OpenAPI/Swagger) |
| `docs/Entregable 4/PIPES/` | Pipelines: Reservas, Pagos, Notificaciones, Inasistencias, Estadísticas, Búsqueda Equipo |
| **Casos de uso** (`docs/Entregable 1/CU/`) | |
| `CU-01` | Crear cuenta (usuario cliente) |
| `CU-02` | Iniciar sesión |
| `CU-03` | Cerrar sesión |
| `CU-04` | Ver cuenta |
| `CU-05` | Modificar cuenta |
| `CU-06` | Reservar turno |
| `CU-07` | Cancelar turno |
| `CU-08` | Pagar turno |
| `CU-09` | Ver ubicación del complejo |
| `CU-10` | Ver canchas disponibles |
| `CU-11` | Buscar jugador (publicar solicitud de jugadores) |
| `CU-12` | Reportar complejo (comentario/reporte) |
| `CU-13` | Solicitar equipamiento en reserva |
| `CU-14` | Buscar equipo (unirse a reserva abierta) |
| `CU-15` | Crear cuenta (administrador) |
| `CU-16` | Agregar cancha |
| `CU-17` | Eliminar cancha |
| `CU-17.1` | Editar info. cancha |
| `CU-18` | Agregar complejo |
| `CU-19` | Eliminar complejo |
| `CU-19.1` | Editar info. complejo |
| `CU-20` | Notificar estado de cancha (marcar como no disponible) |
| `CU-21` | Registrar inasistencia del usuario cliente |
| `CU-22` | Gestionar inventario de equipamiento |
| `CU-23` | Consultar estadísticas del complejo |
| `CU-24` | Registrar reserva manual (presencial) |
| `CU-25` | Consultar disponibilidad de canchas |
| `CU-26` | Crear cuenta (auxiliar) |

---

## Modelo de Datos Resumido

| Tabla | PK | Relaciones clave |
|-------|----|-----------------|
| `Usuario` | `email` | superclase; rol: `admin\|auxiliar\|cliente`; `clerk_user_id` UNIQUE (auth via Clerk) |
| `Cliente` | `email` (FK→Usuario) | herencia 1:1 de Usuario |
| `Auxiliar` | `email` (FK→Usuario) | FK→Complejo |
| `Complejo` | `id_complejo` | FK→Usuario (`email_administrador`) |
| `Cancha` | `id_cancha` | FK→Complejo; `estado_operativo`: `disponible\|ocupada\|en mantenimiento` |
| `Reserva` | `id_reserva` | FK→Cancha, FK→Cliente; `tipo_partido`: `abierto\|cerrado`; `cupos_disponibles` nullable (null si cerrado) |
| `Pago` | `id_pago` | FK→Reserva |
| `Equipamiento` | `id_equipamiento` | FK→Complejo; campos: `stock`, `stock_disponible` |
| `ReservaEquipamiento` | `(id_reserva, id_equipamiento)` | tabla asociativa M:N |
| `Reseña` | `id_reseña` | FK→Cliente, FK→Cancha; calificacion 1–5 |
| `Inasistencia` | `id_inasistencia` | FK→Cliente; tiene `fecha_caducidad` |

Patrón de herencia: **Class Table Inheritance** (garantiza 3FN).

---

## Casos de Uso — Tabla Resumen

| ID | Nombre | Actor principal |
|----|--------|----------------|
| CU-01 | Crear cuenta (cliente) | Usuario cliente |
| CU-02 | Iniciar sesión | Cliente / Auxiliar / Admin |
| CU-03 | Cerrar sesión | Cliente / Auxiliar / Admin |
| CU-04 | Ver cuenta | Cliente / Auxiliar / Admin |
| CU-05 | Modificar cuenta | Cliente / Auxiliar / Admin |
| CU-06 | Reservar turno | Usuario cliente |
| CU-07 | Cancelar turno | Usuario cliente |
| CU-08 | Pagar turno | Usuario cliente |
| CU-09 | Ver ubicación del complejo | Usuario cliente |
| CU-10 | Ver canchas disponibles | Usuario cliente |
| CU-11 | Buscar jugador | Usuario cliente |
| CU-12 | Reportar complejo | Usuario cliente |
| CU-13 | Solicitar equipamiento | Usuario cliente |
| CU-14 | Buscar equipo | Usuario cliente |
| CU-15 | Crear cuenta (admin) | Administrador |
| CU-16 | Agregar cancha | Administrador |
| CU-17 | Eliminar cancha | Administrador |
| CU-17.1 | Editar info. cancha | Administrador |
| CU-18 | Agregar complejo | Administrador |
| CU-19 | Eliminar complejo | Administrador |
| CU-19.1 | Editar info. complejo | Administrador |
| CU-20 | Notificar estado de cancha | Admin / Auxiliar |
| CU-21 | Registrar inasistencia | Admin / Auxiliar |
| CU-22 | Gestionar inventario | Admin / Auxiliar |
| CU-23 | Consultar estadísticas | Administrador |
| CU-24 | Registrar reserva manual | Admin / Auxiliar |
| CU-25 | Consultar disponibilidad | Admin / Auxiliar |
| CU-26 | Crear cuenta (auxiliar) | Administrador |

---

## Reglas de Negocio Importantes

- **Sin superposición:** no pueden existir dos reservas para la misma cancha en el mismo horario (RNF-06).
- **Horario de funcionamiento:** las reservas solo se pueden crear dentro del `horario_apertura`–`horario_cierre` de la cancha (RNF-15).
- **Cancelación con límite:** solo se puede cancelar una reserva hasta un tiempo máximo previo al inicio del turno (RNF-12).
- **Stock de equipamiento:** `stock_disponible` ≤ `stock`; nunca puede quedar negativo (RNF-14).
- **Penalizaciones por inasistencia:** las inasistencias se acumulan; superado un umbral dentro del período de `fecha_caducidad`, se aplica penalización al cliente (RF-28, RNF-13).
- **Rol en reserva:** `email_cliente` en Reserva debe apuntar a un Usuario con `rol = 'cliente'`.
- **Calificaciones:** el campo `calificacion` en Reseña acepta solo valores entre 1 y 5.
- **Un administrador puede gestionar múltiples complejos.**
- **Un auxiliar pertenece a un único complejo** (`id_complejo` NOT NULL).

---

## Decisiones Arquitectónicas (ADRs)

| ID | Título | Decisión tomada |
|----|--------|----------------|
| ADR-001 | Organización del backend | **Monolito modular** — lógica organizada por dominios funcionales (usuarios, reservas, canchas, pagos, equipamiento). Descartados: monolito sin modularizar (acoplamiento) y microservicios (complejidad innecesaria para el equipo). |
| ADR-002 | Persistencia de datos | **PostgreSQL** único — dominio fuertemente relacional, transacciones ACID para reservas, integración nativa con Prisma. Descartados: MongoDB (relaciones complejas) y MySQL (menor integración). |
| ADR-003 | Comunicación entre componentes | **API REST sobre HTTP + JSON** — simplicidad, compatibilidad web estándar, fácil documentación. Descartados: GraphQL (mayor complejidad) y eventos (infraestructura adicional). |
| ADR-004 | Despliegue y alojamiento | **Plataforma cloud administrada (Vercel + Neon)** — despliegue rápido, acceso remoto permanente, mínima carga operativa. Descartadas: infraestructura propia (carga administrativa) y VPS (configuración continua). |
| ADR-005 | Procesamiento de pagos | **Mercado Pago** — plataforma ampliamente usada en Argentina, evita almacenar datos financieros sensibles, APIs maduras. Descartados: procesamiento propio (riesgos de seguridad) e integración múltiple (complejidad). |

---

## Pipelines de Datos (Entregable 4)

Seis pipelines documentados en `docs/Entregable 4/PIPES/`:

| Pipeline | Descripción |
|----------|-------------|
| PP - Reservas | Flujo de creación, validación y confirmación de reservas |
| PP - Pagos | Flujo de pago vía Mercado Pago, webhook de confirmación |
| PP - Gestión de Notificaciones | Envío de emails ante confirmación/cancelación/búsqueda de equipo |
| PP - Inasistencias y Penalización | Registro de inasistencias y aplicación de penalizaciones al cliente |
| PP - Generacion Estadísticas | Agregación de datos de reservas para estadísticas del complejo |
| PP - Busqueda Equipo | Flujo de publicación y unión a partidos abiertos |

---

## Convenciones de Código

- **TypeScript estricto** (`strict: true` en tsconfig).
- Nombres de variables de dominio **en español**: `reserva`, `cancha`, `complejo`, `equipamiento`, `inasistencia`.
- Comentarios **en español**.
- Seguir principios **SOLID** (requisito de evaluación de la materia).
- Seguir las convenciones del App Router de Next.js (Server Components por defecto, Client Components solo cuando necesario).
- Leer `node_modules/next/dist/docs/` ante dudas sobre la versión actual de Next.js (ver AGENTS.md).

---

## Comandos Útiles

```bash
# Desarrollo
pnpm run dev          # Next.js en modo desarrollo (puerto 3000)
pnpm run build        # Build de producción
pnpm run lint         # ESLint

# Prisma (ejecutar desde raíz o desde backend/)
pnpm exec prisma migrate dev      # Crear y aplicar migración
pnpm exec prisma migrate deploy   # Aplicar migraciones en producción
pnpm exec prisma generate         # Regenerar cliente Prisma
pnpm exec prisma studio           # UI visual de la base de datos
pnpm exec prisma db push          # Push del schema sin migración (dev rápido)
```
