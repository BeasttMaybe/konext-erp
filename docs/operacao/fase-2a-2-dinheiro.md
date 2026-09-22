# Phase 2A-2 — money as decimal

Branch `fase-2a-2-dinheiro` (from `main`, includes phase 2A-1 up to `6675566`). Makes money exact everywhere: `Decimal(12,2)` in the database for money columns, `Decimal(7,4)` for percentages, integer-cents arithmetic in `lib/dinheiro.ts` on the server, and formatting only at the edge.

## Migration applied and verified

The owner applied migration `20260922120000_dinheiro_vira_decimal` on the TEST tenant (`ep-purple-field-aq2o0ful`), restore point `antes-dinheiro-teste`. `npm run db:verificar-dinheiro -- --depois` confirms **no divergence** against the `--antes` export: all 47 converted columns have an identical scaled sum, zero rows needed rounding. `npm run db:relatorio-os` reports the same numbers as before the migration (Grupo A=0, B=4, C=21). `prisma migrate status` reports the tenant up to date.

## Carried over to phase 2A-3

The owner decided these items are out of scope for 2A-2 and move to a future phase 2A-3, rather than being folded into this one:

- **`Meta.valorAlvo`/`valorAtual` and `HistoricoMeta.valorAnterior`/`valorNovo`** — still `Float`. These are polymorphic: depending on `Meta.tipoValor` at runtime, the same column holds money, a percentage, or a plain quantity, so none of the three categories from this phase's inventory (MONEY/PERCENTAGE/QUANTITY) fits cleanly. A future phase should either split the model by `tipoValor` or design a typed representation before converting these columns.
- **`app/actions/os-itens.ts`** — still does money arithmetic in floating point; not moved onto `lib/dinheiro.ts` in this phase.
- **Raw SQL with `::double precision`** in `app/actions/dashboard.ts` and `app/actions/garantias.ts` — `SUM(...)::double precision` casts used for KPI aggregation; not converted to cents-exact arithmetic in this phase.
- **Client-side margin previews** — `store/useCartStore.ts` (PDV cart preview) and `components/estoque/modal-novo-produto.tsx` (new-product margin preview) still compute in floating point. Both are previews only; the server recomputes the authoritative value on save, so the risk is display-only, not a stored value.

None of these carried-over items were found to hold incorrect data today (the verification above shows zero rounding drift across the converted columns) — they're deferred because they don't fit this phase's scope or categorization, not because a bug was found in them.
