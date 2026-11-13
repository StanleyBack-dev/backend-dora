# Dora — Backend

NestJS + **GraphQL** (Apollo, code-first) API for **Dora**, an app for booking
courts and shared spaces in condominiums. This repository holds the platform
core (multi-tenant condominiums, accounts, access groups, public sign-up link,
notifications, announcements, support, system logs). Feature modules —
starting with **bookings** — are added on top of it.

## Architecture

Modular DDD with Ports & Adapters. Each module has its own layers:

```
src/modules/<module>/
├── domain/                pure rules (no Nest, TypeORM, GraphQL) — lint blocks those imports
├── application/           use cases + ports (interfaces) — depends only on ports
├── infrastructure/        adapters (TypeORM, Neon Object Storage, Brevo, Web Push)
└── presentation/graphql/  resolvers, DTOs and mappers
```

One responsibility per file:

| File                                             | Holds                                                        |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `application/use-cases/<x>.use-case.ts`          | one use case class                                           |
| `application/ports/<x>.port.ts`                  | an interface + its injection token                           |
| `infrastructure/.../<x>.orm-entity.ts`           | one TypeORM entity                                           |
| `presentation/graphql/<x>.resolver.ts`           | one resolver class, no inline types                          |
| `presentation/graphql/dto/inputs/<x>.input.ts`   | one input DTO (`@InputType`, validated with class-validator) |
| `presentation/graphql/dto/outputs/<x>.output.ts` | one output DTO (`@ObjectType`) or paginated type             |
| `presentation/graphql/<module>.graphql-enums.ts` | the module enums exposed in the schema (`registerEnumType`)  |
| `presentation/graphql/<x>.mapper.ts`             | domain → DTO mapping (other modules import mappers)          |

- A module only talks to another through what it exports in its `*.module.ts`.
- **Multi-tenant.** Each condominium is a tenant. Data that belongs to one
  carries `idtb_condominiums`, and the API takes it from the session
  (`tenantOf(user)` in `common/auth/tenant.ts`), never from the client.
  People have one account and join condominiums through memberships, which
  hold their role there and their unit.
- GraphQL lives at `/graphql`. REST exists only for the health check (`GET /`)
  and the `/internal/*` routes called by the scheduled workflows.
- Every request needs the `X-Internal-Api-Key` header: only the BFF (Next.js)
  knows that key.
- Errors come as `{ message, extensions: { code, statusCode, details } }`
  (`AppException` + catalogs in `src/common/exceptions/catalogs`). Messages
  are user-facing, so they are written in Portuguese.
- GraphQL protections: introspection off in production, no playground, depth
  limit (`depthLimitRule`) and alias limit (`aliasLimitRule`).
- Login and password recovery are rate limited per IP (`AuthThrottleService`)
  on top of the per-account lockout. The IP is only stored as an HMAC.
- Logs go through `redact()`, which masks e-mails, phones and tokens (LGPD).

### Modules

| Module           | Responsibility                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condominiums`   | The tenants (created and suspended by the platform) and their units (blocks and numbers, created in ranges)                                                                                       |
| `identity`       | Users, credentials (scrypt), sessions (access JWT + revocable refresh, with the session's condominium), memberships, member management, password recovery, lockout and the ADMIN_MASTER bootstrap |
| `access-control` | Roles (`USER` = resident, `ADMIN` = manager, per membership; `ADMIN_MASTER` = platform), default permissions per role, per-membership overrides, `PermissionsGuard`                               |
| `audit`          | Record stamps: who created and who last changed each record                                                                                                                                       |
| `enrollment`     | Public sign-up link per condominium: invite code → form (with the unit) → review by its managers, which gives access                                                                              |
| `profile-photos` | The signed-in user's profile photo (object storage)                                                                                                                                               |
| `mails`          | Provider (log or Brevo) + templates                                                                                                                                                               |
| `outbox`         | Transactional queue between modules, with retries                                                                                                                                                 |
| `notifications`  | Inbox, e-mail (with `.ics` attachments) and Web Push, with per-person preferences                                                                                                                 |
| `broadcasts`     | Announcements to the members of a condominium (everyone or one role)                                                                                                                              |
| `support`        | Support requests answered by the administrators                                                                                                                                                   |
| `system-logs`    | Errors, security events and failed routines (Administração → Logs), alerts to ADMIN_MASTER                                                                                                        |
| `dashboard`      | Manager's overview of the condominium (read-only counts)                                                                                                                                          |
| `maintenance`    | Daily cleanup of expired data (sessions, codes, queue, read notifications)                                                                                                                        |

Global guards, in this order: internal BFF key → session → first access
(temporary password) → permissions. The session guard resolves the caller's
condominium and role there on every request (`resolveTenantContext`), so
switching condominiums, a revocation or a suspension applies immediately.

### Adding a module

1. Create `src/modules/<module>/` with the four layers above (one
   responsibility per file).
2. Add its permissions to `access-control/domain/permission.ts` and grant them
   in `group-permissions.ts`.
3. Give tenant data an `idtb_condominiums` column and scope every query with
   `tenantOf(user)`.
4. Add a migration (`npm run migration:create`) — never `synchronize`.
5. Register the module in `app.module.ts`, then `npm run schema:generate`.

### Schema

The schema is generated from the resolvers. `src/graphql/schema.gql`, which
the frontend uses to generate types, only comes from:

```bash
npm run schema:generate   # no database needed
```

CI fails if the file is outdated (`npm run schema:check`).

### E-mail

`MAIL_DRIVER=log` writes e-mails to the console without sending (use it until
the Brevo account exists). `MAIL_DRIVER=brevo` really sends and requires
`BREVO_API_KEY` and `MAIL_FROM_EMAIL`.

## Running locally

```bash
npm install
# .env.local already lists every variable: fill in the empty values
npm run secrets:generate          # INTERNAL_API_KEY, CRON_SECRET, JWT_ACCESS_SECRET, AUTH_HASH_SECRET
npm run migration:run
# first admin: fill in BOOTSTRAP_ADMIN_MASTER_* with ENABLED=true, start the
# API once, then set it back to ENABLED=false
npm run start:dev                 # http://localhost:4000/graphql
```

The first admin is the platform administrator (`ADMIN_MASTER`). In the app,
open **Condomínios**, create a condominium and click **Entrar**: from there add
its units, its manager (Gestor) and the sign-up links for the residents.

## Deploy (Vercel + Neon)

1. Create the database on Neon and copy the **pooled** connection string.
2. Import this repository on Vercel and set the variables from `.env.example`
   with `NODE_ENV=production`.
3. The `deploy-backend.yml` workflow runs the migrations before each
   production deploy.

Scheduled routines (`.github/workflows/routines.yml`) run on **GitHub
Actions**, calling `/internal/*` with `CRON_SECRET` (not Vercel cron). They
need the `API_URL` and `CRON_SECRET` repository secrets.

Backup, restore and day-to-day operations are in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Scripts

`npm test` · `npm run lint:check` · `npm run typecheck` · `npm run build` · `npm run schema:generate` · `npm run migration:create` · `npm run storage:cors` · `npm run push:vapid`
