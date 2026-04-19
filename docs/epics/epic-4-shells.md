# Epic 4 — Shells de `apps/web` y `apps/app`

> Monta los esqueletos mínimos de web (Next.js) y app (Expo/React Native) consumiendo `@gaston/api-client`. Sin features completas; solo bootstrap + una pantalla que llama a `/auth/status` para probar el wiring end-to-end.

**Referencias**: `docs/prd.md §6 Epic 4`, `docs/architecture.md §1, §5 Fase 5`
**Dependencias**: Epic 3
**Bloquea**: Epic 5 (parcial — el deploy de web/app depende de que los shells existan)

**Criterio de done del epic**: `apps/web` y `apps/app` construyen, resuelven los paquetes workspace, y cada una logra hacer una request autenticada contra un backend local; el adapter de auth para RN queda decidido e implementado.

---

## Story 4.1 — Scaffold de `apps/web` con Next.js

**Status**: Draft

**Story**
Como dev, quiero `apps/web` inicializado con Next.js (App Router), para tener el shell sobre el que el frontend web va a crecer.

**Acceptance criteria**
1. Existe `apps/web/` con un proyecto Next.js 15 (App Router) mínimo.
2. `apps/web/package.json` con `"name": "web"` y scripts `dev`, `build`, `start`, `lint`, `typecheck`.
3. `apps/web/tsconfig.json` extiende `tsconfig.base.json` (o `packages/tsconfig/next.json` si se optó por esa estructura).
4. `apps/web/next.config.mjs` declara `transpilePackages: ['@gaston/api-client', '@gaston/api-types']` para que Next.js maneje los paquetes workspace correctamente.
5. `pnpm --filter web dev` levanta un server en `http://localhost:3001` con una página "hola mundo".
6. `pnpm --filter web build` produce un build productivo sin warnings de resolución.

**Tareas**
- [ ] `pnpm create next-app apps/web --ts --app --no-eslint` (o scaffold manual para tener control).
- [ ] Ajustar scripts y tsconfig.
- [ ] Configurar `transpilePackages`.
- [ ] Smoke: dev + build.

**Dev notes**
- Si ya existe un repo de web productivo (el que apunta a `gastonfinance.vercel.app`), esta story puede ser "migrar ese repo a apps/web" en vez de scaffold desde cero — decidir según el estado real.
- Port 3001 para no chocar con el backend en 3000.

**Dependencias**: Epic 3 completo.

---

## Story 4.2 — `apps/web` consume `@gaston/api-client`

**Status**: Draft

**Story**
Como dev, quiero una página en `apps/web` que instancia el cliente y muestra el response de `/auth/status`, para validar el wiring de tipos y transport desde el browser.

**Acceptance criteria**
1. `apps/web/package.json` declara `@gaston/api-client: workspace:*` y `@gaston/api-types: workspace:*`.
2. Existe una ruta (por ejemplo `apps/web/app/health/page.tsx`) que renderiza el resultado de `client.auth.status()`.
3. El cliente se instancia con `baseUrl` desde `NEXT_PUBLIC_API_URL` (o equivalente), `environment` derivado del modo (`prod`/`dev`), y `fetch` default.
4. Con el backend local corriendo y un usuario con sesión válida (cookie seteada), la página muestra el status correctamente; sin sesión, muestra el error normalizado por `ApiError`.

**Tareas**
- [ ] Agregar deps workspace.
- [ ] Crear ruta.
- [ ] Instanciar cliente.
- [ ] Validar manualmente.

**Dev notes**
- Las cookies HttpOnly del backend deberían fluir automáticamente si la web se sirve desde el mismo dominio (o cross-origin con `credentials: 'include'` — lo cubre la config default del cliente).

**Dependencias**: Story 4.1.

---

## Story 4.3 — Scaffold de `apps/app` con Expo

**Status**: Draft

**Story**
Como dev, quiero `apps/app` inicializado con Expo SDK 52 + expo-router, para tener el shell sobre el que la app móvil va a crecer.

**Acceptance criteria**
1. Existe `apps/app/` con un proyecto Expo mínimo (`expo-router` + TypeScript).
2. `apps/app/package.json` con `"name": "app"` y scripts `dev`, `build`, `lint`, `typecheck`.
3. `apps/app/tsconfig.json` extiende la base del monorepo.
4. `pnpm --filter app dev` levanta el dev server (`expo start`) sin errores de resolución.
5. La app corre en el simulador de iOS/Android y en Expo Go.

