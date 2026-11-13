# Dora — Backend

NestJS + **GraphQL** (Apollo, code-first) API for **Dora**, an app for booking
courts and shared spaces in condominiums. This repository holds the platform
core (accounts, access groups, public sign-up link, notifications,
announcements, support, system logs). Feature modules — starting with
**bookings** — are added on top of it.

## Architecture

Modular DDD with Ports & Adapters. Each module has its own layers:

```
src/modules/<module>/
├── domain/                pure rules (no Nest, TypeORM, GraphQL) — lint blocks those imports
├── application/           use cases + ports (interfaces) — depends only on ports
├── infrastructure/        adapters (TypeORM, Neon Object Storage, Brevo, Web Push)
└── presentation/graphql/  resolvers + DTOs (@ObjectType / @InputType)
```

- A module only talks to another through what it exports in its `*.module.ts`.
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

| Module           | Responsibility                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`       | Users, credentials (scrypt), sessions (access JWT + revocable refresh), first access, password recovery, lockout and the ADMIN_MASTER bootstrap |
| `access-control` | Groups (`USER` = resident, `ADMIN` = manager, `ADMIN_MASTER`), default permissions per group, per-user overrides, `PermissionsGuard`            |
| `audit`          | Record stamps: who created and who last changed each record                                                                                     |
| `enrollment`     | Public sign-up link: invite code → form → review by an administrator, which creates the account                                                 |
| `profile-photos` | The signed-in user's profile photo (object storage)                                                                                             |
| `mails`          | Provider (log or Brevo) + templates                                                                                                             |
| `outbox`         | Transactional queue between modules, with retries                                                                                               |
| `notifications`  | Inbox, e-mail (with `.ics` attachments) and Web Push, with per-person preferences                                                               |
| `broadcasts`     | Announcements to everyone or to one access group                                                                                                |
| `support`        | Support requests answered by the administrators                                                                                                 |
| `system-logs`    | Errors, security events and failed routines (Administração → Logs), alerts to ADMIN_MASTER                                                      |
| `dashboard`      | Manager's overview (read-only counts)                                                                                                           |
| `maintenance`    | Daily cleanup of expired data (sessions, codes, queue, read notifications)                                                                      |

Global guards, in this order: internal BFF key → session → first access
(temporary password) → permissions. Permissions are read on every request, so
a revocation applies immediately.

### Adding a module

1. Create `src/modules/<module>/` with the four layers above.
2. Add its permissions to `access-control/domain/permission.ts` and grant them
   in `group-permissions.ts`.
3. Add a migration (`npm run migration:create`) — never `synchronize`.
4. Register the module in `app.module.ts`, then `npm run schema:generate`.

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
