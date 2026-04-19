# Epic 2 — Extracción del paquete `@gaston/api-types`

> Crea el primer paquete compartido del monorepo: tipos puros (DTOs, enums, wrappers de response, JwtPayload). Sin runtime, sin deps externas, consumible desde backend, web y app.

**Referencias**: `docs/prd.md §6 Epic 2`, `docs/architecture.md §4.1, §5 Fase 3`
**Dependencias**: Epic 1, Epic 6
**Bloquea**: Epic 3

**Criterio de done del epic**: `packages/api-types` compila con `tsup`, el backend importa sus DTOs desde `@gaston/api-types` sin duplicación, y hay un test de alineación con el enum Prisma de `TransactionType`.

---

## Story 2.1 — Scaffold de `packages/api-types`

**Status**: Draft

**Story**
Como dev, quiero el paquete `@gaston/api-types` vacío pero correctamente configurado con build dual (CJS+ESM) y exports map, para que cualquier workspace lo pueda consumir sin fricción.

**Acceptance criteria**
1. Existe `packages/api-types/package.json` con `"name": "@gaston/api-types"`, `"version": "0.0.0"`, `"private": true`, `main`/`module`/`types` apuntando a `./dist/...`, y `exports` map con `types`/`import`/`require`.
2. Existe `packages/api-types/tsconfig.json` extendiendo `tsconfig.base.json`.
3. Existe `packages/api-types/tsup.config.ts` configurando CJS+ESM+dts.
4. Existe `packages/api-types/src/index.ts` vacío (barrel).
5. `pnpm --filter @gaston/api-types build` genera `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts`.
6. `tsup` queda como devDep del paquete (no hoisteada, para que `pnpm --filter` la encuentre).

**Tareas**
- [ ] Crear estructura de directorios y archivos.
- [ ] Agregar script `build`, `dev`, `typecheck`, `lint`.
- [ ] Verificar build.

**Dev notes**
- `docs/architecture.md §4.1` tiene el esqueleto del `package.json` y del `exports` map — copiar de ahí.

**Dependencias**: Epic 1 completo.

---

## Story 2.2 — Extraer tipos de Auth

**Status**: Draft

**Story**
Como dev, quiero los DTOs y tipos de auth compartibles en `@gaston/api-types`, para que el backend los `implements` y los frontends los `import` sin duplicar.

**Acceptance criteria**
1. Existe `packages/api-types/src/auth.ts` exportando como `interface`/`type` puro:
   - `SignupDto` (shape de `src/auth/dto/signup.dto.ts` sin decoradores de class-validator).
   - `SigninDto` (shape de `src/auth/dto/signin.dto.ts`).
   - `RefreshTokenDto`.
   - `ChangePasswordDto` (shape de `src/user/dto/change-password.dto.ts`).
   - `JwtPayload` (`{ sub: number; email: string }`).
   - `AuthTokensResponse` (shape de lo que devuelven signin/signup y refresh).
2. `src/auth/dto/*.dto.ts` mantienen las clases con `class-validator` decoradores y ahora `implements` el tipo compartido.
3. TypeScript compila el backend sin errores.
4. Barrel `packages/api-types/src/index.ts` reexporta todo lo de `auth.ts`.

**Tareas**
- [ ] Leer los DTOs actuales y extraer la shape pura.
- [ ] Escribir `auth.ts` en el paquete.
- [ ] Actualizar las clases del backend para `implements`.
- [ ] `pnpm build` en el paquete y `pnpm --filter backend typecheck`.

**Dev notes**
- Criterio del PRD (FR4): los tipos compartidos **no** dependen de `class-validator`/`class-transformer`. Los frontends no deberían pagar ese peso.
- `AuthTokensResponse` probablemente es `{ access_token: string; refresh_token: string }` — confirmar leyendo `AuthService` antes de tiparlo.

**Dependencias**: Story 2.1.

---

## Story 2.3 — Extraer tipos de Transaction + enum `TransactionType`

**Status**: Draft

**Story**
Como dev, quiero los DTOs de transaction y el enum `TransactionType` desacoplados de Prisma, para que web y app no tengan que depender de `@prisma/client`.

**Acceptance criteria**
1. Existe `packages/api-types/src/transaction.ts` exportando:
   - `CreateTransactionDto`, `UpdateTransactionDto` (shapes puras).
   - `TransactionResponse` (shape del objeto devuelto por el backend, incluyendo `category` y `user` anidados según `src/transaction/transaction.service.ts`).
   - `TransactionSummaryResponse` (shape del endpoint `/transactions/summary`).
   - `enum TransactionType { INCOME = 'INCOME', EXPENSE = 'EXPENSE' }` — como `enum` de TS puro.
