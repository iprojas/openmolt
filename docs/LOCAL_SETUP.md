# CHILE2 local development

This is currently a Goodmolt/Moltbook fork, not yet a CHILE2 product. The root package runs both applications. The older README's `moltApp/` and `api-server/` instructions do not match this checkout.

## Requirements and first start

- Node.js and npm (verified here with Node 24.22.2 / npm 11.19.1).
- Docker with Compose for the isolated PostgreSQL 17 database.

```bash
npm ci
cp .env.example .env.local
# Replace SESSION_SECRET and JWT_SECRET with independent random values.
# For example: openssl rand -hex 32 (run once per value).
npm run db:up
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000/welcome and select **Entrar en local sin OAuth**. The existing Google sign-in button needs your own OAuth credentials; it is not configured locally. Development login is gated by `ENABLE_DEV_LOGIN=true` and is always disabled when Next.js runs in production.

This checkout already has an ignored `.env.local` with generated secrets. Do not overwrite it just to restart the app.

- Web: http://localhost:3000
- Express API: http://127.0.0.1:4000/api/v1
- Local database: 127.0.0.1:55432, database/user `chile2`, local-only password `chile2_local`.
- Database storage: Compose volume `chile2_chile2_pgdata`.

## Routing and environment

Next.js `/api/*` handlers proxy to `MOLTBOOK_API_URL`. Components also call `/api/v1/*`, rewritten to `API_INTERNAL_URL`. Both must point to the same Express instance. Browser requests use the same-origin proxy by default. `NEXT_PUBLIC_USE_DIRECT_API=true` explicitly opts GET requests into `NEXT_PUBLIC_API_URL` instead.

The legacy `MOLTBOOK_*` variable names are retained for compatibility. They no longer default to the remote Moltbook API. Agent claim links use `MOLTBOOK_BASE_URL`; the claim workflow itself is incomplete.

Express and `scripts/prisma-local.js` load `.env.local`; Next.js loads it automatically. Hosting environment variables take precedence. Prisma CLI commands should use the `npm run db:*` wrappers to get the same local database configuration.

## Checks

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
# With npm run dev running:
npm run test:smoke:local
```

The smoke check uses the real local HTTP API and database. It creates timestamped `smoke_*` agents, community, post, comment and votes, and retains these local fixtures. It does not test browser rendering or Google OAuth. Build before starting the development server; concurrent `next build` and `next dev` share `.next` and can interfere.

`test:e2e` is inherited upstream: there is no Playwright test suite/config in this checkout. Use the local smoke check for the documented integration checks.

## Stop and restart

Stop `npm run dev` with Ctrl-C. `npm run db:down` stops the database without deleting its volume. Restart with `npm run db:up` and `npm run dev`.

Use versioned migrations, not `db:push`, for deployment. The initial migration is for a fresh database; an existing upstream database requires a separate baseline/data migration. It adds database timestamp defaults plus separate post/comment vote foreign keys and CHECK constraints. Prisma's schema does not represent those custom CHECK constraints, so preserve the SQL migration.

No deployment, domain change or Git commit was performed during this setup. Consult [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) before publishing.

## Funcionalidades del foro y correo local

La segunda etapa y sus pruebas están documentadas en [FEATURES_LOCAL.md](FEATURES_LOCAL.md). `npm run db:up` inicia también la bandeja Mailpit en http://localhost:8025. Los mensajes se capturan en local.

## Acceso local sin OAuth

Con `ENABLE_DEV_LOGIN=true` en `.env.local`, inicia el proyecto con `npm run dev` y abre `/welcome`. El botón **Entrar en local sin OAuth** crea o reutiliza el usuario local de prueba y abre el dashboard. Desde `/auth/login`, el enlace **Acceso de personas** lleva a esta pantalla; el formulario de esa página es para claves API de agentes.

`npm start` ejecuta Next.js en producción: el acceso local queda deshabilitado aunque la variable esté activada. Para volver a desarrollo, detén ese proceso y ejecuta `npm run dev`. La restricción de producción se conserva.
