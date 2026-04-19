# Epic 3 — Cliente HTTP `@gaston/api-client`

> Construye el cliente HTTP tipado que cubre toda la superficie de la API, agnóstico del runtime (browser, RN, Node), consumiendo los tipos de `@gaston/api-types`.

**Referencias**: `docs/prd.md §6 Epic 3`, `docs/architecture.md §4.2, §5 Fase 4`
**Dependencias**: Epic 2
**Bloquea**: Epic 4

**Criterio de done del epic**: `packages/api-client` compila, typechequea contra `@gaston/api-types`, cubre los 22 endpoints documentados en `docs/brownfield-architecture.md §4`, y tiene una prueba de humo contra un backend mockeado.

---

## Story 3.1 — Scaffold de `packages/api-client`

**Status**: Draft

**Story**
Como dev, quiero el paquete `@gaston/api-client` configurado con build dual y sin deps runtime obligatorias, para que lo consuman backend, web y app sin arrastrar librerías extra.

**Acceptance criteria**
1. Existe `packages/api-client/package.json` con `"name": "@gaston/api-client"`, exports map, dep `@gaston/api-types: workspace:*`.
2. Existe `packages/api-client/tsup.config.ts` (CJS+ESM+dts).
3. Ninguna dep runtime obligatoria (no `axios`, no `node-fetch`); se asume `fetch` global (Node ≥18, browser, RN ≥0.72).
4. `pnpm --filter @gaston/api-client build` genera los artefactos.
5. Existe `src/index.ts` con placeholder que exporta `createApiClient`.

**Tareas**
- [ ] Crear estructura.
- [ ] Configurar tsup.
- [ ] Exportar placeholder.
- [ ] Build.

**Dev notes**
- `docs/architecture.md §4.2` tiene el shape tentativo de `ApiClientConfig` — arrancar con ese.

**Dependencias**: Epic 2 completo.

---

## Story 3.2 — Diseñar `ApiClientConfig` y transport base

**Status**: Draft

**Story**
Como dev, quiero una función `createApiClient(config)` que centralice baseUrl, headers, auth y manejo de errores, antes de implementar endpoints individuales.

**Acceptance criteria**
1. `ApiClientConfig` expone: `baseUrl`, `environment: 'prod' | 'dev'`, `fetch?` (inyectable), `getAuthHeaders?`, `onUnauthorized?`.
2. Existe un helper interno `request<T>(path, options)` que:
   - Agrega `X-environment` según `config.environment`.
   - Agrega `Content-Type: application/json` salvo override.
   - Invoca `config.fetch ?? globalThis.fetch`.
   - Invoca `config.getAuthHeaders` si está definido y merge con headers default.
   - Parsea la response y desenvuelve el wrapper `ApiResponse<T>` del `@gaston/api-types` devolviendo `data`.
3. Si la response es 401, invoca `config.onUnauthorized()` antes de lanzar.
4. Existe `createApiClient(config)` que devuelve un objeto con sub-namespaces: `{ auth, user, transactions, categories }` — por ahora vacíos, se llenan en stories siguientes.

**Tareas**
- [ ] Implementar `request<T>`.
- [ ] Implementar `createApiClient` con stubs.
- [ ] Unit test básico de `request` con fetch mockeado.

**Dev notes**
- `CR4` del PRD exige preservar el header `X-environment`.
- La estrategia de cookies vs Bearer queda para la Story 4.6; por ahora el cliente solo hace `credentials: 'include'` en el fetch por default, y permite override.

**Dependencias**: Story 3.1.

---

## Story 3.3 — Endpoints de auth

**Status**: Draft

**Story**
Como dev, quiero el sub-namespace `client.auth` con todos los endpoints de autenticación, tipados.

**Acceptance criteria**
1. `client.auth` expone: `signup(body)`, `signin(body)`, `refresh()`, `logout()`, `status()`, `changePassword(body)`.
2. Cada método tipa params con el DTO de `@gaston/api-types` y el return con el response type correspondiente.
3. Los paths y métodos HTTP coinciden 1:1 con `docs/brownfield-architecture.md §4`.
4. Unit tests con fetch mockeado cubren happy path de cada método.

