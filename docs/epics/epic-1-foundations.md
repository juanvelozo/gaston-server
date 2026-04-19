# Epic 1 — Fundaciones del monorepo

> Relocaliza el backend actual dentro de `apps/backend/`, monta workspaces con pnpm y Turborepo, y deja la raíz lista para recibir web, app y paquetes compartidos. Sin cambios funcionales.

**Referencias**: `docs/prd.md §6 Epic 1`, `docs/architecture.md §2, §3, §5 Fases 0–1`
**Dependencias**: ninguna
**Bloquea**: Epic 2, Epic 3, Epic 4, Epic 5, Epic 6

**Criterio de done del epic**: `pnpm --filter backend dev` levanta el servidor y `pnpm build && pnpm lint && pnpm typecheck` pasan desde la raíz sin regresiones funcionales.

---

## Story 1.1 — Baseline y smoke tests pre-migración

**Status**: Draft

**Story**
Como dev responsable de la migración, quiero capturar métricas y el comportamiento actual del backend antes de tocar la estructura, para detectar regresiones en fases posteriores.

**Acceptance criteria**
1. `docs/smoke-tests.md` documenta el paso a paso para validar manualmente: signup, signin, refresh, logout, status, change-password, CRUD de transactions, `/transactions/summary`, CRUD de categories, get/update profile.
2. Cada smoke incluye request de ejemplo (curl o httpie) y response esperado (status + shape).
3. Se registra el tiempo de `npm run build` y de `npm run start:dev` (cold y warm) en `docs/smoke-tests.md` como baseline para NFR7.
4. La lista se corre una vez contra el backend actual y se marca pass/fail; ninguna corrección de bugs se incluye en esta story.

**Tareas**
- [ ] Redactar smoke tests por módulo (auth, user, transaction, category).
- [ ] Medir tiempo de build y start cold/warm (3 corridas, tomar mediana).
- [ ] Correr la suite manualmente con un usuario de prueba en la DB de dev.

**Dev notes**
- El backend actual está en la raíz; las pruebas corren con `npm run start:dev`.
- La cookie config en dev no expira (ver `docs/brownfield-architecture.md §5`), así que se puede reusar la misma sesión en varios smokes.

**Dependencias**: ninguna.

---

## Story 1.2 — Bootstrap de pnpm workspace + Turborepo en la raíz

**Status**: Draft

**Story**
Como dev, quiero una raíz de monorepo configurada con pnpm workspaces y Turborepo, para alojar backend + apps + packages bajo un solo lockfile.

