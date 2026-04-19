# Epics — Migración a Monorepo

> Paso 4 del flujo BMAD (`shard`). Cada epic del `docs/prd.md` queda detallado en un archivo propio con stories accionables. Este README es el índice y documenta el orden de ejecución.

## Orden de ejecución

Diferente del orden numérico del PRD. La justificación está en `docs/prd.md §6` y en `docs/architecture.md §5`: la higiene técnica se adelanta para no cargar el refactor de tipos con deuda existente.

| # | Orden | Epic | Dependencias | Bloquea |
|---|---|---|---|---|
| 1 | 1° | [Epic 1 — Fundaciones](./epic-1-foundations.md) | — | 2, 3, 4, 5, 6 |
| 6 | 2° | [Epic 6 — Higiene técnica](./epic-6-hygiene.md) | 1 | 2, 3 |
| 2 | 3° | [Epic 2 — `@gaston/api-types`](./epic-2-api-types.md) | 1, 6 | 3 |
| 3 | 4° | [Epic 3 — `@gaston/api-client`](./epic-3-api-client.md) | 2 | 4 |
| 4 | 5° | [Epic 4 — Shells web y app](./epic-4-shells.md) | 3 | 5 (parcial) |
| 5 | 6° | [Epic 5 — CI/CD y deploy](./epic-5-ci-cd.md) | 1, 4 | — |

## Resumen por epic

- **Epic 1 — Fundaciones**: mueve el backend a `apps/backend/`, monta pnpm+Turbo, hoistea devDeps comunes, valida sin regresiones. 5 stories.
- **Epic 6 — Higiene técnica**: dropea `User.profileImage` en DB, rompe `forwardRef` Auth↔User, saca CORS a env, centraliza config de cookies, introduce smoke specs. 5 stories.
- **Epic 2 — `@gaston/api-types`**: scaffoldea el paquete, extrae DTOs de auth/transaction/category/user, desacopla `TransactionType` de Prisma, tipa `ApiResponse<T>`, rewirea backend. 6 stories.
- **Epic 3 — `@gaston/api-client`**: scaffoldea el paquete, diseña `createApiClient` y transport, implementa endpoints por namespace, normaliza errores, smoke test. 8 stories.
- **Epic 4 — Shells**: scaffold de `apps/web` (Next.js) y `apps/app` (Expo), config de Metro para workspaces, wiring con el cliente, decisión e implementación del adapter de auth para RN. 6 stories.
- **Epic 5 — CI/CD y deploy**: GitHub Actions, preservación del deploy del backend, deploy de web, documentación de env vars, (opcional) EAS para app. 5 stories.

**Total**: 35 stories.

## Convenciones

- Cada story tiene: `Status` (Draft | Approved | InProgress | Done), user story, acceptance criteria numerados, tareas, dev notes con referencias a PRD/arquitectura, y dependencias.
- Una story no arranca hasta que sus dependencias estén en `Done`.
- Cambios de scope se reflejan en PRD/arquitectura primero, luego se regenera la story afectada.
- `docs/decisions/` es el lugar para decisiones arquitectónicas que surjan durante la ejecución (ADR-style light).

## Estado actual

Todas las stories están en `Status: Draft`. Aún no se ha arrancado la ejecución (el usuario pausó el desarrollo antes del paso 5 de BMAD).
