# Epic 5 — CI/CD y deploy preservado

> Unifica la validación en CI (lint/typecheck/test/build) por Turbo, y preserva el pipeline productivo del backend mientras se incorporan los deploys de web (y eventualmente app).

**Referencias**: `docs/prd.md §6 Epic 5`, `docs/architecture.md §6, §7`
**Dependencias**: Epic 4 (deploys de web/app)
**Bloquea**: ninguno — es el epic de cierre.

**Criterio de done del epic**: un push a `master` dispara una CI que lintea, typechequea, testea y buildea todo el monorepo; el backend productivo sigue desplegándose sin intervención manual; web tiene su propio pipeline de deploy apuntando al monorepo.

---

## Story 5.1 — GitHub Actions CI básica

**Status**: Draft

**Story**
Como dev, quiero una CI que valide el monorepo entero en cada push y PR, para detectar regresiones temprano.

**Acceptance criteria**
1. Existe `.github/workflows/ci.yml` con un job `check` que: checkout, setup pnpm, setup node con `node-version-file: .nvmrc`, `pnpm install --frozen-lockfile`, `pnpm turbo run lint typecheck test build`.
2. El workflow corre en push a `master` y en todos los PRs.
3. Turbo remote cache opcional — por ahora cache local es suficiente.
4. Si la CI falla, el PR queda bloqueado (rama protegida — tarea de configuración fuera del workflow).

**Tareas**
- [ ] Escribir el YAML.
- [ ] Push y validar primer run.
- [ ] (Opcional) Configurar branch protection en GitHub.

**Dev notes**
- Ver esqueleto completo en `docs/architecture.md §7`.
- Fijar la versión de pnpm vía `pnpm/action-setup@v4` con input `version` leyendo `packageManager` del `package.json`.

**Dependencias**: Epic 1 completo (la CI necesita el monorepo montado).

---

## Story 5.2 — Preservar el deploy productivo del backend

**Status**: Draft

**Story**
Como dev, quiero que el backend se siga desplegando al mismo host productivo, para no romper a los clientes (web en Vercel, canister ICP) durante ni después de la migración.

**Acceptance criteria**
1. Queda documentado en `docs/decisions/deploy-backend.md` cuál de las tres opciones del `docs/architecture.md §6` se eligió (A: `rootDirectory`, B: Dockerfile, C: `pnpm deploy`).
2. La decisión se implementa:
   - Si A: se reconfigura el servicio del host apuntando `rootDirectory` a `apps/backend/` y adaptando comandos.
   - Si B: existe `apps/backend/Dockerfile` multi-stage que copia `package.json` raíz + `pnpm-lock.yaml` + `pnpm-workspace.yaml`, instala con filter, compila y produce una imagen que arranca con `node dist/main`.
   - Si C: existe un workflow que corre `pnpm deploy --filter=backend /out` y publica el artefacto al host.
3. Un deploy real al ambiente de staging (o el que haya) pasa smoke tests.
4. `docs/brownfield-architecture.md` (o el README del monorepo) documenta cómo hacer un deploy manual de emergencia.

**Tareas**
- [ ] Inspeccionar la config actual del host.
- [ ] Elegir opción.
- [ ] Implementar.
- [ ] Deploy de prueba.

**Dev notes**
- Antes de mergear esta story, tener un plan de rollback: si el deploy nuevo falla, poder volver al pipeline anterior apuntando a un tag pre-migración.
- Si el host es Vercel/Railway/Render con integración directa a GitHub, la configuración de `rootDirectory` suele ser un setting en la UI, no código.

**Dependencias**: Epic 1 (el backend ya vive en `apps/backend`).

---

## Story 5.3 — Pipeline de deploy para `apps/web`

**Status**: Draft

**Story**
Como dev, quiero que la web productiva se siga desplegando a Vercel (o el host actual) desde el monorepo, sin perder la URL actual.

**Acceptance criteria**
1. El proyecto Vercel (asumiendo Vercel, confirmar) se reconfigura con `rootDirectory: apps/web` y `installCommand` apropiado (`pnpm install` con filter).
2. Un push a `master` dispara un deploy automático de `apps/web`.
3. La URL productiva (`gastonfinance.vercel.app` o la que sea) sigue funcionando.
4. Si es necesario, se agrega un `.vercelignore` o config equivalente para que Vercel no falle por archivos ajenos al workspace.

**Tareas**
- [ ] Reconfigurar el proyecto del host.
- [ ] Smoke del deploy.

**Dev notes**
- Vercel tiene soporte nativo para monorepos con Turbo; leer su doc de monorepos antes de configurar.
- Si el proyecto de web actualmente vive en un repo separado y se migró en Epic 4, esta story cierra la transición.

**Dependencias**: Epic 4 (la web ya existe en `apps/web`).

---

## Story 5.4 — Documentar env vars por app

**Status**: Draft

**Story**
Como dev, quiero un mapa claro de qué env vars necesita cada app, para que el deploy y el onboarding no sean adivinanza.

**Acceptance criteria**
1. Existe un `.env.example` en la raíz y/o uno por app, listando todas las env vars requeridas.
2. Backend: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `CORS_ORIGINS` (post Epic 6).
3. Web: `NEXT_PUBLIC_API_URL` y las que agregue la story 4.2.
4. App: las que agregue la story 4.5.
5. El README del monorepo linkea a cada `.env.example` y explica cómo rellenarlos.

**Tareas**
- [ ] Escribir los `.env.example`.
- [ ] Actualizar README.

**Dev notes**
- Ninguno de los `.env.example` contiene valores reales; solo keys con descripción breve.

**Dependencias**: Story 5.3.

---

## Story 5.5 — (Opcional) Deploy pipeline para `apps/app`

**Status**: Draft — opcional, diferible

**Story**
Como dev, cuando la app móvil esté cerca de ir a producción, quiero un pipeline de builds con EAS (Expo Application Services), para generar builds de iOS/Android automatizables.

**Acceptance criteria**
1. Existe `apps/app/eas.json` con perfiles `development`, `preview`, `production`.
2. CI (o un workflow separado) dispara `eas build` para preview en PRs que tocan `apps/app/**`.
3. Documentado en `docs/deploy-app.md` cómo hacer un release manual.

**Tareas**
- [ ] Setup de cuenta EAS.
- [ ] Configurar eas.json.
- [ ] Workflow de CI opcional.

**Dev notes**
- Esta story se puede diferir: solo entra en scope cuando la app móvil tenga tracción real.
- EAS requiere cuenta Expo y credenciales de Apple/Google — infraestructura externa.

**Dependencias**: Story 5.4.
