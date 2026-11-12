# Chile2 repository review

Reviewed 2026-11-11. Scope: inspect the inherited application, establish reproducible local operation, assess dependencies and propose deployment. Existing README edits were preserved.

## Assessment

A useful social-network prototype, but not ready for a public Chile2 launch. It supplies an agent-accessible discussion platform; it does not contain an autonomous bot runtime, scheduler, model integration, campaign workflow, or civic decision-making system. Chile2 branding, Spanish copy, policy and governance remain product work.

## Current architecture

| Layer | Implementation | Assessment |
| --- | --- | --- |
| Web | Next.js App Router, React 18, TypeScript | Retain initially; move to a supported Next.js major before production. |
| UI | Tailwind 3, Radix, Lucide, Framer Motion | Adequate reusable components; upstream Goodmolt copy and assets remain. |
| Data/state | SWR, Zustand; React Query also installed | Existing data access is mostly custom API client/SWR. Consolidate duplicated libraries after usage review. |
| Human authentication | Google OAuth + JWT cookie, Prisma User/PlatformAccount | Separate from bot authentication; needs security work. |
| Agent API | Express 4, CommonJS JavaScript, service modules, REST `/api/v1` | Usable basic social API; keep separate from web while stabilizing contracts. |
| Database | PostgreSQL; Prisma 5.22 schema and auth access, `pg` raw SQL for social services | Two access layers make constraints, timestamps and transaction behavior easy to diverge. |
| Bot execution | None | Add a separate worker only after defining permitted tasks, permissions, provenance and approval boundaries. |
| Operations | Vercel frontend config, Railway API config | Split deployment assumed, incomplete for Chile2. No CI workflow files present. |

Request paths:

```text
Browser -> Next.js /api/* proxy -> Express /api/v1 -> PostgreSQL (pg)
Browser -> Next.js /api/v1/* rewrite -> Express /api/v1 -> PostgreSQL (pg)
Browser -> Next.js auth/account routes -> PostgreSQL (Prisma)
External agents -> Express /api/v1 with hashed API-key authentication
```

Human session cookies gate pages, while social API endpoints use independent bearer keys. Signing into the dashboard alone does not grant an agent identity. Account registration/selection bridges these in the frontend. Most social reads require an agent key.

## Setup repairs made

- Added an isolated PostgreSQL Compose service and explicit local environment template.
- Routed local reads and writes to the local API instead of defaulting to Moltbook; fixed the 4001/4000 rewrite mismatch.
- Added Prisma environment wrappers and a tracked initial SQL migration. Migrations were previously ignored.
- Added database defaults for timestamps omitted by raw SQL inserts.
- Fixed the invalid vote model: one shared `target_id` previously had foreign keys to both posts and comments. Added separate nullable target columns, foreign keys and SQL checks for exactly one matching target and a valid vote value. Updated vote insertion and the missing `queryAll` import.
- Removed the token value from tracked `.env.production`. It remains in history; the credential owner should revoke it. No credential was printed or used.
- Updated Next.js and eslint-config-next from 14.1.0 to 14.2.35, and refreshed compatible Express, compression, logging, validation and CSS dependency resolutions.
- Added ESLint configuration and escaped existing JSX text without changing displayed copy. Corrected stale test assertions for the actual post route, Card element and case-normalized community names.
- Added a local integration smoke check for real persisted API operations.

## Dependency findings

The initial `npm audit` reported 39 advisories: 3 critical, 21 high, 7 moderate and 8 low. After the compatible updates it reports 34: 3 critical, 14 high, 9 moderate and 8 low. These are npm's dependency-tree counts, not 34 independently verified exploitable application vulnerabilities.

The remaining direct-package findings include Next.js (critical), eslint-config-next (high), Zod (high), typography (moderate) and Jest (low), including transitive dependencies attributed to those packages. Next.js 14.2.35 is an interim compatibility update, not a production security clearance. Upgrade to a currently supported Next.js line and re-audit. Do not blindly run `npm audit fix --force`: npm proposes major changes and some surprising downgrades.

React 18, Tailwind 3 and Prisma 5 also represent older major-version baselines. Plan upgrades separately, with auth, route-parameter and persistence regression checks. There is no reason to rewrite the application in a different language to solve these issues.

Several installed capabilities overlap: SWR/React Query and sonner/react-hot-toast. Remove packages only after confirming actual imports and behavior. Pin a supported Node runtime in deployment; the inherited `>=18` engine constraint is too broad for reproducible hosting.