**Tareas**
- [ ] Implementar cada método.
- [ ] Escribir mocks de fetch.
- [ ] Tests.

**Dev notes**
- `refresh()` no lleva body en la request actual del backend (usa refresh token de cookie). Si Epic 6 consolida change-password en `/auth`, mantener el endpoint ahí.

**Dependencias**: Story 3.2.

---

## Story 3.4 — Endpoints de transactions

**Status**: Draft

**Story**
Como dev, quiero `client.transactions` con CRUD + summary tipados.

**Acceptance criteria**
1. `client.transactions` expone: `create(body)`, `findAll()`, `findOne(id)`, `update(id, body)`, `remove(id)`, `summary()`.
2. Return types usan `TransactionResponse` y `TransactionSummaryResponse` de `@gaston/api-types`.
3. Unit tests de happy path.

**Tareas**
- [ ] Implementar.
- [ ] Tests.

**Dev notes**
- Ningún query param actualmente; si Epic siguientes agregan filtros/paginación, este cliente se extiende en otra iteración.

**Dependencias**: Story 3.3.

---

## Story 3.5 — Endpoints de categories

**Status**: Draft

**Story**
Como dev, quiero `client.categories` con CRUD tipado.

**Acceptance criteria**
1. `client.categories` expone: `create(body)`, `findAll()`, `findOne(id)`, `update(id, body)`, `remove(id)`.
2. Tipos correctos.
3. Unit tests.

**Tareas**
- [ ] Implementar.
- [ ] Tests.

**Dependencias**: Story 3.4.

---

## Story 3.6 — Endpoints de user

**Status**: Draft

**Story**
Como dev, quiero `client.user` con profile y change-password.

**Acceptance criteria**
1. `client.user` expone: `getProfile()`, `updateProfile(body)`, `changePassword(body)` — o sólo los que queden post-Epic-6 (si se consolidó change-password en /auth, acá no va).
2. `updateProfile` ya no maneja multipart (se eliminó en el cleanup de Cloudinary).
3. Tests.

**Tareas**
- [ ] Implementar.
- [ ] Tests.

**Dependencias**: Story 3.5.

---

## Story 3.7 — Normalización de errores

**Status**: Draft

**Story**
Como dev, quiero que el cliente convierta errores HTTP en una clase `ApiError` con info estructurada, para que los consumidores no tengan que parsear el body ni distinguir por `instanceof` genéricos.

**Acceptance criteria**
1. Existe `class ApiError extends Error` con `status: number`, `code?: string`, `body?: unknown`.
2. Cualquier response con `status >= 400` lanza `ApiError` poblando `status` y `body`.
3. Errores de red (fetch rejection) se preservan como están; no se envuelven en `ApiError`.
4. Unit tests cubren al menos: 401, 404, 500.

**Tareas**
- [ ] Implementar `ApiError`.
- [ ] Integrar en `request<T>`.
- [ ] Tests.

**Dev notes**
- `ApiError` puede vivir en `api-client` o en `api-types`. Recomendación: en `api-client` porque tiene runtime (clase).

**Dependencias**: Story 3.2.

---

## Story 3.8 — Smoke test del cliente contra un backend local

**Status**: Draft

**Story**
Como dev, quiero un test que instancia `createApiClient` apuntando a un backend local (o mockeado con `msw`) y hace signup → signin → create transaction → summary, para validar que el cliente funciona end-to-end.

**Acceptance criteria**
1. Existe `packages/api-client/test/smoke.spec.ts`.
2. Usa `msw` o un `backend` montado en un beforeAll (preferible msw para no necesitar DB en CI).
3. El test pasa en `pnpm --filter @gaston/api-client test`.

**Tareas**
- [ ] Decidir msw vs supertest contra app real.
- [ ] Escribir test.

**Dev notes**
- msw no arrastra deps al bundle del cliente (solo es devDep del paquete).

**Dependencias**: Story 3.7.