**Acceptance criteria**
1. Existe `pnpm-workspace.yaml` con globs `apps/*` y `packages/*`.
2. Existe `package.json` raíz con `"private": true`, `packageManager` pinneado a pnpm, `engines.node` pinneado a la versión productiva, y scripts `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `db:generate`, `db:migrate`.
3. Existe `turbo.json` con tasks `build`, `dev`, `lint`, `typecheck`, `test` según `docs/architecture.md §3`.
4. Existe `tsconfig.base.json` con las compilerOptions comunes.
5. Existe `.nvmrc` con la misma versión que `engines.node`.
6. Existe `eslint.config.mjs` y `.prettierrc` en la raíz, tomados del backend actual.
7. `pnpm install` en la raíz no falla y produce un único `pnpm-lock.yaml`.

**Tareas**
- [ ] Escribir `pnpm-workspace.yaml`.
- [ ] Escribir `package.json` raíz (solo devDeps comunes: typescript, prettier, eslint, typescript-eslint, turbo).
- [ ] Escribir `turbo.json`.
- [ ] Escribir `tsconfig.base.json` replicando `tsconfig.json` actual del backend.
- [ ] Migrar `.prettierrc`, `.prettierignore`, `eslint.config.mjs` del backend a la raíz.
- [ ] `pnpm install` desde la raíz.

**Dev notes**
- No mover aún los archivos del backend. Esta story solo siembra la raíz; el backend sigue en `/src` hasta la story 1.3.
- El `package-lock.json` actual se borra al final de esta story (queda reemplazado por `pnpm-lock.yaml`).

**Dependencias**: Story 1.1.

---

## Story 1.3 — Relocación del backend a `apps/backend/`

**Status**: Draft

**Story**
Como dev, quiero mover el código del backend a `apps/backend/` preservando historia de git, para que viva como un paquete más del workspace.

**Acceptance criteria**
1. Todos los archivos del backend (`src/`, `prisma/`, `test/` si existe, `nest-cli.json`, `package.json`, `tsconfig.json`, `tsconfig.build.json`) quedan bajo `apps/backend/` vía `git mv`.
2. El contenido de `docs/` permanece en la raíz (no se mueve).
3. El `README.md` de la raíz se reemplaza por uno del monorepo (ver story 1.5); el template de Nest desaparece.
4. `apps/backend/package.json` mantiene `"name": "backend"`.
5. `apps/backend/tsconfig.json` extiende `../../tsconfig.base.json`.
6. El script `deploydb:dev` sigue funcionando (las rutas relativas a `prisma/` resuelven porque está en el mismo paquete).
7. `git log --follow apps/backend/src/main.ts` muestra la historia completa desde el commit inicial.

**Tareas**
- [ ] `git mv` de cada archivo/directorio listado.
- [ ] Ajustar `apps/backend/tsconfig.json` para extender la base.
- [ ] Eliminar `package-lock.json` si quedó; renombrar `.prettierignore` y `eslint.config.mjs` en el backend para que extiendan los de la raíz.
- [ ] Verificar imports: todos son relativos (`./`, `src/`) o con path mappings existentes; no debería haber ajustes.

**Dev notes**
- NestJS resuelve `src/...` como path base; ese path queda igual porque `src/` sigue siendo el source root del paquete `apps/backend`.
- Si Nest rompe por no encontrar `tsconfig.build.json`, es porque la path en `nest-cli.json` es relativa al `package.json` del paquete — debería seguir funcionando sin cambios.

**Dependencias**: Story 1.2.

---

## Story 1.4 — Hoist de devDeps compartidas a la raíz

**Status**: Draft

**Story**
Como dev, quiero que las herramientas cross-cutting (TypeScript, Prettier, ESLint, typescript-eslint) vivan en el `package.json` raíz, para evitar versiones divergentes entre paquetes.

**Acceptance criteria**
1. `apps/backend/package.json` deja de declarar `typescript`, `prettier`, `eslint`, `typescript-eslint`, `@eslint/js`, `@eslint/eslintrc`, `eslint-config-prettier`, `eslint-plugin-prettier`, `globals`.
2. Esas deps viven en el `package.json` raíz con las mismas versiones actuales del backend.
3. `pnpm install` desde la raíz no produce warnings de "multiple versions of X".
4. `pnpm --filter backend run lint` y `pnpm --filter backend run build` siguen pasando.

**Tareas**
- [ ] Mover deps del backend a la raíz.
- [ ] `pnpm install`.
- [ ] Verificar lint y build.

**Dev notes**
- `@swc/cli` y `@swc/core` quedan en el backend (son específicos del build de Nest).
- `jest`, `ts-jest`, `@types/jest`, `@types/supertest`, `supertest`, `@nestjs/testing` quedan en el backend (testing local al paquete).
- `ts-node`, `ts-loader`, `tsconfig-paths` quedan en el backend (usados por Nest).

**Dependencias**: Story 1.3.

---

## Story 1.5 — Validación end-to-end de la fase 1

**Status**: Draft

**Story**
Como dev, quiero correr el backend desde el monorepo y reproducir los smoke tests de la story 1.1, para confirmar que no hay regresiones antes de avanzar a epics siguientes.

**Acceptance criteria**
1. `pnpm --filter backend dev` levanta el servidor y responde a `GET /` con el mismo hello actual.
2. Los smoke tests de `docs/smoke-tests.md` se vuelven a correr todos pasan.
3. Tiempo de build post-migración no excede el baseline +20% (NFR7).
4. Se escribe un `README.md` en la raíz del monorepo describiendo: estructura, scripts principales, requisitos de Node/pnpm, cómo correr el backend.
5. Queda un commit limpio que corresponde a "fin de Fase 1 / Epic 1".

**Tareas**
- [ ] Correr smoke tests.
- [ ] Medir build y comparar con baseline.
- [ ] Escribir `README.md` raíz.
- [ ] Commit.

**Dev notes**
- Criterio de corte del PRD: si alguno de estos falla, no avanzar al Epic 6/2.

**Dependencias**: Story 1.4.
