# Migrations

Operational runbook for `prisma/migrations` (tenant schema) and the per-tenant migration runner. Read [`backup-restore.md`](./backup-restore.md) first: the one-time baseline adoption in section 3 still starts with `npm run db:backup`; the ongoing per-tenant runner in section 5 instead requires a Neon branch as a restore point (`PONTO_RESTAURACAO`) before it writes anything.

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

## 5. Ongoing migrations: the per-tenant runner (`npm run db:migrar`)

`scripts/migracao/migrar-tenants.mjs` loops over every `Tenant` with `status = 'ATIVO'` (of an `Empresa` with `status = 'ATIVA'`), read from the central database, in the same order `db:backup`/`db:diagnostico` use.

Before touching any tenant, `--aplicar` mode requires `PONTO_RESTAURACAO=<nome>` in the environment: the operator creates a Neon branch from the target database as a restore point and passes its name once, for the whole run. Without it the script aborts before processing any tenant — it never calls `pg_dump` itself. The name is printed in the run's header and echoed before each tenant's steps, so it ends up in the console log. `db:backup` (section 2) still exists as its own standalone command, kept for the future VPS deployment where Neon branching won't be available, but it is no longer part of this runner's pipeline.

For **each** tenant, in order:

1. Confirm `0_baseline` is resolved in that tenant's `_prisma_migrations` (section 3). If not, the run stops with the exact `migrate resolve` command to run first.
2. `prisma migrate status` — printed for visibility.
3. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` — the SQL this tenant is missing. Every non-comment line is checked against a fixed list of destructive patterns: `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, `DROP CONSTRAINT`, `TRUNCATE`, `DELETE`, `UPDATE`, `SET DEFAULT` on a column whose name contains "status" or "archiv", and `ALTER TYPE` on an enum. If any of these match, the exact offending SQL line is printed and the run stops unless `AUTORIZAR_DESTRUTIVO=SIM` is set.
4. `prisma migrate deploy` — applies whatever is pending.
5. Updates that tenant's `Tenant.versaoSchema` in the **central** database to the newest migration folder name.
6. Runs the same `migrate diff` from step 3 again and asserts it is now empty. If it isn't, the tenant is reported as `POS_DEPLOY_DIVERGENTE` and the run stops immediately — this should never happen if `migrate deploy` succeeded, so treat it as an emergency, not routine.

