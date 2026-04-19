# PRD — Migración a Monorepo (Gaston)

> Paso 2 del flujo BMAD (`create-brownfield-prd`). Input: `docs/brownfield-architecture.md`. Este PRD define el scope, requisitos y criterios de éxito de la migración del backend actual a un monorepo que además albergará la web y la app.

## 1. Contexto

### 1.1 Punto de partida
- Repositorio actual: `gaston-server` — backend NestJS 11 + Prisma 6 sobre PostgreSQL.
- Dominio: gestión de finanzas personales (usuarios, transacciones `INCOME`/`EXPENSE`, categorías).
- Clientes productivos conocidos (vía CORS en `src/main.ts`): `https://gastonfinance.vercel.app` (web) y un canister ICP. No hay app móvil productiva todavía.
- Web y app se desarrollan hoy (o se desarrollarán) en repos separados, sin tipos compartidos ni cliente HTTP tipado.

### 1.2 Problema que resuelve el cambio
- **Drift de tipos**: DTOs del backend se copian/adivinan desde web y app; romper un contrato es silencioso hasta runtime.
- **Duplicación de cliente HTTP**: cada frontend arma su propio fetch wrapper con su propia interpretación del `TransformResponseInterceptor` y del flujo de cookies de auth.
- **Fricción de release**: cambios que cruzan backend + front obligan a coordinar PRs en repos separados, sin CI conjunta.
- **Onboarding**: un dev nuevo tiene que clonar N repos y reconstruir el mapa mental de qué consume qué.

### 1.3 Objetivos
1. Un único repositorio que aloje `backend`, `web` y `app` con historial unificado.
2. Tipos y cliente HTTP compartidos, derivados de una sola fuente de verdad.
3. CI única que valide el conjunto (lint, typecheck, tests) y deploys independientes por app.
4. Migración sin regresión funcional del backend productivo — los endpoints, contratos y el deploy actual deben seguir funcionando sin intervención desde web/ICP.

### 1.4 Fuera de alcance
- No se incorporan nuevas features de producto.
- No se migra la base de datos ni se cambia el esquema Prisma (la única modificación pendiente es dropear la columna `User.profileImage`, producto de la remoción de la feature de upload — ver §1.5).
- No se reemplaza PostgreSQL ni la estrategia JWT+cookies.
- No se define ahora la arquitectura interna de web ni de app (solo el contenedor y los paquetes compartidos que consumirán).
- No se cambia la plataforma de deploy actual del backend; si hoy se despliega desde este repo a algún host, el monorepo debe preservar ese pipeline.

### 1.5 Cambios de scope previos a la migración
- **Feature de imagen de perfil descartada**: eliminada del código (módulo `cloudinary/`, multipart en `PATCH /user/profile`, campo `User.profileImage`, deps `cloudinary`/`multer*`). La migración Prisma que dropea la columna debe correrse antes o durante la fase 1 del monorepo.

## 2. Requisitos funcionales (FR)

**FR1 — Estructura monorepo**
El repositorio debe exponer `apps/backend`, `apps/web`, `apps/app` y un directorio `packages/*` para código compartido. Cada app debe poder construirse y correrse de forma independiente desde la raíz (`pnpm --filter backend dev`, etc.).

**FR2 — Preservación de la API actual**
Todos los endpoints documentados en `docs/brownfield-architecture.md §4` deben funcionar con el mismo path, método HTTP, shape de request/response, cookies y códigos de estado que hoy. Cualquier cambio de contrato es fuera de scope de la migración.

**FR3 — Preservación del modelo de datos**
El `schema.prisma` y las 7 migraciones existentes se conservan tal cual. La ubicación del directorio `prisma/` puede cambiar dentro del monorepo, pero el contenido no.

**FR4 — Paquete de tipos compartidos (`@gaston/api-types`)**
Debe exponer:
- DTOs de request (Signup, Signin, Transaction, Category, UpdateProfile, ChangePassword).
- Tipos de entidad response (User, Transaction, Category).
- Enum `TransactionType` desacoplado de `@prisma/client` (para no forzar a web/app a depender de Prisma).
- Tipo del wrapper de response generado por `TransformResponseInterceptor`.
- Tipo `JwtPayload`.

