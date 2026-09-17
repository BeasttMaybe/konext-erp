# Tenant Operational Baseline (superseded)

> **No longer used by any script.** Provisioning now applies `prisma/migrations/0_baseline` through `prisma migrate deploy`, so a freshly provisioned tenant gets a real `_prisma_migrations` row instead of raw SQL applied outside Prisma's history. See [`docs/operacao/migrations.md`](../../docs/operacao/migrations.md). This file is kept only for history — nothing reads it anymore.

`operacional-baseline-20260706.sql` is the baseline used to provision new operational tenant databases from an empty PostgreSQL database.

It is generated from `prisma/schema.prisma` with Prisma 7.8:

```powershell
npx.cmd prisma migrate diff --from-empty --to-schema prisma\schema.prisma --script --output prisma\tenant-baseline\operacional-baseline-20260706.sql
```

This baseline is only for new tenants. It does not replace or rewrite `prisma/migrations`, and it is not used by `npm run build`.
