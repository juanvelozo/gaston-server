# Epic 6 — Higiene técnica acarreada

> Resuelve acoplamientos y deuda del backend antes de extraer paquetes compartidos. La idea es que `packages/api-types` y `packages/api-client` nazcan sobre un backend ya "limpio" — tipos portables, config por env, forwardRef roto, smoke tests mínimos.

**Referencias**: `docs/prd.md §6 Epic 6`, `docs/brownfield-architecture.md §8`, `docs/architecture.md §5 Fase 2`
**Dependencias**: Epic 1
**Bloquea**: Epic 2, Epic 3

**Criterio de done del epic**: los cuatro acoplamientos listados en `docs/brownfield-architecture.md §8` están resueltos o documentados como deuda con ticket; la columna `User.profileImage` fue dropeada de la DB; existe al menos un spec por controller.

---

## Story 6.1 — Dropear columna `User.profileImage`

**Status**: Draft

**Story**
Como dev, quiero generar y aplicar la migración Prisma que elimina la columna `profileImage` de `User`, para cerrar el ciclo de la remoción de Cloudinary.

**Acceptance criteria**
1. Se genera una migración (`npm run deploydb:dev` o equivalente) nombrada explícitamente `remove_profile_image`.
2. El `migration.sql` contiene `ALTER TABLE "User" DROP COLUMN "profileImage";` y nada más.
3. La migración corre limpio contra la base de dev.
4. El listado de migraciones en `docs/brownfield-architecture.md §3` se actualiza.
5. Documentar en `docs/smoke-tests.md` que el flujo de `PATCH /user/profile` ya no acepta `file` ni `profileImage` en el body.

**Tareas**
- [ ] Correr `npx prisma migrate dev --name remove_profile_image`.
- [ ] Validar que el SQL generado es el esperado (sin side-effects como renames o backups).
- [ ] Actualizar docs.

**Dev notes**
- El código de aplicación ya fue limpiado (ver commit anterior a esta migración). Esta story cierra el lado de la DB.
- Para prod, aplicar con `npx prisma migrate deploy` en el pipeline de deploy.

**Dependencias**: Epic 1 completo.

---

## Story 6.2 — Romper `forwardRef` entre `AuthModule` y `UserModule`

**Status**: Draft

**Story**
Como dev, quiero eliminar la dependencia circular entre Auth y User, para que la lógica de tokens sea portable y no arrastre al User al compartir tipos.

**Acceptance criteria**
1. `AuthModule` y `UserModule` ya no se importan mutuamente con `forwardRef`.
2. La funcionalidad de `changePassword` (que hoy cruza ambos módulos: `UserService.changePassword` llama a `AuthService.getTokens` y `updateRefreshTokenHash`) sigue funcionando idéntica desde el punto de vista del cliente.
3. Una de estas dos aproximaciones queda implementada:
   - **A**: Extraer `getTokens` y `updateRefreshTokenHash` a un `TokensService` en `src/auth/` sin dependencia de `UserModule`; `UserModule` importa solo `TokensService`.
   - **B**: Consolidar `changePassword` en `AuthController` (ya existe un endpoint equivalente allí: `PATCH /auth/change-password`), y eliminar el endpoint duplicado `PATCH /user/change-password`.
4. Smoke test manual de `change-password` pasa post-refactor.
5. Si se elige B, `CR1` del PRD (contratos congelados) obliga a preservar el endpoint viejo con redirect o deprecation — o escalar este cambio a un breaking change consensuado.

**Tareas**
- [ ] Decidir A vs B; registrar la decisión en un comentario del PR o en `docs/decisions/`.
- [ ] Implementar la refactorización elegida.
- [ ] Validar con smoke test.

**Dev notes**
- Hoy hay **dos** endpoints de change-password: `PATCH /auth/change-password` (en `AuthController`) y `PATCH /user/change-password` (en `UserController`). La existencia de ambos huele a refactor incompleto; parte de esta story es alinear.
- Ver `src/user/user.service.ts:46-69` y `src/auth/auth.service.ts` (método equivalente).