**FR5 — Cliente HTTP compartido (`@gaston/api-client`)**
Debe exponer un cliente tipado cubriendo los endpoints actuales, consumiendo los tipos de `@gaston/api-types`. El cliente debe ser agnóstico del entorno (navegador, React Native, Node test) — sin asumir `window` ni `document`.

**FR6 — Convivencia con deploy actual**
Debe existir un camino para que el host actual del backend (Railway/Render/Fly/Vercel Functions, lo que sea) pueda seguir apuntando al mismo código sin reconfiguración masiva. Si el host requiere `package.json` y `prisma/` en la raíz del directorio desplegado, la estrategia debe contemplarlo (build del monorepo que genere un artefacto consumible, o path de subproyecto configurable).

**FR7 — Scripts raíz**
Desde la raíz del monorepo debe haber scripts para: `dev` (levanta todo lo necesario), `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:generate`.

## 3. Requisitos no funcionales (NFR)

**NFR1 — Regresión cero en el backend**
Al finalizar la migración, correr la suite de smoke tests manual (signin/signup/CRUD transactions/categories) debe dar idéntico resultado a antes.

**NFR2 — Build incremental y caché**
Cambios aislados en una app no deben disparar rebuild completo del resto. El tooling elegido (Turborepo o equivalente) debe proveer caché por paquete.

**NFR3 — Instalación única**
`pnpm install` en la raíz debe instalar las dependencias de todos los paquetes y apps. No debe existir un segundo lockfile por sub-proyecto.

**NFR4 — Typecheck cruzado**
Cambiar un tipo en `packages/api-types` debe fallar en typecheck en `apps/backend`, `apps/web` y `apps/app` si hay consumidores desincronizados. No se permite comparar por nombre/string.

**NFR5 — Compatibilidad de versiones de TS**
Todos los paquetes y apps deben alinear versión de TypeScript (actualmente 5.7.3 en backend) para evitar divergencia de features y de diagnostics.

**NFR6 — Estándares preservados**
ESLint y Prettier del backend actual deben quedar como base; web y app pueden extender pero no relajar las reglas del paquete de tipos compartidos.

**NFR7 — Tiempo de build local**
El warm build del backend en el monorepo no debe ser más de un 20% más lento que hoy (baseline a medir antes de migrar).

## 4. Requisitos de compatibilidad

**CR1 — Contratos de API congelados durante la migración**
Ningún endpoint cambia de path, método, shape, o comportamiento durante la migración. Rehacer contratos es una feature separada.

**CR2 — Cookies y CORS**
Las cookies `access_token` y `refresh_token` (HttpOnly, `sameSite: 'none'`, `secure` en prod) y la lista de orígenes CORS deben seguir funcionando con los clientes productivos existentes (`gastonfinance.vercel.app`, canister ICP).

