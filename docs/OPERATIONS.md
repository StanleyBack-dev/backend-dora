# Operations

How to keep the Dora API running: routines, backup, restore and what to do
when something fails.

## Scheduled routines

`.github/workflows/routines.yml` calls the internal routes with
`Authorization: Bearer $CRON_SECRET`. They stay idle until the `API_URL`
(public URL of the API) and `CRON_SECRET` secrets exist in
**Settings → Secrets and variables → Actions**.

| When (Brasília time) | Route                                | What it does                                              |
| -------------------- | ------------------------------------ | --------------------------------------------------------- |
| Every 15 min         | `POST /internal/outbox/process`      | Retries notifications that failed (e-mail provider down…) |
| 03:30                | `POST /internal/maintenance/cleanup` | Deletes expired data (see "Data retention")               |

To run them now: **Actions → Routines → Run workflow**.

## Data retention (LGPD)

The daily cleanup keeps only what is needed:

| Data                                 | Kept for                 |
| ------------------------------------ | ------------------------ |
| Ended sessions (with IP and browser) | 30 days after they end   |
| Password recovery codes              | 7 days after they expire |
| Delivered queue messages (outbox)    | 30 days                  |
| Read notifications                   | 1 year                   |
| Per-IP rate limit counters           | 1 day (only the IP HMAC) |
| System logs                          | 90 days                  |

## Backup and restore (Neon)

Neon keeps the database history (_point-in-time restore_). The window depends
on the plan: check **Project → Settings → Storage**.

### Restore an earlier point in time

1. In the Neon console, open the project → **Branches** → **Create branch**.
2. Pick the production branch as the source and choose **Past data**
   (_point in time_) with the date and time you want.
3. Check the data on the new branch, through the **SQL Editor** or by pointing
   a local API at its connection string.
4. To bring production back to that point, use **Restore** on the production
   branch with the same moment. Neon keeps the previous state as an automatic
   backup, so it can be undone.
5. Run `npm run migration:run:prod` if the restore went back to before a
   migration.

### Off-Neon copy (monthly, recommended)

```bash
pg_dump "$DATABASE_URL_DIRECT" --format=custom --no-owner --file=dora-YYYY-MM-DD.dump
```

- Use the **direct** connection string (without `-pooler`).
- The file holds personal data (names, e-mails, phones). Keep it somewhere
  private with restricted access. **Never** in the repository nor as a GitHub
  Actions artifact.
- To restore: `pg_restore --no-owner --dbname "$DATABASE_URL_DIRECT" dora-YYYY-MM-DD.dump`
  on an empty branch.

Files (profile photos) live in Neon Object Storage, on the same branch.
Restoring the database does not restore deleted files.

## When something goes wrong

- **Notifications don't arrive:** the manager's dashboard shows failed
  notifications when the queue gave up on any. Look at `tb_outbox` with
  `status = 'FAILED'` and its `last_error` column (already free of personal
  data). Fix the cause (e.g. `BREVO_API_KEY`) and move the rows back to
  `PENDING`:

  ```sql
  UPDATE tb_outbox SET status = 'PENDING', attempts = 0, next_attempt_at = now()
   WHERE status = 'FAILED';
  ```

  The next run (within 15 min) resends them.

- **Someone got locked out:** an administrator can unlock the account in
  **Administração → Usuários**. The per-IP limit (`AUTH_TOO_MANY_REQUESTS`)
  clears by itself within 15 minutes.

- **Leaked key:** generate a new one with `npm run secrets:generate` and update
  the variable on Vercel (and on the frontend, for `INTERNAL_API_KEY`).
  Rotating `JWT_ACCESS_SECRET` or `AUTH_HASH_SECRET` ends every session.