`prisma migrate deploy` applies each pending migration file in its own Prisma-managed transaction; that guarantee is Prisma's, not this script's. The `Tenant.versaoSchema` update in step 5 is a single-row update, trivially atomic on its own — there is no distributed transaction spanning the tenant database and the central database (Postgres doesn't support one across two separate databases), which is why step 6 exists as an explicit, separate safety check rather than relying on atomicity across steps 4–5.

There is no `LogAuditoria` entry for any of this: `LogAuditoria` is a tenant business-data model (used for OS/sales/financial mutations), and schema/DDL changes are not tenant business data. The audit trail for a migration run is the Neon restore point named in `PONTO_RESTAURACAO`, the migration history itself, and this script's console output.

### 5.1 Modes

| Flag | Behavior |
|---|---|
| *(none)*, or `--dry-run` | Default. Prints the full plan for every selected tenant — status, diff, destructive-pattern findings, whether `0_baseline` is resolved — and writes nothing anywhere; does not require `PONTO_RESTAURACAO`. Always evaluates **every** selected tenant, even if one of them would be blocked, so the operator sees the whole picture in one run. |
| `--aplicar` | Leaves dry-run. Also requires `CONFIRMAR=SIM` **and** `PONTO_RESTAURACAO=<nome do branch Neon>` in the environment, or it refuses to start. In this mode the run **stops at the first tenant that doesn't finish `OK`** and never proceeds to the next one. |
| `--tenant <slug>` | Restricts either mode to one tenant. |

```bash
# See the plan for every active tenant, write nothing
npm run db:migrar

# Same, for one tenant only
npm run db:migrar -- --tenant principal

# Actually migrate one tenant: create a Neon branch from that tenant's
# database first, then pass its name (after reviewing the dry-run plan)
CONFIRMAR=SIM PONTO_RESTAURACAO=pre-migracao-principal-20260917 npm run db:migrar -- --tenant principal --aplicar

# Actually migrate every active tenant
CONFIRMAR=SIM PONTO_RESTAURACAO=pre-migracao-20260917 npm run db:migrar -- --aplicar

# ...and if step 3 reports a genuinely intended destructive change
AUTORIZAR_DESTRUTIVO=SIM CONFIRMAR=SIM PONTO_RESTAURACAO=pre-migracao-principal-20260917 npm run db:migrar -- --tenant principal --aplicar
```

The final line of output is always a table — tenant, restore point, migrations applied, new `versaoSchema`, result — for every tenant that was evaluated, including the one that stopped the run.

### 5.2 When a tenant fails

The run stops immediately; no later tenant is touched. What to do depends on which step failed, read from the `resultado` column of the final table:

| Result | Meaning | Next step |
|---|---|---|
| `FALHA_POOLER` | That tenant's env var still has `-pooler` in the host. | Fix the `.env` entry, re-run. Nothing was touched. |
| `BLOQUEADO_RESOLVE` | `0_baseline` isn't marked applied for this tenant yet. | Run the `migrate resolve --applied 0_baseline` command from section 3 for that one tenant, then re-run `db:migrar`. |
| `ERRO_DIFF` | `prisma migrate diff` itself failed (connectivity, permissions, etc). | Investigate the printed stderr; the database was not touched. |
| `BLOQUEADO_DESTRUTIVO` | The pending SQL matched a destructive pattern. | Read the printed statement(s) carefully. If genuinely intended, re-run with `AUTORIZAR_DESTRUTIVO=SIM`. If not, fix the migration file instead. |
| `FALHA_DEPLOY` | `prisma migrate deploy` itself failed. | If the tenant was left in a partial state, recover through the Neon branch named in `PONTO_RESTAURACAO` for that run (promote it, or point `DATABASE_URL` at it) — there is no local dump to `pg_restore` from. Investigate the Prisma error before retrying. |
| `POS_DEPLOY_DIVERGENTE` | Deploy reported success but the post-deploy diff isn't empty. | Treat as an emergency: `Tenant.versaoSchema` was already updated in central, but the tenant database doesn't actually match `prisma/schema.prisma`. Investigate before running anything else against this tenant. |

A tenant that finishes `OK` needs no follow-up. Tenants after the failed one were never started — their row (if dry-run had shown one) simply doesn't reflect any actual attempt.

### 5.3 Adding a new migration (since `migrate dev` is banned)

1. Edit `prisma/schema.prisma`.
2. Generate the SQL for exactly that change against a database that's currently on the previous schema version:
   ```bash
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<YYYYMMDDHHMMSS>_<nome>/migration.sql
   ```
3. Commit the new folder together with the `schema.prisma` change, in the same PR.
4. Run `npm run db:migrar` (dry-run first) to roll it out tenant by tenant.

This is exactly how `0_baseline` itself and the `retornoGarantiaId` index fix were produced — there is no other sanctioned way to create a migration file in this project.

## 6. `aplicar-reparo-os.mjs` also requires a restore point

`scripts/reparo/aplicar-reparo-os.mjs` (`npm run db:reparar-os`) is a separate, one-off data-repair script — it does not touch `prisma/migrations` at all, it only applies what `docs/diagnostico/reparo-os.json` (generated by `npm run db:relatorio-os`) already decided per OS/term. It never called `pg_dump` on its own, but it writes to the tenant database, so it follows the same restore-point discipline as the runner in section 5:

- Running without `CONFIRMAR=SIM` only prints the header (environment, masked host, restore point, action, ids, motivo) and exits without touching anything — `PONTO_RESTAURACAO` is not required in this preview mode.
- Running with `CONFIRMAR=SIM` also requires `PONTO_RESTAURACAO=<nome do branch Neon>` in the environment, or it aborts right there, before reading `reparo-os.json` or opening any database connection.

```bash
# Preview only — no restore point needed
AMBIENTE=producao npm run db:reparar-os -- --acao arquivar --ids abc,def --motivo "Reparo Fase 1C-1 grupo A"

# Actually apply: create the Neon branch first, then pass its name
AMBIENTE=producao CONFIRMAR=SIM PONTO_RESTAURACAO=pre-reparo-os-20260917 npm run db:reparar-os -- --acao arquivar --ids abc,def --motivo "Reparo Fase 1C-1 grupo A"
```

## 7. `EtapaOS`/`SituacaoOS` dual-write (Fase 1C-3) and the future contract phase

`20260918120000_adicionar_etapa_situacao_os` adds `OrdemServico.etapa` (`EtapaOS`: `ORCAMENTO`/`CONSERTO`/`PRONTO`/`ENTREGUE`) and `OrdemServico.situacao` (`SituacaoOS`: `AGUARDANDO_APROVACAO`/`AGUARDANDO_PECA`), backfilled from the legacy `status` column in the same migration (`prisma migrate diff` only produces the `CREATE TYPE`/`ADD COLUMN`/`CREATE INDEX` statements; the `UPDATE ... WHERE "status" = ...` block was added by hand afterwards, following the same mapping as `lib/dominio/os/etapas.ts`). Because it contains `UPDATE`, `scripts/migracao/migrar-tenants.mjs` step 3 flags it as `BLOQUEADO_DESTRUTIVO` by design (its pattern list treats any bare `UPDATE` as destructive, with no exception for a reviewed backfill) — applying it requires `AUTORIZAR_DESTRUTIVO=SIM` after the operator has read the printed statements, exactly as section 5.2 describes for any other intentional destructive change. `status` itself is neither altered nor dropped by this migration.

From this migration forward, `StatusOS`/`status` enters a **dual-write, single-read** period:

- Every write that changes an OS's stage sets both `etapa`/`situacao` **and** `status`, in the same transaction, via `paraStatusLegado()` in `lib/dominio/os/etapas.ts` — the only function allowed to translate between the two. No other module may reimplement this mapping.
- Every read in the application uses `etapa`/`situacao`. `status` is kept in sync only so that anything still reading it directly (older reports, ad-hoc SQL) does not see a stale value — the application itself never reads it after this phase.
- The mapping is lossy in one direction only: the legacy statuses `APROVADO` and `EM_MANUTENCAO` both collapse into `etapa = CONSERTO` with no `situacao` distinguishing them (there is no "approved, not yet started" situation in the 4-stage model). Writing back from that stage always produces `EM_MANUTENCAO` — `APROVADO` can still be *read* on rows nobody has touched since before this phase, but the application never writes it again.
- `GARANTIA_RETORNO` is derived from `ehRetornoGarantia`, not stored as its own bit of the stage — an OS with `ehRetornoGarantia = true` sitting in `etapa = CONSERTO` with no situation writes back to `status = GARANTIA_RETORNO`; the same stage with `ehRetornoGarantia = false` writes back to `EM_MANUTENCAO`.

**What the contract phase removes later** (not scheduled yet — do not start it without an explicit spec): once every reader in the codebase, every report/script under `scripts/`, and every dashboard query have been confirmed to use `etapa`/`situacao` exclusively, a follow-up migration drops `OrdemServico.status`, `OrdemServico.statusAnterior` and the `StatusOS` enum, and `lib/dominio/os/etapas.ts` (along with the dual-write call sites) is deleted. Until that phase, `status` remains load-bearing for anything outside the application that still queries it directly, so it must keep receiving a correct value on every write — never left stale "because nothing reads it anymore."
