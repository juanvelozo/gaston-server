# Brownfield Architecture — gaston-server

> Documento generado como paso 1 del flujo BMAD (`document-project`). Refleja el estado actual del backend previo a la migración a monorepo (web + app + backend).

## 1. Stack y herramientas

**Runtime y framework**
- Node.js (sin engine pinning en `package.json`)
- NestJS 11.0.1
- TypeScript 5.7.3, target ES2023, `strict: true`
- Build: SWC (`@swc/cli@0.6.0`, `@swc/core@1.10.7`)

**Dependencias clave**
- `@nestjs/common@11.0.1`, `@nestjs/core@11.0.1`, `@nestjs/config@4.0.2`
- `@nestjs/jwt@11.0.0`, `@nestjs/passport@11.0.5`, `passport@0.7.0`, `passport-jwt@4.0.1`
- `@nestjs/platform-express@11.0.1`, `@nestjs/serve-static@5.0.3`
- `@nestjs/mapped-types@2.1.0`
- `@prisma/client@6.10.1`, `prisma@6.10.1`
- `bcrypt@6.0.0`
- `class-validator@0.14.2`, `class-transformer@0.5.1`
- `cookie-parser@1.4.7`
- `rxjs@7.8.1`

**Base de datos / ORM**
- Prisma 6.10.1 sobre PostgreSQL (`prisma/schema.prisma`)
- 7 migraciones en `prisma/migrations/`

**TypeScript (`tsconfig.json`)**
- `strict: true`, `noImplicitAny: true`
- `emitDecoratorMetadata: true`, `experimentalDecorators: true`
- `module: commonjs`, `target: ES2023`
- `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `incremental: true`

**Linter/Formatter**
- ESLint 9.18.0 (flat config en `eslint.config.mjs`) + `typescript-eslint@8.20.0`
  - Rules destacadas: `@typescript-eslint/no-floating-promises: error`, `no-explicit-any: warn`
  - Overrides: DTOs y Prisma relajan reglas strict
- Prettier 3.5.3 (`.prettierrc`): `singleQuote`, `semi`, `printWidth: 100`, `tabWidth: 2`

**Scripts npm**
```json
{
  "build": "nest build",
  "format": "prettier --write 'src/**/*.ts' 'test/**/*.ts'",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "generate": "prisma generate --schema=prisma/schema.prisma",
  "lint": "eslint '{src,apps,libs,test}/**/*.ts' --fix",
  "deploydb:dev": "npx prisma migrate dev --name deploy-db-dev"
}
```

## 2. Estructura de módulos

**Bootstrap**
- `src/main.ts`: crea app, aplica `TransformResponseInterceptor`, `HttpExceptionFilter`, `cookie-parser`, CORS con lista hardcodeada.
- `src/app.module.ts`: registra `ConfigModule` (global), `PrismaModule` (global), `AuthModule`, `UserModule`, `TransactionModule`, `CategoryModule`.

**Módulos**

| Módulo | Responsabilidad | Elementos clave |
|---|---|---|
| `auth/` | Signup, signin, refresh, logout, change-password, estado de sesión | `AuthController`, `AuthService`, `JwtStrategy`, `JwtGuard`, decoradores `@Public`, `@GetUser`, DTOs |
| `user/` | Perfil (nombre) y cambio de contraseña | `UserController`, `UserService`, DTOs (`UpdateProfileDto`, `ChangePasswordDto`); depende de `AuthModule` (forwardRef) |
| `transaction/` | CRUD de ingresos/gastos + summary | `TransactionController`, `TransactionService`, DTOs |
| `category/` | CRUD de categorías por usuario | `CategoryController`, `CategoryService`, DTOs |
| `prisma/` | Cliente Prisma (Global) | `PrismaService extends PrismaClient` |

**Utilidades sueltas (`src/utils/`)**
- `interceptorResponse.ts` — `TransformResponseInterceptor` (global)
- `HttpExceptionsFilter.ts` — filtro global de errores HTTP
- `getEnvironmentFromHeaders.ts` — lee header `X-environment` para distinguir prod/dev

No hay módulo `common/` o `shared/` explícito.

## 3. Modelo de datos

**Models (`prisma/schema.prisma`)**

- **User** — cuenta de usuario. `id`, `email @unique`, `hash`, `fullName?`, `refreshToken?`, timestamps. Relaciones 1:N con `Transaction` y `Category`.
- **Transaction** — movimiento financiero. `id`, `type: TransactionType`, `amount: Float`, `title`, `description?`, timestamps, `userId`, `categoryId?`. N:1 con `User` y con `Category` (opcional).
- **Category** — categoría del usuario. `id`, `name`, `description?`, `color`, `icon`, timestamps, `userId`. N:1 con `User`, 1:N con `Transaction`.

**Enum**
- `TransactionType { INCOME, EXPENSE }`

**Migraciones aplicadas (7)**
1. `20250619234156_init`
2. `20250619234428_add_transactions`
3. `20250620151211_add_refresh_token`
4. `20250620160505_add_category_model`
5. `20250620161333_add_transaction_category_relation`
6. `20250620163557_add_profile_fields` — introdujo `profileImage` (deprecado, ver abajo)
7. `20250704184935_make_category_optional`

**Migración pendiente de generar** (producto de la remoción de Cloudinary): `drop column User.profileImage`. Se genera con `npm run deploydb:dev` (o `npx prisma migrate dev --name remove_profile_image`) la próxima vez que se corra contra la base de dev.

## 4. API surface

**AppController (`/`)**
- `GET /` → `getHello()`

**AuthController (`/auth`)**
- `POST /auth/signup` → `signup(dto)` [Public]
- `POST /auth/signin` → `signin(dto)` [Public]
- `POST /auth/refresh` → `refreshTokens()` [Public]
- `POST /auth/logout` → `logout(userId)` [JwtGuard]
- `PATCH /auth/change-password` → `changePassword(userId, dto)`
- `GET /auth/status` → `checkAuthStatus()` [JwtGuard]

**UserController (`/user`, `@UseGuards(JwtGuard)`)**
- `GET /user/profile` → `getProfile(userId)`
- `PATCH /user/profile` → `updateProfile(userId, dto)`
- `PATCH /user/change-password` → `changePassword(userId, dto)`

**TransactionController (`/transactions`, `@UseGuards(JwtGuard)`)**
- `POST /transactions` → `create(userId, dto)`
- `GET /transactions` → `findAll(userId)`
- `GET /transactions/summary` → `summary(userId)`
- `GET /transactions/:id` → `findOne(userId, id)`
- `PATCH /transactions/:id` → `update(userId, id, dto)`
- `DELETE /transactions/:id` → `remove(userId, id)`

**CategoryController (`/categories`, `@UseGuards(JwtGuard)`)**
- `POST /categories` → `create(userId, dto)`
- `GET /categories` → `findAll(userId)`
- `GET /categories/:id` → `findOne(userId, id)`
- `PATCH /categories/:id` → `update(userId, id, dto)`
- `DELETE /categories/:id` → `remove(userId, id)`

## 5. Autenticación y autorización

**Estrategia**: JWT emitidos en signup/signin, persistidos en cookies HttpOnly (`secure`, `sameSite: 'none'`). `JwtStrategy` extrae el access token desde cookies.

**Tokens**
- Access token: expira en `1m`
- Refresh token: expira en `5m` (y 30d en cookie de prod); el refresh token hasheado se persiste en `User.refreshToken`

**Guards y decoradores**
- `JwtGuard`: aplicado por `@UseGuards(JwtGuard)` a nivel de controller donde aplica; respeta `IS_PUBLIC_KEY` metadata (`@Public`)
- `@GetUser(key?)`: extrae el `JwtPayload` (`sub`, `email`) de `req.user`
- No hay guards globales

**Roles/permisos**
- No hay roles. Aislamiento por `userId` en cada query.

**Secrets**
- `JWT_SECRET`, `JWT_REFRESH_SECRET` vía `ConfigService`.

**Cookies**
- `httpOnly: true`, `secure: true` en prod, `sameSite: 'none'`.
- En dev no se setea expiry (sesiones no expiran localmente).

## 6. Integraciones externas

- **PostgreSQL** — via Prisma.

**Variables de entorno referenciadas**
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DATABASE_URL`

