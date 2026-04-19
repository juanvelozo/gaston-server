# Architecture — Monorepo Gaston

> Paso 3 del flujo BMAD (`create-brownfield-architecture`). Inputs: `docs/brownfield-architecture.md` y `docs/prd.md`. Este documento define la estructura técnica del monorepo que absorberá el backend actual, la web y la app, y el plan de migración.

## 1. Decisiones de alto nivel

| Dimensión | Elección | Alternativas consideradas | Razonamiento |
|---|---|---|---|
| Package manager | **pnpm** | npm workspaces, yarn berry | Ergonomía superior para workspaces, hoisting determinista vía `node-linker=isolated`, compatibilidad excelente con Turborepo y Expo. |
| Task runner / caché | **Turborepo** | Nx, moon, raw pnpm scripts | Config mínima, caché local incremental por paquete, adopción amplia, no fuerza a adoptar un framework opinado como Nx. |
| Lenguaje compartido | **TypeScript 5.7.3** (pin raíz) | — | Alineado con la versión del backend actual; todos los paquetes y apps comparten la misma versión. |
| Formato de paquetes compartidos | **dual CJS + ESM + .d.ts** vía `tsup` | Solo ESM, solo CJS, `tsc -b` | NestJS (CJS) y Next.js/Expo (ESM) se consumen desde un mismo paquete sin fricción. |
| Protocolo de referencia interna | **`workspace:*`** | Rutas relativas, links manuales | Estándar pnpm, falla ruidosamente si un paquete no está declarado. |
| Versión de Node | **Pinear con `.nvmrc` + `engines`** | Sin pin (estado actual) | Evita "anda en mi máquina" y queda documentado para el host de deploy. |
| CI | **GitHub Actions** | CircleCI (referenciado en README template), GitLab CI | Asunción por defecto. Si el proyecto usa otro, el pipeline es trasladable. |

**Apps destino** (asunciones documentadas, confirmar antes de implementar):
- `apps/web` — Next.js 15 (App Router). La URL productiva actual es `gastonfinance.vercel.app`, consistente con Next+Vercel.
- `apps/app` — Expo SDK 52 + React Native. Alineado con React en web para maximizar reuso.

> Si la realidad difiere (Vite+React, React Native CLI sin Expo, etc.), solo cambian los detalles del bootstrap de cada app, no la estructura del monorepo.

## 2. Source tree

```
gaston/
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint + typecheck + test + build, con cache Turbo
│       └── deploy-backend.yml  # opcional; preserva el deploy actual
├── apps/
│   ├── backend/                # ex-gaston-server
│   │   ├── prisma/             # schema.prisma + migrations
│   │   ├── src/
│   │   ├── test/
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   ├── web/                    # Next.js
│   │   ├── app/                # app router
│   │   ├── package.json
│   │   ├── next.config.mjs
│   │   └── tsconfig.json
│   └── app/                    # Expo
│       ├── app/                # expo-router
│       ├── package.json
│       ├── app.json
│       └── tsconfig.json
├── packages/
│   ├── api-types/              # DTOs + response wrappers + JwtPayload + enums
│   │   ├── src/
│   │   │   ├── auth.ts
│   │   │   ├── transaction.ts
│   │   │   ├── category.ts
│   │   │   ├── user.ts
│   │   │   ├── response.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── api-client/             # fetch-based client tipado
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── tsconfig/               # base compartida
│       ├── base.json
│       ├── nest.json
│       ├── next.json
│       └── expo.json
├── docs/
│   ├── brownfield-architecture.md
│   ├── prd.md
│   └── architecture.md
├── .editorconfig
├── .eslintignore
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc
├── eslint.config.mjs           # flat config raíz
├── package.json                # workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── README.md
├── tsconfig.base.json
└── turbo.json
```