**Dependencias**: Story 6.1.

---

## Story 6.3 — CORS origins desde env var

**Status**: Draft

**Story**
Como dev, quiero que los orígenes permitidos por CORS se lean de una env var, para no versionar dominios productivos en código.

**Acceptance criteria**
1. `src/main.ts` lee `CORS_ORIGINS` (string separado por comas) y lo parsea a array.
2. Si `CORS_ORIGINS` no está seteado, el default permite `http://localhost:3000` y `http://localhost:3001` (flujo dev).
3. Los dominios hoy hardcodeados (`gastonfinance.vercel.app`, el canister ICP) se documentan como ejemplo en un `.env.example` y se mueven al `.env` de prod.
4. Los demás settings de CORS (`credentials: true`, `allowedHeaders`, etc.) se preservan.
5. Smoke: desde `localhost:3000` y desde `gastonfinance.vercel.app`, ambos siguen recibiendo respuestas con headers CORS correctos.

**Tareas**
- [ ] Refactor en `main.ts`.
- [ ] Crear/actualizar `.env.example`.
- [ ] Documentar en README del backend.

**Dev notes**
- Ver lista hardcodeada en `src/main.ts` (y documentada en `docs/brownfield-architecture.md §6`).
- `CR2` del PRD exige que la config siga funcionando con los clientes productivos — testear con un request real antes de mergear.

**Dependencias**: Epic 1.

---

## Story 6.4 — Centralizar configuración de cookies

**Status**: Draft

**Story**
Como dev, quiero que la config de cookies (`isProd`, `sameSite`, `secure`, expiry) viva en un único service, para no duplicar la lógica en cada endpoint de `AuthController`.

**Acceptance criteria**
1. Existe un `AuthCookiesService` (o equivalente) en `src/auth/` con métodos tipo `setAccessCookie(res, token)`, `setRefreshCookie(res, token)`, `clearAuthCookies(res)`.
2. `AuthController` y cualquier otro consumidor usan ese service; no repiten el bloque `isProd ? {...} : {...}`.
3. El service obtiene el flag de entorno vía `ConfigService` y el header `X-environment` existente (o una combinación; se documenta la precedencia).
4. No hay cambios observables para el cliente (mismos cookies, mismas flags, mismos expiries).

**Tareas**
- [ ] Extraer la lógica a `AuthCookiesService`.
- [ ] Refactorizar los endpoints.
- [ ] Smoke: verificar `Set-Cookie` en responses de signin y logout.

**Dev notes**
- La lógica de expiry difiere entre dev y prod (ver `docs/brownfield-architecture.md §5`); preservar.
- Esta story también facilita el adapter de auth para React Native en Epic 4.

**Dependencias**: Story 6.2.

---

## Story 6.5 — Smoke specs por controller

**Status**: Draft

**Story**
Como dev, quiero al menos un test por controller que valide el happy path, para tener una red mínima antes de refactorizar tipos y extraer paquetes.

**Acceptance criteria**
1. Existe un `.spec.ts` por cada controller (`auth`, `user`, `transaction`, `category`).
2. Cada spec cubre al menos un endpoint con request y assertion sobre el response.
3. `npm run test` corre los specs y pasa.
4. La suite usa `supertest` + `@nestjs/testing` (ya están en devDeps).
5. Se mockea `PrismaService` con un doble simple — no se requiere base de datos real para correr.

**Tareas**
- [ ] Configurar un helper de test module (reutilizable entre specs).
- [ ] Escribir un spec por controller.
- [ ] Correr la suite.

**Dev notes**
- No se busca coverage; se busca la red mínima. Coverage es trabajo posterior.
- Si el mock de `PrismaService` se repite mucho, factorizarlo a `src/prisma/prisma.service.mock.ts` queda a criterio del dev.

**Dependencias**: Story 6.2 (para que change-password esté consolidado antes de testearlo).
