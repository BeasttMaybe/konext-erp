# Backup and restore

Operational runbook for the Konext multi-database topology: one **central** database (companies, tenants, users, sessions) plus one **operational** database per tenant.

> Both scripts in this runbook are strictly read-only against every database. They open every connection with `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` and `SET default_transaction_read_only = on`, verify both settings actually took effect, and abort if they did not.

---

## 1. Prerequisites

### 1.1 PostgreSQL client tools

`pg_dump` and `pg_restore` must be on your `PATH`, and **their major version must be greater than or equal to the server's**. A dump taken by an older client against a newer server can be incomplete or fail to restore.

| Platform | Install |
|---|---|
| Windows | [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) — in the installer you only need *Command Line Tools*. Then add e.g. `C:\Program Files\PostgreSQL\17\bin` to `PATH`. |
| macOS | `brew install libpq && brew link --force libpq` |
| Debian/Ubuntu | `sudo apt install postgresql-client-17` |

Verify:

```bash
pg_dump --version
pg_restore --version
```

`npm run db:backup` refuses to run if `pg_dump` is missing, and aborts per-database if the client major version is lower than that server's major version.

### 1.2 Environment variables

The script reads them from your `.env` (loaded via `dotenv`):

| Variable | Meaning |
|---|---|
| `CENTRAL_DATABASE_URL` | Central database. Required — without it the script exits with a clear message. |
| `TENANT_<NAME>_DATABASE_URL` | One per tenant. The central `Tenant.connectionRef` column stores only the **variable name**, never a URL. |

Reference names are validated with the same rules as `lib/tenant/resolver-conexao-tenant.ts`: they must match `^TENANT_[A-Z0-9_]+_DATABASE_URL$`, must not start with `NEXT_PUBLIC_`, and must not contain `CENTRAL`.

### 1.3 Direct connections only — no pooler

**Every URL must be the direct endpoint.** URLs containing `-pooler` are rejected.

Two reasons: a pooler multiplexes sessions, which makes `SET SESSION CHARACTERISTICS` unreliable (the read-only guarantee would be void), and `pg_dump` needs a stable single session to take a consistent snapshot.

On Neon, the direct host is the pooled host with `-pooler` removed from the hostname.

---

## 2. Taking a backup

```bash
npm run db:backup
```

What it does:

1. Verifies `pg_dump` exists and prints its version.
2. Connects read-only to the central database and lists every tenant with `Tenant.status = 'ATIVO'` whose company has `Empresa.status = 'ATIVA'`.
3. Resolves each tenant's `connectionRef` to an environment variable. **A tenant whose variable is missing or whose reference is invalid is skipped with a warning and the run continues** — check the warnings, because a skipped tenant is a tenant with no backup.
4. For the central database and each resolved tenant, compares `pg_dump` major version against that server's major version, then runs:

   ```
   pg_dump --format=custom --no-owner --file backups/<YYYYMMDD-HHmm>/<slug>.dump <url>
   ```

   The child process also inherits `PGOPTIONS=-c default_transaction_read_only=on`.
5. Writes `backups/<YYYYMMDD-HHmm>/manifest.json`.

Exit code is non-zero if any database failed, so the backup is never silently partial.

### 2.1 Output layout

```
backups/
└── 20260917-1042/
    ├── central.dump
    ├── principal.dump
    ├── cunhado.dump
    └── manifest.json
```

`manifest.json` records, per file: `slug`, `arquivo`, `hostMascarado` (hostname only — never credentials), `tamanhoBytes`, `sha256`, `versaoPgDump`, `versaoServidor`, `iniciadoEm`, `concluidoEm`. It also lists `tenantsPulados` and `falhas`.

`backups/` is in `.gitignore`. **Never commit a dump** — these files contain full production data, including customer records and device unlock codes.

### 2.2 Verifying a backup

```bash
# Contents are readable and the archive is not truncated
pg_restore --list backups/20260917-1042/central.dump | head

# Integrity against the manifest
sha256sum backups/20260917-1042/central.dump          # Linux/macOS
Get-FileHash backups\20260917-1042\central.dump       # PowerShell
```

Compare the digest with the `sha256` field in `manifest.json`.

---

## 3. Restoring

> **Restore into a NEW, empty database. Never restore over a production database.**
> `pg_restore` is not a merge: with `--clean` it drops existing objects, and without it, it collides with them. There is no undo.

### 3.1 Create an empty target database

```bash
createdb -h <host> -U <user> konext_restore_20260917
```

On Neon, create a new branch or a new database through the console instead — that is faster and isolates the restore from production compute.

### 3.2 Restore

```bash
pg_restore \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --dbname "postgresql://<user>:<password>@<host>/konext_restore_20260917" \
  backups/20260917-1042/central.dump
```

- `--no-owner` / `--no-privileges` — the dump was taken with `--no-owner`; role names from the source do not need to exist in the target.
- `--exit-on-error` — stop at the first failure instead of producing a half-restored database that looks fine.
- Add `--jobs=4` for large tenants (works with `--format=custom`).

Restore each tenant dump into its **own** separate database. Tenants must never share a database — the entire isolation model of this system is one database per tenant.

### 3.3 Post-restore checks

```sql
-- Migration state as recorded in the restored database
SELECT migration_name, started_at, finished_at, rolled_back_at
  FROM "_prisma_migrations" ORDER BY started_at;

-- Spot-check volumes against the incident window
SELECT status, count(*) FROM "OrdemServico" GROUP BY status ORDER BY 1;
```

To point the application at a restored database, change only the `TENANT_<NAME>_DATABASE_URL` environment variable for that tenant. Do not edit `Tenant.connectionRef` in the central database to do this — the reference name is part of the security model.

---

## 4. Recommended routine

- **Before any schema change.** `npm run db:backup` is a precondition for `npm run db:migrate:deploy:manual`, which itself refuses to run without `CONFIRMAR_MIGRACAO=SIM`.
- **Before any incident investigation that could lead to data correction.**
- **Before promoting a tenant** or changing its `connectionRef`.
- Keep at least one backup taken *before* the current incident window, so a known-good state is always reachable.

### 4.1 Point-in-time consistency across databases

The central and tenant databases are dumped sequentially, not as one atomic snapshot. A tenant dumped at 10:44 and a central dumped at 10:42 can disagree about a session or a tenant row created in between.

For an investigation this is acceptable. For a real recovery, take the backup with the application stopped, or accept that sessions may need to be re-created after the restore (users simply log in again — `SessaoCentral` rows are disposable).

---

## 5. What this runbook does **not** cover

- Automated/scheduled backups. There is currently no cron, no retention policy and no offsite copy. `npm run db:backup` is manual and writes to local disk only.
- Encryption at rest for the dump files. Treat `backups/` as production data on your own machine.
- Restoring a single table or a single service order. Restore the whole database into a scratch database first, then copy out what you need.