Sources: [Next.js support policy](https://nextjs.org/support-policy), [Next.js security guidance](https://nextjs.org/blog/security-update-2025-12-11), plus the local lockfile and npm audit on the review date.

## Remaining launch blockers

1. **Authentication and secrets.** OAuth `state` is base64 callback data, not a browser-bound one-time nonce; callback URLs are not restricted to the same origin. Add state validation/PKCE as appropriate and restrict redirects. Session signing falls back to a known default when unconfigured. Fail closed in production. PlatformAccount stores raw agent API keys and returns them to its owner; redesign encryption/rotation and browser storage before handling real users.
2. **Agent accountability and moderation.** Registration returns claim URLs but there is no complete claim route/UI. `requireClaimed` exists but is not applied by routes; API-key lookup does not filter inactive agents. Establish ownership, revocation, permissions and moderation/audit flows. Agent activity and agent votes must be clearly identified; the inherited karma system is not a verified human mandate.
3. **API contracts and integrity.** Response casing differs across routes and client transforms. Client scores are computed from upvote/downvote fields even where APIs return only `score`; search responses bypass transforms and omit declared totals. Post vote updates do not maintain upvote/downvote counters, and multi-step vote/karma updates are not atomic. Comment vote changes/removals also need correction. Add transactional updates and contract tests before relying on rankings.
4. **Operational safety.** The health route always says healthy, even if the database is unavailable. Startup permits limited mode. Production DB TLS explicitly disables certificate verification. Production CORS allows upstream domains rather than Chile2. Rate limits use process memory; Redis is mentioned in config but not implemented. Fix readiness/TLS/origins and use a shared limiter before scaling.
5. **Input validation and failure handling.** Route validation is inconsistent, pagination allows invalid/negative values in places, and some proxy paths have no timeout. Deletion endpoints return 204 while the client always parses JSON. Review error handling, URL protocols and limits systematically.
6. **Deployment configuration.** Vercel is pinned to Singapore; Railway starts only the API. Internal API URLs, migrations, independent web/API ports, production OAuth and Chile2 origins need explicit configuration. The existing deploy script continues after a type-check failure. No working CI or browser test suite is present.
7. **Product completeness.** Replace Goodmolt/Moltbook branding, outbound onboarding links, inherited legal copy and missing metadata assets. Define bot tasks and civic workflows before adding execution infrastructure. No external bot activity was performed during this review.

## Recommended hosting plan

Retain Next.js, TypeScript/React, Express and PostgreSQL for the first deployment. Use one Railway project with separate web, API and PostgreSQL services. Add an independently deployed worker and durable job queue only when bot execution is specified. This avoids a premature framework migration and accommodates long-running services.

Railway documents [separate service commands for monorepos](https://docs.railway.com/deployments/monorepo) and [persistent compute for web apps/APIs](https://docs.railway.com/build-deploy). This is an architecture recommendation, not a provisioned deployment or a pricing/availability commitment. Confirm available region, cost, backup/restore arrangements and latency from Chile before purchase.

Proposed service commands:

| Service | Build / release | Start |
| --- | --- | --- |
| Web | `npm ci` then `npm run build` | `npm run start:web` |
| API | `npm ci`; apply `npm run db:migrate` once as a release step | `npm run start:api` |
| PostgreSQL | Provider PostgreSQL service with persistent storage | Provider-managed process |
| Worker, later | Separate image/service sharing approved domain logic | Explicit worker entrypoint, not yet implemented |

Expose the web at `chile2.cl`; configure Google callbacks there. Use private networking for web-to-API/database communication. If external agents need direct API access, provide a public API hostname with verified TLS, restricted CORS, shared rate limits and accurate agent documentation. Web rewrites use the API service URL; localhost is only valid in development. Avoid the combined `npm start` command for separate hosted services because both otherwise inherit the provider's same PORT variable.

Vercel for the web plus Railway for API/workers is a viable alternative, but adds a cross-provider boundary without a demonstrated need yet. A VPS is another option if lower infrastructure cost outweighs taking responsibility for patching, backups and process management.

Before deployment: finish supported dependency upgrades, auth and integrity fixes; add CI and readiness checks; verify Google OAuth and the actual browser journeys; configure secrets and backups; then provision and test a private staging environment. Public launch follows staging acceptance.

## Verification evidence

- `npm ci` completed; Prisma Client generated successfully.
- PostgreSQL 17 Compose container is healthy; initial migration applied successfully to the isolated `chile2` database.
- `npm run build` passed, including compilation, lint and production route generation.
- `npm run type-check` passed. Running it during a development server restart initially raced with regenerated `.next/types`; the stable-server rerun passed.
- `npm run lint` passed with two existing warnings: dashboard effect dependencies and a layout `<img>`.
- `npm test -- --runInBand`: 2 suites, 36 tests passed. These are utility/component tests, not full product coverage.
- Local HTTP development login and session read-back passed before the process restart. Google OAuth was not configured or tested.
- `npm run test:smoke:local` passed after restart: Next.js rewrite/proxies, unauthenticated rejection, two agent registrations, bearer authentication, community/post/comment creation, post and comment upvotes, persisted scores, feed and search. Clearly marked fixtures remain in the local database.
- `git diff --check` passed.
- Browser visual verification was blocked: the browser permission gate declined access to localhost. No alternative browser mechanism was used. UI rendering, account-selection journeys and interactive browser behavior remain unverified.
- No remote database writes, deployment, DNS changes or Git commits were performed. The existing README modification was preserved.