**Notas:**
- El directorio `prisma/` vive dentro de `apps/backend/` — es detalle de implementación del backend, no se comparte.
- `packages/tsconfig` no tiene código; solo JSONs base que cada `tsconfig.json` extiende. Alternativa válida: una raíz `tsconfig.base.json` y listo.
- `test/` dentro del backend se crea incluso vacío para reservar convención.

## 3. Configuración de workspaces

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`package.json` raíz (resumen de scripts y devDeps)**
```json
{
  "name": "gaston",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:generate": "pnpm --filter backend run generate",
    "db:migrate": "pnpm --filter backend run deploydb:dev",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "5.7.3",
    "prettier": "3.5.3",
    "eslint": "9.18.0",
    "typescript-eslint": "8.20.0"
  }
}
```

**`turbo.json`**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] }
  }
}
```

El `^build` en `typecheck`/`test` garantiza que los `.d.ts` de los paquetes internos estén generados antes de que un consumer intente resolverlos.

## 4. Paquetes compartidos

### 4.1 `@gaston/api-types`

**Alcance**: tipos puros, cero runtime, cero dependencias externas salvo `typescript` en devDeps.

**Contenido**
- `auth.ts` — `SignupDto`, `SigninDto`, `RefreshTokenDto`, `ChangePasswordDto`, `JwtPayload`, `AuthTokensResponse`.
- `transaction.ts` — `CreateTransactionDto`, `UpdateTransactionDto`, `TransactionResponse`, enum `TransactionType { INCOME, EXPENSE }`.
- `category.ts` — `CreateCategoryDto`, `UpdateCategoryDto`, `CategoryResponse`.
- `user.ts` — `UpdateProfileDto`, `UserResponse`.
- `response.ts` — `ApiResponse<T>` modelando el wrapper que produce `TransformResponseInterceptor`. Por ejemplo:
  ```ts
  export type ApiResponse<T> = {
    ok: boolean;
    data: T;
    message?: string;
  };
  ```
  (la forma exacta se deriva leyendo `src/utils/interceptorResponse.ts` al momento de implementar).
- `index.ts` — barrel export.

**Decisión clave**: `TransactionType` se define en este paquete como enum de TS puro, independiente de `@prisma/client`. El backend puede opcionalmente validar en runtime que coincida con el enum de Prisma con un test de consistencia:
```ts
// apps/backend/test/types-alignment.spec.ts
import { TransactionType as PrismaType } from '@prisma/client';
import { TransactionType as SharedType } from '@gaston/api-types';
expect(Object.keys(PrismaType).sort()).toEqual(Object.keys(SharedType).sort());
```

**Distribución de DTOs con class-validator**
Los DTOs del backend usan decoradores `class-validator`. Dos estrategias:
- **A. DTO plano + validación solo en backend**: `@gaston/api-types` exporta `interface`/`type` puros. El backend mantiene clases decoradas en `apps/backend/src/**/dto/` que implementan el tipo compartido. **→ elegida**, porque no obliga a los frontends a importar `class-validator`/`class-transformer` (que agrega peso y reflect-metadata).
- B. Clases decoradas en el paquete compartido: más DRY, pero arrastra deps de validación a web/app.

**Build**: `tsup` → `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts`. `package.json` con `exports` map:
```json
{
  "name": "@gaston/api-types",
  "version": "0.0.0",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  }
}
```

### 4.2 `@gaston/api-client`

**Alcance**: cliente HTTP tipado que cubre los endpoints documentados en `brownfield-architecture.md §4`, consumiendo `@gaston/api-types`.

**Principios**
- Agnóstico del runtime: no referenciar `window`, `document` ni `AsyncStorage`. La plataforma se inyecta.
- `fetch` como transport, asumiendo global (Node ≥18, navegador, RN ≥0.72). Sin deps de runtime obligatorias.
- Estrategia de auth delegada a un adapter. El backend usa cookies HttpOnly, así que:
  - **Web**: credencial por cookies del browser (`credentials: 'include'`).
  - **App (RN/Expo)**: RN no maneja cookies HttpOnly de forma transparente. El adapter de la app intercepta `Set-Cookie` y almacena tokens en SecureStore, re-enviándolos como header `Cookie` o — preferible para simplificar — el backend acepta `Authorization: Bearer` como fallback (deuda a evaluar en Epic 6 del PRD).

**Shape tentativo**
```ts
export interface ApiClientConfig {
  baseUrl: string;
  environment: 'prod' | 'dev';
  fetch?: typeof fetch;
  getAuthHeaders?: () => Promise<Record<string, string>>;
  onUnauthorized?: () => void | Promise<void>;
}