**CR3 — Variables de entorno**
Las env vars actuales (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`) siguen siendo las únicas requeridas para correr el backend. Si el monorepo introduce nuevas, deben ser opcionales con defaults sanos para dev.

**CR4 — Header `X-environment`**
El contrato actual del header `X-environment` (prod/dev) se preserva; los clientes lo siguen enviando igual.

**CR5 — Migraciones Prisma**
El flujo `npx prisma migrate` debe seguir funcionando desde el monorepo apuntando al mismo `DATABASE_URL`. Ningún estado de migración existente se altera.

## 5. Restricciones técnicas

- **Tooling**: decisión delegada a la arquitectura (paso 3). Restricciones: debe soportar workspaces de Node, caché de builds, publishing interno sin registry externo.
- **Gestor de paquetes**: `pnpm` es el candidato por defecto (no lo tenemos como dependencia dura hoy, pero es la elección canónica para monorepos modernos; npm workspaces también es viable pero con menor ergonomía).
- **Node.js**: el backend no pinea versión hoy. La migración es buena ocasión para pinearla a nivel monorepo (`.nvmrc` / `packageManager`).
- **Git**: se preserva historia. Si la migración implica relocalizar todos los archivos del backend a `apps/backend/`, se usa `git mv` para mantener historia de archivos.

## 6. Estructura de epics (alto nivel)

> El detalle de stories se define en un paso posterior (PO shard). Acá solo se listan los epics previstos para fijar el contrato del PRD.

**Epic 1 — Fundaciones del monorepo**
Setup de workspaces, tooling de build/caché, lint/format/typecheck a nivel raíz, CI mínima. Incluye la relocalización del backend a `apps/backend/` sin cambios funcionales.
- Criterio de done: el backend corre con `pnpm --filter backend dev` y pasa `pnpm build && pnpm lint && pnpm typecheck` desde la raíz.

**Epic 2 — Extracción del paquete `@gaston/api-types`**
Mover DTOs y tipos de response a un package interno, refactorizar el backend para consumirlos desde ahí, desacoplar `TransactionType` de Prisma.
- Criterio de done: los tipos viven en `packages/api-types` y el backend los importa sin duplicación.

**Epic 3 — Cliente HTTP `@gaston/api-client`**
Construir un cliente tipado que cubra todos los endpoints, con estrategia de auth (envío/recepción de cookies) configurable por entorno (web vs app).
- Criterio de done: `@gaston/api-client` compila, typechequea contra `@gaston/api-types`, y tiene al menos una prueba de humo en Node.

**Epic 4 — Shells de `apps/web` y `apps/app`**
Esqueletos mínimos de web y app consumiendo `@gaston/api-client`. No incluye features completas; solo bootstrap + una pantalla que llame a `/auth/status`.
- Criterio de done: ambas apps construyen y logran hacer una request autenticada contra un backend local.

**Epic 5 — CI/CD y deploy preservado**
Pipeline unificada (lint/typecheck/test/build por app). Preservar el deploy productivo del backend. Configurar deploys para web y app cuando aplique.
- Criterio de done: push a main corre CI completa; el backend productivo sigue recibiendo deploys sin intervención manual.

**Epic 6 — Higiene técnica acarreada**
Atacar la deuda detectada en la documentación brownfield que bloquea la extracción limpia de tipos/cliente: romper el `forwardRef` Auth↔User, mover CORS a env, centralizar configuración de cookies, sentar bases mínimas de testing (al menos un spec por controller).
- Criterio de done: las 4 observaciones de acoplamiento del documento brownfield quedan resueltas o documentadas como deuda conocida con ticket.

Orden sugerido de ejecución: **1 → 6 → 2 → 3 → 4 → 5**. El epic 6 se adelanta porque limpia el terreno antes de extraer paquetes compartidos.

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Romper el deploy actual del backend | Alto — bloquea a la web productiva | Epic 1 preserva el path de deploy. Configurar el host para apuntar al subproyecto `apps/backend` o generar artefacto standalone antes de apagar el pipeline viejo. |
| Desacople Auth↔User mal ejecutado | Medio — bug de cambio de contraseña | Epic 6 lo aborda antes de extraer tipos, con smoke test manual del flujo. |
| Tipos compartidos filtran detalles internos de Prisma | Medio — acopla frontends al ORM | `@gaston/api-types` define sus propios enums/interfaces; Prisma queda como detalle del backend. |
| Fricción de herramientas entre Nest (CommonJS) y la web/app (ESM) | Medio — importaciones rotas entre paquetes | Elegir formato de build del paquete compartido (dual o CJS con `exports` map) en el doc de arquitectura. |
| Expo/React Native con resolución de módulos hermanos (symlinks en packages) | Medio | Validar early con un hello-world en `apps/app` antes de invertir en el cliente. |
| Lock del package manager en host de deploy | Bajo-medio | Fijar `packageManager` en `package.json` raíz. |
| Drift entre `schema.prisma` y los tipos derivados compartidos | Bajo | Script `db:generate` incluido en scripts raíz y en CI. |

## 8. Criterios de aceptación del PRD

Al cerrar la migración:
1. El repo raíz tiene `apps/backend`, `apps/web`, `apps/app`, `packages/*` y un solo lockfile.
2. `pnpm install && pnpm build && pnpm lint && pnpm typecheck` pasan en limpio desde la raíz.
3. El backend productivo sigue respondiendo con contratos idénticos (smoke test pre/post).
4. Un cambio ejemplar (por ejemplo, agregar un campo a un DTO) compilado en `packages/api-types` rompe el typecheck en los 3 consumidores hasta que se alinean.
5. La documentación en `docs/` refleja la nueva estructura (este PRD + architecture + brownfield quedan linkeados desde un index o README).
