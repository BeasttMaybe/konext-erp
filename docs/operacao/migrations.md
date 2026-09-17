# Migrations

Operational runbook for `prisma/migrations` (tenant schema) and the per-tenant migration runner. Read [`backup-restore.md`](./backup-restore.md) first — every write path here starts with a backup.

> **Hard rule, no exceptions:** never run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against any environment. They are dev-convenience commands that can drop or reset data. This project only ever uses `prisma migrate diff` (read-only, to *compute* SQL) and `prisma migrate deploy` / `prisma migrate resolve` (to *apply or record* it).

---

## 1. Why `prisma/migrations` was rebuilt (F-09)

[`docs/AUDIT_REPORT.md`](../AUDIT_REPORT.md) (finding F-09) recorded that the tenant migration history could not rebuild the schema: the first migration, `20260621_baseline_producao`, is three comment lines with no SQL, and from that point on the folders only ever recorded *incremental* diffs. 22 of the 28 tenant models never had a `CREATE TABLE` anywhere in `prisma/migrations/`. The only place the full DDL existed was `prisma/tenant-baseline/operacional-baseline-20260706.sql`, a hand-generated script used only by tenant provisioning, outside `migrate deploy`/`migrate status` entirely.

Practically, this meant: `prisma migrate status` and `prisma migrate deploy` were trustworthy for a database that was *already* running (the incremental folders applied cleanly on top of a production database that already had the tables), but the same history could never build a new database — provisioning had to fork off sideways into raw SQL instead of the normal Prisma flow.

The central schema (`prisma/central/schema.prisma`) did **not** have this problem — both of its migrations (`20260706010226_init_central`, `20260706060000_sessao_central`) contain real `CREATE TABLE`/`CREATE TYPE` statements, and the production diagnostic (`docs/diagnostico/central.md`) shows zero drift. Central's migration history is left untouched.

## 2. The new tenant baseline

`prisma/migrations/0_baseline/migration.sql` is a **complete** DDL script — every enum, table, index, and foreign key in `prisma/schema.prisma` — generated with:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/0_baseline/migration.sql
```

This is the same mechanism the old `prisma/tenant-baseline/*.sql` file used, just saved as a real migration folder instead of a side file, so it participates in `migrate status`/`migrate deploy`/`_prisma_migrations` like any other migration.

Before generating it, Part 1 of this phase added the one column the live production tenant had that the schema didn't (`@@index([retornoGarantiaId])` on `OrdemServico` — see `docs/diagnostico/principal.md` section 3). With that in place, `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` against the live tenant database returns `-- This is an empty migration.` — i.e. `0_baseline` reproduces production **exactly**, column for column, index for index.

The 7 old migration folders were moved to `prisma/migrations-legado/` — kept on disk for history, never applied again, and never referenced by `prisma.config.ts` (whose `migrations.path` still points at `prisma/migrations`, which now contains only `0_baseline` plus `migration_lock.toml`):

| Old folder (now under `migrations-legado/`) | Lines |
|---|---:|
| `20260621235500_corrigir_schema_ordem_servico_garantias` | 64 |
| `20260621_baseline_producao` (the placeholder — 3 comment lines, no SQL) | 2 |
| `20260621_garantias_auditoria_dashboard` | 307 |
| `20260624093000_adicionar_configuracoes_os_garantias` | 12 |
| `20260624_multi_pagamento_pdv` | 62 |
| `20260626120000_adicionar_configuracoes_pdv_pagamentos` | 112 |
| `20260903120000_adicionar_modelos_impressao_os` | 9 |

`prisma/tenant-baseline/*.sql` is still on disk (nothing was deleted) but is no longer referenced by any script — see section 4.

## 3. Adopting the baseline on an EXISTING database (one-time, per tenant)

A tenant that already has all 28 tables (i.e. every tenant that existed before this phase) must **never** have `0_baseline` actually *executed* against it — the tables are already there, so running the DDL would fail on "relation already exists". Instead, tell Prisma to treat it as already applied, once:

```bash
# 1. Back up first. Always.
npm run db:backup

# 2. Point DATABASE_URL at that ONE tenant (direct connection, no -pooler),
#    then mark 0_baseline as already applied without running its SQL:
DATABASE_URL="<that tenant's connection string>" npx prisma migrate resolve --applied 0_baseline
```

```powershell
# PowerShell equivalent
$env:DATABASE_URL = "<that tenant's connection string>"
npx prisma migrate resolve --applied 0_baseline
```

This writes one row to that tenant's `_prisma_migrations` table (`migration_name = '0_baseline'`, `finished_at` set, `rolled_back_at` null) and touches nothing else — no table is created, altered, or dropped. After this, `prisma migrate status` reports the tenant as up to date, and `prisma migrate deploy` will only ever apply migrations *added after* `0_baseline`.

`scripts/migracao/migrar-tenants.mjs` (section 5) checks for exactly this row before doing anything else and refuses to proceed if it's missing — it will never attempt to silently resolve it for you, because writing to `_prisma_migrations` on an existing tenant is a one-time decision an operator should make deliberately, watching the masked host.

## 4. New databases (provisioning)

`scripts/provisionar-tenant-cunhado.mjs` no longer reads `prisma/tenant-baseline/*.sql` and executes it as raw SQL. It now runs `prisma migrate deploy` (via the shared helper in `scripts/lib/migracoes.mjs`) against the empty target database. Since the only migration in `prisma/migrations/` is `0_baseline`, this applies exactly the same DDL as before — but through the normal Prisma flow, so the new tenant's `_prisma_migrations` table already has a proper, *actually applied* `0_baseline` row from the moment it's created. New tenants never need the `resolve --applied` step in section 3; that step exists only for tenants that predate this baseline.

`Tenant.versaoSchema` is now set from the real migration folder name (currently `0_baseline`) instead of a hand-typed string, via `obterUltimaMigracaoTenant()` — so provisioning and the runner in section 5 always agree on what "up to date" means.