2. Existe `apps/backend/test/types-alignment.spec.ts` que valida `Object.keys(PrismaType).sort() === Object.keys(SharedType).sort()`.
3. Los DTOs de backend `implements` los tipos compartidos.
4. Ninguno de los dos enums se importa desde `@prisma/client` fuera del backend.

**Tareas**
- [ ] Leer `TransactionService` para reconstruir los shapes completos (incluyendo relaciones que el backend incluye por default en find).
- [ ] Escribir `transaction.ts`.
- [ ] Actualizar DTOs del backend.
- [ ] Escribir el spec de alineación.

**Dev notes**
- `findMany` incluye `{ category: true, user: { select: { fullName: true } } }` post-Epic-1 cleanup (ver `src/transaction/transaction.service.ts:40-55`). El `TransactionResponse` debe reflejar eso.
- Enum como string-enum (`INCOME = 'INCOME'`) facilita serializar desde JSON sin adivinar integer values.

**Dependencias**: Story 2.2.

---

## Story 2.4 — Extraer tipos de Category y User

**Status**: Draft

**Story**
Como dev, quiero los DTOs y response types de Category y User en `@gaston/api-types`, para cerrar el set de tipos de la API actual.

**Acceptance criteria**
1. `packages/api-types/src/category.ts` exporta `CreateCategoryDto`, `UpdateCategoryDto`, `CategoryResponse`.
2. `packages/api-types/src/user.ts` exporta `UpdateProfileDto`, `UserResponse` (shape que devuelve `GET /user/profile`).
3. Backend `implements` los tipos compartidos.
4. Typecheck pasa desde la raíz.

**Tareas**
- [ ] Escribir los dos archivos.
- [ ] Actualizar DTOs del backend.
- [ ] Barrel export.

**Dev notes**
- `UserResponse` post-Epic-1 es `{ id, email, fullName, createdAt }` (ver `src/user/user.service.ts:29-36`). `profileImage` ya no aparece.

**Dependencias**: Story 2.2.

---

## Story 2.5 — Extraer `ApiResponse<T>` wrapper

**Status**: Draft

**Story**
Como dev, quiero tipar el wrapper que produce `TransformResponseInterceptor`, para que los consumidores del cliente sepan exactamente la shape de cada response sin adivinar.

**Acceptance criteria**
1. Existe `packages/api-types/src/response.ts` con `ApiResponse<T>` cuya shape coincide exactamente con lo que produce el interceptor.
2. El tipo cubre tanto success (`data: T`) como el caso de error, o se separa en dos tipos (`ApiSuccess<T>` y `ApiError`) según cómo lo haga el `HttpExceptionFilter`.
3. Un test del backend valida que una response real del interceptor encaja en `ApiResponse<T>`.

**Tareas**
- [ ] Leer `src/utils/interceptorResponse.ts` y `src/utils/HttpExceptionsFilter.ts` para reconstruir la shape.
- [ ] Escribir `response.ts`.
- [ ] Barrel export.
- [ ] Test de validación de shape.

**Dev notes**
- Es clave hacerlo antes del Epic 3 (cliente), porque el cliente deserializa en `ApiResponse<T>` y desenvuelve `data` al consumidor.

**Dependencias**: Story 2.4.

---

## Story 2.6 — Wire-up completo del backend contra `@gaston/api-types`

**Status**: Draft

**Story**
Como dev, quiero que el backend importe todos los tipos compartidos desde `@gaston/api-types` en vez de definirlos in-line, para eliminar duplicación.

**Acceptance criteria**
1. `apps/backend/package.json` declara `"@gaston/api-types": "workspace:*"` como dep.
2. Cada DTO del backend importa el tipo compartido y lo `implements`.
3. `JwtPayload` deja de declararse localmente en `src/auth/` y se importa desde el paquete.
4. `pnpm --filter backend typecheck` y `pnpm --filter backend build` pasan.
5. Smoke test del signin/signup sigue pasando (el cambio es interno, no observable).

**Tareas**
- [ ] Agregar dep workspace.
- [ ] Refactorizar cada import.
- [ ] Typecheck + smoke.

**Dev notes**
- La primera vez que se agregue un workspace dep, hay que correr `pnpm install` en la raíz para que pnpm linkee.
- Para que tsup ya haya emitido `dist` cuando el backend lo resuelva, el task `^build` de Turbo se ocupa del orden.

**Dependencias**: Story 2.5.