**Header custom**
- `X-environment` — distingue `prod`/`dev` desde el cliente (ver `utils/getEnvironmentFromHeaders.ts`).

**CORS (hardcoded en `src/main.ts`)**
- `http://localhost:3000`, `http://localhost:3001`
- `https://gastonfinance.vercel.app`
- `https://5kzti-biaaa-aaaae-abmaq-cai.icp0.io`

## 7. Testing

- Jest 29.7.0 + ts-jest + `@nestjs/testing`, configurado en `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`).
- **Cobertura actual: 0 specs**. Hay que construir la suite desde cero cuando toque.

## 8. Observaciones relevantes para el monorepo

**Candidatos naturales a `packages/` compartidos con web y app**
- Tipos de DTOs de Auth, Transaction, Category, User.
- `JwtPayload` y tipos de response estándar (el interceptor wrappea todas las respuestas).
- Enums (`TransactionType`) — o reexportados desde `@prisma/client` o movidos a un paquete propio para no forzar a los clientes a depender de Prisma.
- Cliente HTTP tipado (no existe hoy) — `packages/api-client` que consuma los endpoints documentados en §4.
- Utilidades puras (`bufferToStream`, validadores compartidos si aparecen).

**Acoplamientos a considerar antes de extraer**
- `AuthModule` ↔ `UserModule` con `forwardRef` (change-password cruza ambos). Antes de repartir código entre paquetes conviene aislar la lógica de tokens.
- CORS hardcodeado en `main.ts` → debería leer de env para no versionar dominios.
- Cookie config (`isProd`, `sameSite`, etc.) recalculada en cada endpoint del `AuthController` → conviene centralizar.
- `PrismaModule` es `Global: true`. En monorepo seguirá viviendo en el backend; web/app no deben depender de `@prisma/client` salvo para tipos (si se usan).
- `TransformResponseInterceptor` global establece un contrato de respuesta que cualquier cliente compartido debe asumir.

**Estructura monorepo sugerida (tentativa, a confirmar en el paso de arquitectura)**
```
monorepo/
├── apps/
│   ├── backend/   # contenido actual de este repo
│   ├── web/
│   └── app/
├── packages/
│   ├── api-types/      # DTOs, JwtPayload, response wrappers
│   ├── api-client/     # cliente HTTP tipado
│   ├── shared-enums/   # TransactionType, etc.
│   └── utils/
└── turbo.json | nx.json | pnpm-workspace.yaml
```

**Estado general**
- Backend chico, coherente, con 3 entidades core y 4 áreas funcionales (auth, user, transaction, category).
- Sin tests, sin CI visible en el repo, CORS y cookies con valores duros — todo esto vale la pena cerrarlo antes o durante la migración.

**Cambios recientes**
- Feature de upload de imagen de perfil descartada: se eliminaron el módulo `cloudinary/`, `bufferToStream.ts`, el campo `User.profileImage` del schema Prisma, el `FileInterceptor` de `PATCH /user/profile`, y las deps `cloudinary`, `multer-storage-cloudinary`, `multer`, `@types/multer`. La migración Prisma que dropea la columna queda pendiente de generar (`npm run deploydb:dev`).