**Tareas**
- [ ] Scaffold con `pnpm create expo-app apps/app`.
- [ ] Ajustar scripts y tsconfig.
- [ ] Smoke run.

**Dev notes**
- Si hay un repo previo de app, aplica el mismo patrón de migración que en 4.1.
- Expo tiene su propio babel config y metro config; preservarlos tal cual en esta story.

**Dependencias**: Story 4.2.

---

## Story 4.4 — Configurar Metro para resolver paquetes workspace

**Status**: Draft

**Story**
Como dev, quiero que Metro (el bundler de React Native) resuelva los paquetes workspace por symlink, porque por default solo mira en `node_modules/` local al proyecto.

**Acceptance criteria**
1. Existe `apps/app/metro.config.js` que:
   - Declara `watchFolders` incluyendo la raíz del monorepo (para que Metro vea cambios en `packages/*`).
   - Configura `resolver.nodeModulesPaths` para que resuelva deps del root `node_modules/`.
   - Habilita `unstable_enablePackageExports` si es necesario para resolver el `exports` map de los paquetes.
2. Importar `@gaston/api-client` desde un componente de la app no falla.

**Tareas**
- [ ] Escribir el `metro.config.js` (hay ejemplos canónicos en docs de Expo para monorepos).
- [ ] Smoke import.

**Dev notes**
- Esta configuración cambió en Expo SDK recientes; validar contra la versión elegida.
- Referencia: https://docs.expo.dev/guides/monorepos/ (Expo mantiene doc oficial de este caso).

**Dependencias**: Story 4.3.

---

## Story 4.5 — `apps/app` consume `@gaston/api-client`

**Status**: Draft

**Story**
Como dev, quiero una pantalla en `apps/app` que llama a `/auth/status`, para validar que el cliente funciona desde el runtime de React Native.

**Acceptance criteria**
1. Existe una screen (por ejemplo `apps/app/app/(tabs)/health.tsx`) que llama a `client.auth.status()` y muestra el resultado.
2. El cliente se instancia con `baseUrl` tomada de un `app.json` / expo config / env var.
3. La request funciona cuando el backend corre en `http://localhost:3000` y el simulador apunta ahí (teniendo en cuenta el forwarding de Android `10.0.2.2`).
4. Si falla por cookies (esperable en RN — la siguiente story lo resuelve), el error se muestra sin crashear.

**Tareas**
- [ ] Crear screen.
- [ ] Instanciar cliente.
- [ ] Smoke en simulador.

**Dev notes**
- La primera request probablemente falla con 401 porque las cookies HttpOnly no se manejan en RN como en browser. Esa es la motivación de la story 4.6.

**Dependencias**: Story 4.4.

---

## Story 4.6 — Adapter de auth para React Native (cookies vs Bearer)

**Status**: Draft

**Story**
Como dev, quiero decidir e implementar la estrategia de auth para RN, porque el manejo de cookies HttpOnly es ergonómicamente pobre fuera del browser.

**Acceptance criteria**
1. Queda escrita una decisión en `docs/decisions/` eligiendo una de dos opciones:
   - **A**: Adapter en el cliente que intercepta `Set-Cookie`, guarda tokens en `expo-secure-store`, y los reenvía como header `Cookie` en subsiguientes requests.
   - **B**: Extender el backend para aceptar `Authorization: Bearer <accessToken>` como fallback cuando no hay cookie. El cliente RN usa Bearer en vez de cookies.
2. La decisión elegida se implementa:
   - Si A: helper `createRnAuthAdapter()` en `@gaston/api-client` que devuelve `getAuthHeaders`.
   - Si B: modificación en `JwtStrategy` del backend para extraer de cookie **o** de `Authorization`, y el cliente usa `getAuthHeaders` para setearlo.
3. La story 4.5 ahora pasa con sesión válida: signin devuelve tokens, la app los persiste, y `/auth/status` responde 200.

**Tareas**
- [ ] Decidir A vs B (recomendación: B — menor fricción, pero toca el backend).
- [ ] Implementar.
- [ ] Testing en simulador.

**Dev notes**
- `CR2` del PRD obliga a no romper el flujo de cookies para web/ICP. Si se elige B, el backend debe aceptar **ambos** mecanismos.
- Si B: revisar `src/auth/strategy/jwt.strategy.ts`, agregar `ExtractJwt.fromAuthHeaderAsBearerToken()` como extractor adicional.

**Dependencias**: Story 4.5.