export function createApiClient(config: ApiClientConfig) {
  return {
    auth: {
      signup: (body: SignupDto) => /* ... */,
      signin: (body: SigninDto) => /* ... */,
      refresh: () => /* ... */,
      logout: () => /* ... */,
      status: () => /* ... */,
    },
    user: { /* getProfile, updateProfile, changePassword */ },
    transactions: { /* create, findAll, findOne, update, remove, summary */ },
    categories: { /* create, findAll, findOne, update, remove */ },
  };
}
```

**Headers**
- `X-environment` enviado automáticamente según `config.environment`.
- `Content-Type: application/json` por defecto (no hay endpoints multipart en la superficie actual).

**Errores**: el cliente normaliza errores a una clase `ApiError` con `status`, `code`, `message`. No oculta el body de error para no impedir a los consumidores decidir.

**Build**: igual estrategia que `api-types`, dual CJS/ESM vía `tsup`.

### 4.3 `@gaston/tsconfig`

Solo archivos base que el resto extiende:
- `base.json` — compilerOptions comunes (strict, ES2023, etc., copiadas del `tsconfig.json` actual del backend).
- `nest.json` — extiende base, agrega `emitDecoratorMetadata`, `experimentalDecorators`, `module: commonjs`.
- `next.json` — extiende base, `jsx: preserve`, `module: esnext`, `moduleResolution: bundler`.
- `expo.json` — extiende base, `jsx: react-native`, `moduleResolution: bundler`.

## 5. Plan de migración

### Fase 0 — Preparación (sin tocar estructura)
1. Medir baseline: `time pnpm run build` y `time pnpm run start:dev` en el repo actual para comparar post-migración (NFR7).
2. Snapshot manual de smoke tests de la API productiva (signup, signin, CRUD transactions/categories, upload profile image). Guardar en `docs/smoke-tests.md` o similar.
3. Verificar configuración del host de deploy actual (Railway/Render/Fly/Vercel). Identificar si acepta `rootDirectory: apps/backend/` o requiere cambios.

### Fase 1 — Bootstrap del monorepo
1. Crear en la raíz: `pnpm-workspace.yaml`, `turbo.json`, `package.json` raíz (sin deps runtime), `tsconfig.base.json`, `.nvmrc`, `eslint.config.mjs` raíz.
2. `git mv` de todos los archivos del backend a `apps/backend/` salvo `docs/`:
   ```
   src/               → apps/backend/src/
   prisma/            → apps/backend/prisma/
   test/              → apps/backend/test/            (si existe)
   nest-cli.json      → apps/backend/nest-cli.json
   package.json       → apps/backend/package.json
   tsconfig.json      → apps/backend/tsconfig.json
   tsconfig.build.json→ apps/backend/tsconfig.build.json
   eslint.config.mjs  → apps/backend/eslint.config.mjs (local, extiende raíz)
   .prettierrc        → (reemplazado por el de la raíz)
   ```
   `docs/` queda en la raíz. El `README.md` se reemplaza por uno del monorepo (el actual del backend es template de Nest y no aporta).
3. `apps/backend/package.json`: renombrar a `"name": "backend"`. Cambiar scripts si es necesario (`generate` y `deploydb:dev` siguen funcionando, apuntan a `prisma/` relativo al paquete).
4. Hoist de devDeps compartidas a la raíz: `typescript`, `prettier`, `eslint`, `typescript-eslint`. El `package.json` del backend las recibe vía workspace.
5. Instalar: `pnpm install` en la raíz. Verificar que genera un único `pnpm-lock.yaml`.
6. Validar: `pnpm --filter backend dev` levanta el servidor y responde igual que antes.

**Criterio de corte**: si al terminar la fase 1 no es posible hacer `pnpm --filter backend build && start:prod` con éxito, no seguir.

### Fase 2 — Higiene técnica (Epic 6 del PRD)
Antes de compartir tipos, resolver:
1. Romper `forwardRef` entre `AuthModule` y `UserModule`. Extraer la lógica de cambio de password a un service dedicado o mover el endpoint a un único módulo.
2. Mover CORS origins a env var (`CORS_ORIGINS` separado por comas).
3. Centralizar configuración de cookies (`AuthCookiesService` o similar) para no duplicar `isProd` en cada endpoint.
4. Al menos un spec por controller como smoke (no coverage completo).

### Fase 3 — `@gaston/api-types`
1. Crear paquete vacío con `tsup` configurado.
2. Mover definiciones de tipo desde `apps/backend/src/**/dto/*.dto.ts` e interfaces de response a `packages/api-types/src/`. En el backend, las clases decoradas `implements` los tipos compartidos.
3. Agregar test de alineación con Prisma enum.
4. Reemplazar imports internos del backend a `@gaston/api-types` donde corresponda.
5. Verificar: `pnpm build` construye el paquete; backend compila contra `dist`.

### Fase 4 — `@gaston/api-client`
1. Crear paquete con `tsup`.
2. Implementar el cliente cubriendo los endpoints de §4 del brownfield.
3. Escribir un test de humo en Node (contra un backend mockeado o contra el backend local con un usuario de prueba).

### Fase 5 — Shells de `apps/web` y `apps/app`
1. Scaffold de Next.js en `apps/web/` (o migrar el repo de web actual si existe).
2. Scaffold de Expo en `apps/app/`.
3. Cada una agrega `@gaston/api-client` y renderiza una pantalla que llama a `/auth/status`.
4. Validar que Metro (Expo) resuelve el paquete workspace — agregar `metro.config.js` con `watchFolders` apuntando a la raíz si es necesario.
5. Validar que Next.js transpila el paquete workspace — `transpilePackages: ['@gaston/api-client', '@gaston/api-types']` en `next.config.mjs`.

### Fase 6 — CI/CD
1. GitHub Actions: job único con `pnpm install --frozen-lockfile`, `pnpm turbo run lint typecheck test build --affected`.
2. Deploy backend: el workflow empuja `apps/backend` al host actual (o cambia el `rootDirectory` del servicio existente a `apps/backend`).
3. Deploy web: se agrega cuando la web tenga su propio pipeline (fuera de scope duro de esta migración si ya tiene deploy propio en Vercel apuntando al repo de web; en ese caso, Vercel se reapunta a este monorepo con `rootDirectory=apps/web`).

## 6. Estrategia de deploy del backend

Tres caminos ordenados por preferencia:

**Opción A — Host acepta `rootDirectory` (Railway, Render, Vercel, Fly con Dockerfile custom)**
Configurar el servicio actual para apuntar a `apps/backend/`. Los comandos (`pnpm install --filter backend...`, `pnpm --filter backend build`, `node dist/main`) se adaptan. Ventaja: cambio mínimo.

**Opción B — Dockerfile en `apps/backend/`**
Build multi-stage que copie `package.json` raíz + `pnpm-lock.yaml` + `pnpm-workspace.yaml`, instale con `pnpm install --filter backend...`, compile y produzca una imagen autocontenida. Ventaja: portable. Desventaja: introduce Docker si hoy no existe.

**Opción C — `pnpm deploy`**
`pnpm deploy --filter=backend /output` genera un paquete standalone con solo lo necesario para correr el backend. Útil si el host pide un tarball o una carpeta aislada.

La decisión entre A/B/C se toma al inspeccionar la config real del host. Ninguna de las tres requiere cambiar código del backend.

## 7. CI reference

**`.github/workflows/ci.yml`** (esqueleto)
```yaml
name: ci
on:
  push: { branches: [master] }
  pull_request: {}
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build
```

Para PRs, sumar `--affected` cuando Turbo lo permita sobre el `base_ref` para reducir el trabajo.

## 8. Estándares de código

- **TS**: un único `tsconfig.base.json` con las compilerOptions actuales del backend (strict, noImplicitAny, ES2023). Cada app extiende y agrega lo suyo.
- **ESLint**: config raíz con reglas del backend actual. Apps/packages extienden. La regla `@typescript-eslint/no-floating-promises: error` se mantiene a nivel raíz.
- **Prettier**: `.prettierrc` único en la raíz. Se elimina el del backend.
- **Commits**: no se impone convención nueva; el usuario ya tiene estilo `[AUTH] ...`. Opcional: documentarlo en README.

## 9. Seguridad

- Los secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`) siguen siendo exclusivos del backend — no se comparten con web/app.
- CORS: se parametriza por env (`CORS_ORIGINS`). En desarrollo, el default permite `localhost:3000/3001`.
- Cookies: la estrategia no cambia. La app (React Native) es el caso que puede forzar a introducir auth por header `Authorization: Bearer` como fallback — decisión dejada para la ejecución de Epic 6 cuando se empiece a integrar el cliente en RN.
- Ninguno de los paquetes compartidos debe importar `process.env.*` directamente. La config la inyecta el consumer.

## 10. Testing

- **Unit**: Jest (backend ya lo tiene). Packages compartidos: Vitest o Jest; preferencia Vitest en paquetes puros porque integra mejor con ESM.
- **Type alignment test**: como el mencionado en §4.1 para `TransactionType` vs Prisma.
- **Smoke end-to-end**: opcional, supertest contra una base de datos de test con Prisma migrate. Fuera del mínimo de esta migración, pero el hook queda abierto en `apps/backend/test/`.

## 11. Trazabilidad

| Requisito PRD | Cubierto por |
|---|---|
| FR1 (estructura) | §2, §3 |
| FR2 (API preservada) | §5 fase 1, smoke tests fase 0 |
| FR3 (datos preservados) | §2 ubicación de `prisma/`, §5 `git mv` sin tocar schema |
| FR4 (`api-types`) | §4.1 |
| FR5 (`api-client`) | §4.2 |
| FR6 (deploy preservado) | §6 |
| FR7 (scripts raíz) | §3 |
| NFR1 (regresión cero) | §5 fase 0 + fase 1 criterio de corte |
| NFR2 (caché) | §3 `turbo.json` |
| NFR3 (un lockfile) | §3 `pnpm-workspace.yaml` |
| NFR4 (typecheck cruzado) | §3 `turbo.json` dependsOn ^build, §4 `workspace:*` |
| NFR5 (TS alineado) | §1 pin raíz |
| NFR6 (estándares) | §8 |
| NFR7 (perf) | §5 fase 0 medición baseline |
| CR1–CR5 (compatibilidad) | §5 fases 1–2 preservan contratos; §9 cookies/CORS |

## 12. Deuda conocida que acarrea la migración

- Sin tests hoy en el backend: el plan introduce el mínimo de smoke en la fase 2; coverage real sigue siendo un trabajo posterior.
- Auth para React Native con cookies HttpOnly: resuelto parcialmente con el adapter del cliente, pero la solución robusta (Bearer token en header) es decisión pendiente para cuando la app móvil entre en producción.
- `TransformResponseInterceptor`: su shape exacto hay que leerlo en implementación para tipar `ApiResponse<T>` fielmente.
- El archivo `README.md` actual es template de Nest y no describe el proyecto; se sobreescribe en fase 1.
