# Konext ERP — Technical Audit Report

**Audit date:** 2026-09-17
**Repository:** `konext-erp` (package name `konext-financeiro`), branch `main`, HEAD `a2e56d4`
**Scope:** Read-only investigation. No source file, schema, migration or configuration was modified.
**Written for:** the software architect planning the refactor. Claims carry file/line evidence; anything not confirmed is marked `UNVERIFIED`.

---

## 1. Executive Summary

### 1.1 What the system is

Konext is a Brazilian-Portuguese ERP for a technical-assistance (repair) shop. It covers ten operational modules — Dashboard, CRM (contacts, opportunities, commercial proposals), PDV (point of sale with cash session), Sales (orders + history), Stock, Service Orders (OS) with a Kanban board, Warranties (warranty terms and warranty returns), Financial (receivables, payables, invoices, intelligence), Goals (`Metas`) and Settings.

The architecture is **database-per-tenant multi-tenant**: a *central* PostgreSQL database (`prisma/central/schema.prisma`) holds companies, tenants, users and sessions; each tenant has its own *operational* database built from `prisma/schema.prisma`. A request resolves session → tenant → connection-string env var → a cached `PrismaClient` (`lib/tenant/exigir-contexto-tenant.ts:67-91`).

Runtime: Next.js 16.2.7 (Turbopack), React 19.2.4, Prisma 7.8.0 with the Neon serverless driver adapter, Tailwind CSS v4, deployed to Vercel (inferred from `scripts/migrate-deploy-com-retry.mjs` and README; there is no `vercel.json` or `.github/` in the repo).

### 1.2 Overall health

| Check | Result |
|---|---|
| `npx prisma validate` (tenant) | **PASS** — `prisma\schema.prisma is valid` |
| `npx prisma validate --config prisma.central.config.ts` | **PASS** |
| `npx prisma migrate status` (both schemas) | **CANNOT RUN** — `Error: The datasource.url property is required in your Prisma config file`. No `.env` exists in the repo (only `.env.example`), and both config files read `process.env` (`prisma.config.ts:9-11`, `prisma.central.config.ts:8-10`). Drift vs. a live database is therefore `UNVERIFIED`; drift vs. the schema files is analysed statically in §5.4. |
| `npx tsc --noEmit` — **on a clean checkout** | **FAIL, 2 errors** (see §1.3) |
| `npx tsc --noEmit` — **after `prisma generate` for both schemas** | **PASS, 0 errors** |
| `npm run lint` (`eslint`) | **FAIL — 12 errors, 33 warnings** (45 problems) |
| `npm run build` | **NOT RUN** — this script executes `node scripts/migrate-deploy-com-retry.mjs`, i.e. `prisma migrate deploy`, which mutates a database and is excluded by the audit rules. `npm run build:local` was run instead. |
| `npm run build:local` — **without DB env vars** | **FAIL** — `Failed to collect page data for /rastreio/[id]` … `[cause]: Error: DATABASE_URL nao definida para inicializar o Prisma.` |
| `npm run build:local` — **with dummy `DATABASE_URL`/`CENTRAL_DATABASE_URL`** | **PASS** — 34 routes emitted, 25 statically generated |

### 1.3 Diagnostics detail

**TypeScript on a clean checkout** (before any `prisma generate`):

```
app/actions/auth.ts(68,43): error TS7006: Parameter 'vinculo' implicitly has an 'any' type.
lib/central/prisma-central.ts(1,30): error TS2307: Cannot find module '@prisma/client-central' or its corresponding type declarations.
```

Both are consequences of one root cause: the *central* Prisma client is generated into `node_modules/@prisma/client-central` (`prisma/central/schema.prisma:3`) and only exists after `npm run prisma:central:generate`. `postinstall` runs plain `prisma generate` (tenant schema only), so a fresh `npm ci` leaves the repo un-typecheckable until someone runs the central generate manually or runs a build script.

**ESLint, by rule:**

| Count | Rule | Severity |
|---|---|---|
| 21 | `@typescript-eslint/no-unused-vars` | warning |
| 8 | `react-hooks/set-state-in-effect` | **error** |
| 5 | `@next/next/no-img-element` | warning |
| 3 | `react-hooks/exhaustive-deps` | warning |
| 3 | `react-hooks/incompatible-library` | warning |
| 3 | `react-hooks/refs` | **error** |
| 1 | `@typescript-eslint/no-empty-object-type` | **error** |
| 1 | `jsx-a11y/alt-text` | warning |

The 3 `react-hooks/refs` errors are all in `components/os/lista-coluna-kanban.tsx:72,73,79` and are caused by `@hello-pangea/dnd` passing refs through render props — the library is not React-19-compiler compatible. The 3 `react-hooks/incompatible-library` warnings are `react-hook-form` resolvers in the financial modals.

**Versions:**

| Package | Declared | Installed | Latest |
|---|---|---|---|
| node | — | v24.20.0 | — |
| npm | — | 11.19.0 | — |
| next | `16.2.7` | 16.2.7 | 16.3.5 |
| react / react-dom | `19.2.4` | 19.2.4 | 19.3.0 |
| typescript | `^5` | 5.9.3 | 7.0.2 |
| prisma / @prisma/client | `^7.8.0` | 7.8.0 | 7.10.0 (8.0.0-rc.15 is a major) |
| @prisma/adapter-neon | `^7.8.0` | 7.8.0 | 7.10.0 |
| @neondatabase/serverless | `^1.1.0` | — | — |
| tailwindcss | `^4` | 4.3.0 | 4.3.3 |
| zod | `^4.4.3` | 4.4.3 | 4.6.5 |
| eslint | `^9` | 9.39.4 | 10.10.0 |
| lucide-react | `^1.17.0` | 1.17.0 | **1.47.0** (30 minors behind) |

### 1.4 Top 10 most critical problems

| # | Severity | Problem |
|---|---|---|
| 1 | **Critical** | **No authorization layer at all.** `role` (`ADMIN`/`GESTOR`/`USUARIO`) is carried through the session and into `ContextoTenantServidor`, but no server action, page or route handler ever reads it to gate an operation. Any authenticated user can delete service orders, rewrite company settings, give financial discharge, open/close the cash register and change prices. Evidence: a repo-wide grep for role comparisons in `app/` and `lib/` returns only assignments (`lib/auth/sessao-central.ts:142`, `app/actions/auth.ts:97`, `lib/tenant/exigir-contexto-tenant.ts:78`) — zero checks. |
| 2 | **Critical** | **IDOR in `atualizarPerfil`.** `app/actions/configuracoes.ts:1318-1352` takes a client-supplied `usuarioId`, loads that row with `findUnique({ where: { id: usuarioId } })` and writes `nome`, `email` and `fotoPerfilUrl` to it with no ownership check. Any authenticated tenant user can rename/re-email any other user in the tenant. |
| 3 | **Critical** | **PDV trusts client-supplied prices.** `processarVenda(carrinho, total, pagamentos, clienteId)` (`app/actions/pdv.ts:778-1018`) reads `item.preco` and `total` straight from the browser. Only `custo` is re-read from the database (`pdv.ts:801-820`); `precoVenda` is never re-validated, and `validarTotalPagamentos` only checks that payments sum to the *client-supplied* total. A tampered Server Action payload can sell anything at any price, and the discount cap `descontoMaximoPDVPercentual` is enforced only in the UI (`app/(dashboard)/pdv/page.tsx:998-1002`). |
| 4 | **Critical** | **The build depends on runtime DB env vars because of a module-level throw.** `lib/prisma.ts:13-17` throws at import time if `DATABASE_URL` is missing, and `app/rastreio/[id]/page.tsx:10` imports it, so `next build` fails during "Collecting page data" on any environment without a database URL. |
| 5 | **Critical** | **The public tracking route is both unreachable and tenant-blind.** `/rastreio/[id]` is not in `ROTAS_PUBLICAS` (`proxy.ts:6`), so the proxy redirects anonymous visitors to `/login` — the customer-facing feature cannot work. And when it does render, it queries the legacy global client bound to `DATABASE_URL` (`app/rastreio/[id]/page.tsx:4-10`), i.e. a single hard-coded tenant, regardless of who owns the OS. The code comments acknowledge this as a deliberate exception. |
| 6 | **Critical** | **The service-order state machine does not exist.** `atualizarStatusOrdemServico` (`app/actions/os.ts:691-882`) validates only that the target value is a member of `statusValidos` (`os.ts:212-221`). There is no source→target transition matrix; `ENTREGUE → AGUARDANDO_ORCAMENTO`, or any other jump, is accepted. The only gates are three `ENTREGUE`-specific config checks (`os.ts:767-787`). The Kanban mirrors this — every column accepts a drop from every other column (`components/os/tabuleiro-kanban.tsx:195-265`). |
| 7 | **High** | **Migration history cannot rebuild the schema.** `prisma/migrations/20260621_baseline_producao/migration.sql` is a 3-line comment ("Baseline do banco de produção já existente… Esta migration não altera o schema"). No migration ever creates `Cliente`, `OrdemServico`, `Produto`, `Venda`, `PedidoVenda*`, `PropostaComercial`, `Conta`, `Oportunidade`, `Despesa`, `NotaFiscal`, `CaixaSession` or `Notificacao`. Those exist only in `prisma/tenant-baseline/operacional-baseline-20260706.sql`, which the README explicitly says "is not used by `npm run build`". `prisma migrate deploy` against a fresh database produces a schema the application cannot use. |
| 8 | **High** | **Defensive "delegate probing" is pervasive and hides real failures.** Roughly 40 sites do `prisma.ordemServico ?? prisma.OrdemServico` and fall back to `$queryRaw` when a Prisma call fails (`os.ts:717-735`, `os.ts:786-800`, `os.ts:499-536`, `configuracoes.ts:552-700`, `financeiro-pagar.ts:214-215`, `pdv.ts:802-803`, `api/cron/verificar-vencimentos/route.ts:41-46`). This is a workaround for finding #7 that converts schema drift into silent wrong answers, and it defeats all Prisma typing. |
| 9 | **High** | **No timezone handling anywhere.** Zero occurrences of `America/Sao_Paulo` or any IANA zone in the codebase. All day boundaries are computed with `setHours(0,0,0,0)` on server-local time (14 call sites). On Vercel that is UTC, so "today's cash", "today's revenue" and the vencimento cron (`app/api/cron/verificar-vencimentos/route.ts:48-58`) are off by three hours against a São Paulo business day — nightly sales land on the wrong day. |
| 10 | **High** | **Money is `Float`/`double precision` everywhere in the transactional path.** `ContaReceber.valor`, `Despesa.valorTotal`, `ParcelaDespesa.valor`, `Produto.custo`/`precoVenda`, `Venda.valorTotal`, `VendaPagamento.valorBruto/valorTaxa/valorLiquido`, `ItemVenda.*`, `ItemOS.custoPeca/valorCobrado`, `PropostaComercial.*`, `Meta.valorAlvo/valorAtual` are all `Float` (`prisma/schema.prisma`). `Decimal` is used only for settings percentages and two isolated columns. The PDV compensates with an ad-hoc cents layer (`paraCentavos`/`paraMoeda` in `lib/pdv/pagamentos.ts`), which the rest of the system does not use. |

---

## 2. Stack & Configuration

### 2.1 `package.json`

**Dependencies (32):**
`@hello-pangea/dnd ^18.0.1`, `@hookform/resolvers ^5.4.0`, `@neondatabase/serverless ^1.1.0`, `@prisma/adapter-neon ^7.8.0`, `@prisma/client ^7.8.0`, `@radix-ui/react-checkbox ^1.3.4`, `@radix-ui/react-tabs ^1.1.14`, `@react-pdf/renderer ^4.5.1`, `@tanstack/react-query ^5.101.0`, `axios ^1.17.0`, `bcryptjs ^3.0.3`, `class-variance-authority ^0.7.1`, `clsx ^2.1.1`, `cmdk ^1.1.1`, `date-fns ^4.4.0`, `dotenv ^17.4.2`, `lucide-react ^1.17.0`, `next 16.2.7`, `next-themes ^0.4.6`, `radix-ui ^1.5.0`, `react 19.2.4`, `react-dom 19.2.4`, `react-hook-form ^7.77.0`, `recharts ^3.8.1`, `shadcn ^4.10.0`, `sonner ^2.0.7`, `tailwind-merge ^3.6.0`, `tailwindcss-animate ^1.0.7`, `tw-animate-css ^1.4.0`, `ws ^8.21.0`, `zod ^4.4.3`, `zustand ^5.0.14`.

**devDependencies (11):** `@tailwindcss/postcss ^4`, `@types/bcryptjs ^2.4.6`, `@types/node ^20`, `@types/react ^19`, `@types/react-dom ^19`, `@types/ws ^8.18.1`, `eslint ^9`, `eslint-config-next 16.2.7`, `prisma ^7.8.0`, `tailwindcss ^4`, `typescript ^5`.

**Unused at source level** (zero `import` sites under `app/ components/ lib/ hooks/ store/ types/ contextos/ scripts/`): `axios`, `@tanstack/react-query`, `next-themes` (replaced by a hand-rolled `components/provedores/provedor-tema.tsx`), `tailwindcss-animate`, and `shadcn` — the latter is a CLI shipped as a **runtime** dependency, so it is bundled into the production install. `tw-animate-css` is used, but from CSS (`app/globals.css:2`), not from JS.

**Scripts (33).** Only 8 are developer-facing (`dev`, `build`, `build:local`, `start`, `lint`, `migrate:*`, `seed:demo`). The other 25 are one-off tenant-operations scripts — `tenant:cunhado:provisionar`, `tenant:principal:bootstrap`, seven `tenant:verificar-*-isolamento` scripts, etc. `postinstall: prisma generate` covers only the tenant schema (see §1.3).

Two build modes, documented in `README.md`:
- `build:local` = `prisma generate && prisma:central:generate && next build` — touches no database.
- `build` = the same plus `node scripts/migrate-deploy-com-retry.mjs` between generate and build. The script prints a masked host and the `AMBIENTE` value, then retries `prisma migrate deploy` up to 5 times with backoff, but **only** when the failure text matches an advisory-lock pattern (`scripts/migrate-deploy-com-retry.mjs:28-36`).

### 2.2 `next.config.ts`

```ts
experimental: { serverActions: { bodySizeLimit: "5mb" } },
serverExternalPackages: [
  "@prisma/client", "prisma", "ws",
  "@prisma/adapter-neon", "@neondatabase/serverless", "bcryptjs",
],
```

The 5 MB Server Action body limit exists because logos and profile photos are submitted as data URLs (see `normalizarUrlImagem` in `app/actions/configuracoes.ts`). `serverExternalPackages` carries an explicit comment that Turbopack would otherwise pull `__dirname`-using code into Edge bundles.

### 2.3 `tsconfig.json`

`strict: true`, `noEmit`, `target: ES2017`, `moduleResolution: "bundler"`, `isolatedModules`, `skipLibCheck: true`, `incremental`, `jsx: react-jsx`, the `next` TS plugin.

Strictness gaps: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` and `verbatimModuleSyntax` are all **unset**. `skipLibCheck: true` is what lets the missing `@prisma/client-central` types surface as a single import error rather than a cascade.

`paths` maps eight aliases (`@/app/*`, `@/components/*`, `@/hooks/*`, `@/types/*`, `@/dados/*`, `@/lib/*`, `@/contextos/*`, `@/store/*`) — there is **no** bare `@/*` alias, and no `src/` anywhere. `include` covers `.next/types` and `.next/dev/types`.

### 2.4 Tailwind / PostCSS / shadcn

`postcss.config.mjs` uses only `@tailwindcss/postcss` (Tailwind v4 pipeline). `tailwind.config.ts` declares a `content` array for `app/`, `components/`, `contextos/`, `lib/`, `hooks/` — **this file is dead weight under Tailwind v4**, which discovers content automatically and is configured from CSS; `app/globals.css:1-5` does the real work (`@import "tailwindcss"`, `@import "tw-animate-css"`, `@custom-variant dark`).

`components.json` has **two stale fields**: `"tailwind.css": "src/app/globals.css"` — a `src/` path that does not exist; the real file is `app/globals.css` — and `"tailwind.config": ""`. Style is `radix-nova`, `rsc: true`, base colour `neutral`, CSS variables on.

### 2.5 ESLint / Prettier

`eslint.config.mjs` composes `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` and re-declares the default ignores. **No Prettier config, no `.editorconfig`, no formatting script** — formatting is unenforced, which shows in the code (mixed 2-space blocks with aligned-column object literals, e.g. `app/actions/os.ts:833-840`).

### 2.6 Environment variables (names only)

From `.env.example` and source: `AMBIENTE`, `AMBIENTE_MISTO_CIENTE`, `DATABASE_URL`, `CENTRAL_DATABASE_URL`, `TENANT_PRINCIPAL_DATABASE_URL`, `TENANT_CUNHADO_DATABASE_URL`, `CRON_SECRET`, plus the Prisma-migrate tuning vars `PRISMA_MIGRATE_RETRY_MAX`, `PRISMA_MIGRATE_RETRY_DELAY_MS`, `PRISMA_MIGRATE_RETRY_MAX_DELAY_MS` and the standard `NODE_ENV`.

Per-tenant connection strings are resolved *by name*: the central `Tenant.connectionRef` stores only the variable name, never a URL, and `lib/tenant/resolver-conexao-tenant.ts:1-30` enforces the shape `^TENANT_[A-Z0-9_]+_DATABASE_URL$` and rejects any ref containing `CENTRAL` or starting with `NEXT_PUBLIC_`. **This part of the design is sound.** Its cost is that onboarding a tenant requires a Vercel env-var deploy, not a database insert.

No `NEXT_PUBLIC_*` variable is defined or read anywhere. `.gitignore` excludes `.env*` except `.env.example`, and also `/lib/generated/prisma` (a path that no longer exists) and `Claude outputs/`.

### 2.7 The unconventional setup `AGENTS.md` warns about

`AGENTS.md` says only: *"This is NOT the Next.js you know… Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* `CLAUDE.md` is a one-line `@AGENTS.md` include. The concrete deviations found in this repo:

1. **`proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the middleware entrypoint; the root file exports `export function proxy(request: NextRequest)` and a `config.matcher`, and the build output labels it `ƒ Proxy (Middleware)`.
2. **No `src/` directory.** `app/`, `components/`, `lib/`, `hooks/`, `contextos/`, `store/`, `types/`, `dados/` all sit at the repo root.
3. **Server Actions live under `app/actions/`**, not colocated with routes — 23 files, 16 000+ lines.
4. **Portuguese-first naming convention** for directories, files, functions and types (`contextos`, `dados`, `formatadores`, `exigirContextoTenant`).
5. **Two Prisma schemas with two config files** (`prisma.config.ts`, `prisma.central.config.ts`), the central client emitted to a custom `output` path.
6. **Turbopack is the default builder** in Next 16 — visible in the build banner.

---

## 3. Directory Structure

```
konext-erp/
├── app/                                  Next.js App Router root
│   ├── layout.tsx                        Root layout: Geist fonts, ProvedoresLayout
│   ├── globals.css                       Tailwind v4 entry + design tokens (HSL vars)
│   ├── (auth)/                           Route group: unauthenticated shell
│   │   ├── layout.tsx                    Centered dark box
│   │   └── login/page.tsx                CLIENT — useActionState(login)
│   ├── (dashboard)/                      Route group: authenticated app shell
│   │   ├── layout.tsx                    Cabecalho + ConteudoPrincipal + Rodape
│   │   ├── page.tsx                      Executive dashboard (force-dynamic)
│   │   ├── inicio/                       Post-migration landing page (near-stub)
│   │   ├── configuracoes/                Settings hub + 14 panels
│   │   ├── crm/                          Hub, contatos, oportunidades, propostas/*
│   │   ├── estoque/                      Product list (CLIENT, paginated)
│   │   ├── financeiro/                   Hub, receber, pagar, notas-fiscais, inteligencia
│   │   ├── metas/                        Goals list + detail
│   │   ├── os/                           Kanban, [id], nova, garantias
│   │   ├── pdv/                          Point of sale (CLIENT, 1492 lines)
│   │   ├── perfil/                       User profile (CLIENT)
│   │   └── vendas/                       Hub + pedidos/novo + historico
│   ├── (printer)/                        Route group: print-only pages, no chrome
│   │   ├── layout.tsx                    Pass-through fragment
│   │   ├── os/[id]/imprimir|garantia     A4 / 80 mm thermal OS printouts, warranty term
│   │   ├── propostas/[id]/imprimir       Commercial proposal PDF view
│   │   └── recibo/[id]                   POS receipt
│   ├── rastreio/[id]/                    PUBLIC-INTENDED order tracking (broken, §4.19)
│   ├── actions/                          23 Server Action modules — ALL business logic
│   └── api/cron/verificar-vencimentos/   Bearer-protected due-date notification job
├── components/
│   ├── ui/                               shadcn primitives (25 files)
│   │   └── pagina/                       In-house page kit: CabecalhoPagina, BarraFiltros,
│   │                                     TabelaDados, FiguraKPI, ChipStatus, EstadoVazio,
│   │                                     Superficie, formatacao.ts  ← the intended standard
│   ├── layout/                           Cabecalho, MenuMobile, NavPrincipal, Rodape, SinoNotificacoes
│   ├── provedores/                       ProvedorTema (hand-rolled), ProvedoresLayout
│   ├── configuracoes/                    14 settings panels + shared types
│   ├── crm/  dashboard/  estoque/        Feature components
│   ├── financeiro/  metas/  pdv/  vendas/
│   ├── os/                               Kanban, cards, tabs, modals, garantias/, impressao/
│   └── pdf/                              @react-pdf/renderer proposal document
├── contextos/contexto-sidebar.tsx        Sidebar open/closed context
├── dados/mock-os.ts                      OS status label/colour maps (misleading name, 26 lines)
├── hooks/useCalculadoraPrecosOS.ts       Single hook; wraps lib/utils/precificacao
├── lib/
│   ├── auth/                             cookies.ts (names), sessao-central.ts (session CRUD)
│   ├── central/prisma-central.ts         Central PrismaClient singleton
│   ├── tenant/                           exigir-contexto-tenant, prisma-tenant,
│   │                                     cache-prisma-tenant, resolver-conexao-tenant
│   ├── prisma.ts                         LEGACY global client bound to DATABASE_URL (§5.5)
│   ├── validations/                      6 zod schema modules (crm, estoque, financeiro,
│   │                                     oportunidades, os, propostas)
│   ├── dashboard/regras-financeiras.ts   Shared revenue rules used by dashboard + intelligence
│   ├── impressao/  pdv/  navegacao/      Print data assembly, payment maths, nav tree
│   ├── configuracoes-*.ts                Settings defaults + legacy-runtime detection
│   ├── auditoria.ts / auditoria-constantes.ts   Audit-log writer with field redaction
│   ├── formatadores.ts                   Legacy formatters (superseded by ui/pagina/formatacao)
│   └── utils.ts / utils/precificacao.ts  cn(); phone-part markup rules
├── prisma/
│   ├── schema.prisma                     Tenant schema — 956 lines, 28 models, 31 enums
│   ├── migrations/                       7 migrations (baseline + 6 deltas) — see §5.4
│   ├── central/                          Central schema + 2 migrations
│   └── tenant-baseline/                  Full CREATE script for new tenants (not in migrate flow)
├── scripts/                              21 .mjs operations scripts (3 are `_tmp-*` leftovers)
├── store/useCartStore.ts                 Zustand PDV cart
├── types/                                fechamento-caixa, financeiro, os, tenant, indice (dead)
├── public/                               5 default create-next-app SVGs, all unused
├── proxy.ts                              Route protection (Next 16 middleware)
├── AGENTS.md / CLAUDE.md                 Agent instructions
├── ARQUITETURA.md / QUICKSTART.md /
│   INTEGRACAO_BACKEND.md / RELATORIO_FINAL.md    Legacy docs — see §13
└── README.md
```

---

## 4. Routes & Modules

34 routes total. "Static (○)" / "Dynamic (ƒ)" are taken verbatim from the successful `next build` output.

### 4.1 `/login` — `app/(auth)/login/page.tsx` (○ Static)

Client component. `useActionState(login, { erro: null })` against `app/actions/auth.ts:107`. Layout `app/(auth)/layout.tsx` centres it on `bg-slate-950`. **Working.**

### 4.2 `/` — `app/(dashboard)/page.tsx` (ƒ Dynamic, `force-dynamic`)

Server component. Two parallel calls: `obterDashboardExecutivoSeguro(periodo)` (`app/actions/dashboard.ts:2152`) and `obterConfiguracoes()`. Renders 12 dashboard components (`BarraContexto`, `FaixaAcoes`, `BandaKpis`, `GraficoResultado`, `MedidoresOrcamento`, `GraficoSaldo`, `TabelaDre`, `FilaOs`, `TabelaParados`, `BlocoGarantia`, `BlocoMetas`, `ListaMovimentacoes`). Period comes from `?periodo=hoje|7d|30d|mes`. Errors are rendered inline as a card rather than thrown. **Working**, but `obterDashboardExecutivo` is a 1 138-line function (`dashboard.ts:1014-2151`) mixing raw SQL and Prisma queries; `GraficoResultado`/`GraficoSaldo` both trip `react-hooks/set-state-in-effect`.

### 4.3 `/inicio` — (ƒ Dynamic)

Server component; only calls `exigirContextoTenant()` and prints `empresaSlug`/`tenantSlug` with a link to `/`. **Stub** — a migration-era landing page not referenced from `ITENS_NAVEGACAO`.

### 4.4 `/os` — `app/(dashboard)/os/page.tsx` (ƒ)

Server component → `obterDadosDashboardOS()` (`app/actions/os.ts:419-542`) → `<DashboardOS>` (client, 645 lines) → `TabuleiroKanban` / list modes. `?modo=kanban|lista|excluidas` and `?clienteId=` drive the initial view. **Working**, with two structural problems: the action fetches *all* active and *all* archived orders with `include: { itens: true, cliente, osOrigemGarantia, retornoGarantia }` and **no `take`** (`os.ts:456-480`), and the whole payload is serialised to the client. See §10.

### 4.5 `/os/[id]` — (ƒ)

Server component; `exigirContextoTenant()` then a direct Prisma read (`app/(dashboard)/os/[id]/page.tsx:121`). Guards on `osBanco.excluidaEm` (line 217) and renders detail + `SecaoItensOS` + print menu + warranty actions. **Working.**

### 4.6 `/os/nova` — (ƒ)

Server component that resolves the tenant then renders `OrdemServicoForm`. **Working.**

### 4.7 `/os/garantias` — (○ **Static**)

`app/(dashboard)/os/garantias/page.tsx` is a 9-line shell returning `<PaginaGarantiasOS />`. That component is `"use client"` and loads everything in a `useEffect` via `obterDashboardGarantiasOS()` + `listarGarantiasOS(filtros)` (`components/os/garantias/pagina-garantias-os.tsx:36-70`). Consequence: **the page is prerendered at build time as an empty shell**, and every visit pays a client round-trip before showing data. Features: KPI dashboard, filters (busca/status/retorno), paginated table, register-return modal, print warranty term. **Working but architecturally inverted.**

### 4.8 `/pdv` — (○ **Static**, 1 492-line client component)

The largest page in the repo. Client component using `useCartStore` (Zustand) and calling `listarProdutosPDV`, `listarClientesPDV`, `obterConfiguracaoPagamentosPDV`, `obterResumoCaixaDiario`, `verificarStatusCaixa`, `abrirNovaCaixaSession`, `fecharCaixaSessionAtual`, `processarVenda`, `obterPedidoOSParaPDV`, `processarVendaComOSNoPDV`. Includes `ModalPagamento` (1 420 lines, multi-payment splitting with card fees and instalments) and `ImpressaoAutomaticaRecibo`. **Working**, but see finding #3 (price trust), the three `set-state-in-effect` errors in `modal-pagamento.tsx:331,349,359`, and `react-hooks/exhaustive-deps` at `pdv/page.tsx:260`.

### 4.9 `/vendas` — (○ Static)

`app/(dashboard)/vendas/page.tsx` is a static hub of 8 cards. **5 of the 8 link to `href: "#"`** — Notas Fiscais de Saída, Gestão de Frete, Logística Reversa, Contratos, Notas de Serviço (`vendas/page.tsx:44,64,72,84,98`). **Partial/stub.**

### 4.10 `/vendas/pedidos/novo` — (ƒ)

Server component resolving the tenant and pre-loading data for `NewSalesOrderWizard` (client, 1 266 lines). Actions: `createPedidoVenda` (`app/actions/vendas.ts:92`). **Working.** The wizard carries 5 unused-variable warnings (`new-sales-order-wizard.tsx:11,18,24,65,473`) indicating abandoned features (instalment watch, checkbox).

### 4.11 `/vendas/historico` — (ƒ)

Server component (630 lines) that queries Prisma **inline in the page** (`vendas/historico/page.tsx:346`) rather than through an action. Filters by status via `?status=`. Row actions go through `aprovarPedido` / `rejeitarPedido` / `cancelarPedido`. **Working.**

### 4.12 Financial routes

`/financeiro` (ƒ), `/financeiro/receber` (ƒ), `/financeiro/pagar` (ƒ), `/financeiro/notas-fiscais` (ƒ), `/financeiro/inteligencia` (○).

- **Hub** — `obterResumoDashboardFinanceiro()` (`financeiro-hub.ts:293`), KPI cards + action strip. Uses `Suspense`.
- **Receber** — server page + `ConteudoReceber` (808 lines) + `FiltrosReceber`; actions `listarContasReceberFiltradas`, `obterResumoReceber`, `criarContaReceber`, `darBaixaConta`, `editarContaReceber`, `excluirContaReceber`.
- **Pagar** — symmetric: `ConteudoPagar` (648 lines), `FiltrosPagar`; actions `criarDespesa`, `listarParcelasPagarFiltradas`, `obterResumoPagar`, `pagarParcela`.
- **Notas Fiscais** — `listarNotasFiscais` + `listarClientesParaNotaFiscal`; CRUD is metadata-only (number, access key, total, status). **No fiscal integration of any kind** — no SEFAZ, no XML, no certificate. **Partial by design.**
- **Inteligência** — client page (647 lines) calling `obterInteligenciaTaxasPagamento` and `obterDadosAnaliticos`. **Working.**

The Receber/Pagar pair is near-symmetric duplication: `ConteudoReceber`/`ConteudoPagar`, `FiltrosReceber`/`FiltrosPagar`, `obterResumoReceber`/`obterResumoPagar`, `listarContasReceberFiltradas`/`listarParcelasPagarFiltradas` — ~1 900 lines that could share a generic ledger surface.

### 4.13 `/estoque` — (○ Static, client)

Client page (456 lines) using `listarProdutosPaginado` + `PaginationControls` + `ModalNovoProduto`. Actions: `criarProduto`, `atualizarProduto`, `excluirProduto`. **Working.** Note `listarProdutos()` (`estoque.ts:63-71`) returns **whole `Produto` rows including `custo`** with no `select`; it is a separate export from the paginated one.

### 4.14 CRM routes

`/crm` (○), `/crm/contatos` (○), `/crm/oportunidades` (ƒ), `/crm/propostas` (ƒ), `/crm/propostas/nova` (○), `/crm/propostas/[id]` (ƒ).

- **Hub** (392 lines, client) — static navigation, no data.
- **Contatos** (791 lines, client) — `listarClientesPaginado`, `buscarClientesCRM`, `criarCliente`, `atualizarCliente`, `excluirCliente`, `consultarCnpjReceitaCliente`. Paginated. **Working.**
- **Oportunidades** — server page → `listarOportunidades` + `listarClientesPaginado` → `FunilVendasKanban` (746 lines, `@hello-pangea/dnd`) → `atualizarEstagioOportunidade`. **Working.**
- **Propostas** — list and detail are server components querying Prisma **inline** (`propostas/page.tsx:64`, `propostas/[id]/page.tsx:82`), bypassing `app/actions/propostas.ts`. `nova` is a 876-line client wizard calling `createProposta`. **Working**, but proposals are **never linked to `Cliente`** — `PropostaComercial.cliente` is a free-text `String`, so CRM and proposals do not join.

### 4.15 `/metas` (○), `/metas/[id]` (ƒ)

`/metas` is a static shell wrapping the client `PaginaMetas` (`components/metas/pagina-metas.tsx:1-60`) — same inverted pattern as `/os/garantias`. 15 actions in `app/actions/metas.ts` cover CRUD, checklists, history, status changes, manual progress and **automatic goals** that re-derive their value from 12 metrics (`MetricaAutomaticaMeta`). `/metas/[id]` is a server page calling `obterMetaPorId`. **Working** — this is the most feature-complete module after OS.

### 4.16 `/configuracoes` — (ƒ)

Server page → `obterConfiguracoes()` → `FormConfiguracoes` (331 lines, client) → `LayoutConfiguracoes` + `MenuConfiguracoes` + 14 panels (`painel-empresa`, `painel-pdv`, `painel-os`, `painel-garantias`, `painel-financeiro`, `painel-estoque`, `painel-crm`, `painel-metas`, `painel-documentos`, `painel-aparencia`, `painel-usuarios`, `painel-auditoria`, `painel-placeholder`, `preview-identidade-empresa`). Save goes through `salvarConfiguracoes` (`configuracoes.ts:926`) with a full zod schema. **Working.** `painel-usuarios` exists but there is **no user-management action** — no create/invite/deactivate/role-change server action anywhere; `UsuarioCentral`/`UsuarioEmpresa` are managed only by the `scripts/criar-admin-cunhado.mjs` CLI. **Panel is a stub.**

### 4.17 `/perfil` — (○ Static, client)

Calls `obterDadosPerfilConfiguracao` and `atualizarPerfil` (`configuracoes.ts:1267`, `:1318`). **Partial + insecure**: no password-change flow exists anywhere in the app (`bcrypt` appears only in `app/actions/auth.ts` for comparison and in three `.mjs` scripts for hashing), and `atualizarPerfil` has the IDOR described in finding #2.

### 4.18 Printer group

`/os/[id]/imprimir` (ƒ), `/os/[id]/garantia` (ƒ), `/propostas/[id]/imprimir` (ƒ), `/recibo/[id]` (ƒ).

All server components. `obterDadosImpressaoOS(id)` + `resolverModeloImpressao(query.modelo, padrão)` choose between `OsImpressaoA4` and `OsImpressaoTermica` (80 mm). `?auto=1` / `?autoprint=1` triggers `window.print()` via a tiny client component. `/recibo/[id]` has a two-query fallback (with/without `pagamentos`) for pre-multi-payment databases (`recibo/[id]/page.tsx:73-120`). All are behind the proxy, so all require a session. **Working.**

### 4.19 `/rastreio/[id]` — (ƒ) — **BROKEN**

Intended as a public customer tracking link (`components/os/botao-copiar-link-rastreio.tsx` generates it). Two independent defects:

1. `proxy.ts:6` lists only `/login` as public, so the proxy matcher (`/((?!api|_next/static|_next/image|favicon.ico).*)`) intercepts `/rastreio/*` and redirects anonymous users to `/login`.
2. It imports the legacy global Prisma client (`app/rastreio/[id]/page.tsx:10`) bound to `DATABASE_URL`, so it can only ever read the "principal" tenant. The file carries an 8-line comment acknowledging this and explaining the blocker: the schema has no opaque public token on `OrdemServico`.

The page itself is well built — 493 lines, a status timeline, deliberate field-level privacy (first name only, no costs, `OsPublica` type at line 31), and link expiry after delivery.

### 4.20 `/api/cron/verificar-vencimentos` — (ƒ)

The only route handler. Iterates **all active tenants** from the central DB, resolves each connection and creates `Notificacao` rows for `Conta` records due today/tomorrow. Protected by `Authorization: Bearer ${CRON_SECRET}`. **Working**, but it reads the `Conta` model (`prisma/schema.prisma`, `model Conta`) — a loosely-typed table with `status`/`tipo` as bare `String` — which **no UI writes to**. Receivables live in `ContaReceber` and payables in `ParcelaDespesa`. The cron therefore notifies on an empty table. See F-18.

---

## 5. Data Layer (Prisma)

### 5.1 Central schema — `prisma/central/schema.prisma` (101 lines)

Generated to `node_modules/@prisma/client-central`, `engineType = "library"`, provider `postgresql`, **no `url` in the datasource block** (supplied by `prisma.central.config.ts`).

| Model | Fields | Indexes / constraints |
|---|---|---|
| `Empresa` | `id` uuid, `nome`, `slug` **@unique**, `status: StatusEmpresa = ATIVA`, `criadoEm`, `atualizadoEm` | — |
| `Tenant` | `id`, `empresaId → Empresa (Cascade)`, `slug` **@unique**, `status: StatusTenant = PROVISIONANDO`, `versaoSchema`, `connectionRef String?` | `@@index([empresaId])`, `@@index([status])` |
| `UsuarioCentral` | `id`, `nome`, `email` **@unique**, `senha` (bcrypt), `ativo = true` | — |
| `SessaoCentral` | `id`, `tokenHash` **@unique**, `usuarioCentralId`, `empresaId`, `tenantId`, `role: RoleEmpresa`, `expiraEm`, `revogadaEm?`, `ultimoUsoEm?` | `@@index` on usuarioCentralId, empresaId, tenantId, expiraEm, revogadaEm |
| `UsuarioEmpresa` | `id`, `usuarioId → UsuarioCentral (Cascade)`, `empresaId → Empresa (Cascade)`, `role = USUARIO`, `ativo = true` | `@@unique([usuarioId, empresaId])`, `@@index([empresaId])`, `@@index([role])` |

Enums: `StatusEmpresa {ATIVA, SUSPENSA, INATIVA}`, `StatusTenant {PROVISIONANDO, ATIVO, SUSPENSO, ERRO}`, `RoleEmpresa {ADMIN, GESTOR, USUARIO}`.

**`SessaoCentral` has no foreign keys.** `usuarioCentralId`, `empresaId` and `tenantId` are plain `String` columns with indexes but no `@relation`, so deleting a company or user leaves orphan sessions that `obterSessaoCentral` must defensively re-validate on every request (`lib/auth/sessao-central.ts:91-125`) — four extra queries per request.

### 5.2 Tenant schema — `prisma/schema.prisma` (956 lines)

**28 models, 31 enums.** Datasource has no `url` (from `prisma.config.ts`).

**Identity & audit**

- `Usuario` — `id`, `nome`, `email` @unique, `senha`, `fotoPerfilUrl?`, `role: RoleUsuario = ADMIN`. Back-relations to audit logs, deleted OS, warranty terms/returns, goals. **`senha` is dead**: authentication happens exclusively against `UsuarioCentral`; nothing in `app/` ever reads or writes `Usuario.senha`.
- `LogAuditoria` — `usuarioId?`, `empresaId?`, `acao`, `entidade`, `entidadeId?`, `dadosAntes Json?`, `dadosDepois Json?`, `motivo?`, `origem?`. Six indexes.

**Settings**

- `Configuracao` — **69 columns** in one table: company identity (razaoSocial, cnpj, IE, full address, logoUrl, chavePix), print settings (`modeloImpressaoOSPadrao: ModeloImpressaoOS`, `imprimirLogoTermica`, `mensagemRodapeImpressaoOS`), PDV rules (`permitirVendaSemEstoque`, `permitirPagamentoMisto`, `permitirDescontoPDV`, `descontoMaximoPDVPercentual Decimal(5,2)`, `permitirVendaFiado`, six `habilitar*` payment toggles), **13 separate `taxaCartaoCredito{1..12}xPercentual` columns** plus `taxaCartaoDebitoPercentual`, deadlines (`prazoPadraoBoletoDias`, `prazoPadraoCrediarioDias`, `maxParcelasCartaoCredito`), warranty rules (`prazoGarantiaPadraoDias`, `prazoMinimo/MaximoGarantiaDias`, `exigirGarantiaAntesEntrega`, `exigirItemParaGarantia`, `exigirItemParaEnviarPDV`, `exigirDiagnosticoParaFinalizar`, `permitirFinalizarSemPagamento`, `permitirGarantiaPersonalizada`) and three warranty text blocks. **No unique constraint and no singleton guard** — every read uses `findFirst({ orderBy: { criadoEm: "asc" } })` (e.g. `os.ts:243`, `configuracoes.ts:1273`), so a second row would silently shadow the first.

**CRM**

- `Cliente` — `tipoPessoa: TipoPessoa`, `papel: TipoPapel` (CLIENTE/FORNECEDOR in the same table), `nomeRazaoSocial`, `nomeFantasia?`, `documento` **@unique** (CPF or CNPJ), `inscricaoEstadual?`, `email?`, `telefone`, `isWhatsapp`, address block, `categoria: CategoriaCliente`, `observacoes?`. Relations to ordensServico, contasReceber, despesas, vendas, pedidosVenda, notasFiscais, contas, oportunidades. **Zero `@@index`** despite being joined from eight models and filtered by `papel`/`categoria` in `crm.ts:454-470`.
- `Oportunidade` — `titulo`, `valor Decimal`, `estagio: EstagioFunil`, `dataFechamento?`, `clienteId`. Indexed on clienteId + estagio.
- `PropostaComercial` / `PropostaItem` — **`cliente` is a `String`, not a relation.** Money fields are `Float`. Indexed on status + dataEmissao.

**Service orders**

- `OrdemServico` — `numeroOs Int @unique @default(autoincrement())`, `clienteId → Cliente`, **`equipamento`, `marca?`, `modelo?`, `imei?`, `senha?`, `senhaDesenho?`** (Android pattern-lock as `"1-2-5-8-9"`), `relatoCliente`, `condicaoFisica?`, `acessorios?`, `status: StatusOS`, `ehRetornoGarantia`, self-relation `osOrigemGarantiaId`, one-to-one `retornoGarantiaId @unique`, `observacoes?`, **`archivedAt?`**, **`excluidaEm?`** + `excluidaPorId?` + `motivoExclusao?` + `statusAnterior?`, `prazoGarantiaDias?`. Indexes: `excluidaEm`, `excluidaPorId`, `ehRetornoGarantia`, `osOrigemGarantiaId`. **Missing `@@index([status])` and `@@index([clienteId])`** — both filtered constantly (`dashboard.ts:1158-1176`, `os.ts:456`).
- `ItemOS` — `osId` (Cascade), `descricao`, `tipoPeca: TipoPeca`, `custoPeca Float`, `valorCobrado Float`. **No index on `osId`** despite `include: { itens: true }` on every list.
- `TermoGarantiaOS` — `osId @unique` (Cascade), `prazoGarantiaDias = 90`, `dataInicioGarantia`, `dataFimGarantia`, `textoGarantia`, `criadoPorId?`, **`canceladaEm?`** + `motivoCancelamento?`. Five indexes.
- `RetornoGarantiaOS` — `termoGarantiaId` (Cascade), `osOrigemId?` (SetNull), `osRetornoId? @unique`, `motivo`, `descricao`, `analiseTecnica?`, `resultado: ResultadoRetornoGarantia = EM_ANALISE`, `descricaoServico?`, `pecasAdicionais?`, `houveTroca`, `houveCobranca`, `valorAdicional Decimal?`, `observacoesTecnicas?`, **`finalizadoEm?`** + `finalizadoPorId?`, `criadoPorId?`. Five indexes. **`finalizadoPorId` has no `@relation`** — an unconstrained free-text column.

**Financial**

- `ContaReceber` — `descricao`, `valor Float`, two observation fields, `parcelamentoId?` + `numeroParcela` + `totalParcelas`, `dataInicio?`/`dataFinalizacao?`, optional links to `cliente`, `pedido`, `ordemServico`, `venda`, `vendaPagamento @unique`, `dataVencimento`, `dataRecebimento?`, `status: StatusPagamento`, `formaPagamento?`, **`formaRecebimento` (required)**, `origem: OrigemReceita`, `notaFiscalEmitida`. Indexes: `parcelamentoId`, `pedidoId`, `vendaId`. **No index on `status`, `dataVencimento`, `clienteId` or `ordemServicoId`** — all four are primary filters (`financeiro-receber.ts:386-450`, `os.ts:320-329`).
- `Despesa` / `ParcelaDespesa` — `valorTotal Float`, `tipo: TipoDespesa`, `qtdParcelas`; parcels carry `valor Float`, `dataVencimento`, `dataPagamento?`, `status`, `valorPago Float?`. **Neither model has any index**, including none on `ParcelaDespesa.despesaId` or `dataVencimento`.
- `NotaFiscal` — `numero`, `chaveAcesso?`, `valorTotal Float`, `status`. No indexes.
- `Conta` — `id cuid`, `descricao`, `valor Float`, `vencimento`, **`status String`**, **`tipo String`** (comment says "RECEBER ou PAGAR"). The stringly-typed precursor of the models above. Only the cron reads it.

**Stock & sales**

- `Produto` — `codigoBarras? @unique`, `imagemUrl?`, `nome`, `descricao?`, `categoria: CategoriaProduto`, `custo Float`, `precoVenda Float`, `quantidadeEstoque Int`, `estoqueMinimo Int = 3`, `ativo`. **No index on `ativo`, `categoria` or `nome`** despite being the stock list's sort/filter keys. **No stock-movement ledger exists** — quantity is mutated in place, so there is no audit trail of *why* stock changed.
- `PedidoVenda` / `PedidoVendaItem` / `PedidoVendaParcela` — well indexed (clienteId, status, origem, dataCriacao / pedidoId, produtoId / pedidoId, dataVencimento). `vendedor` is a free-text `String`, not a `Usuario` FK.
- `Venda` / `ItemVenda` / `VendaPagamento` — `VendaPagamento` holds the multi-payment split (`valorBruto`, `percentualTaxa`, `valorTaxa`, `valorLiquido`, `parcelas`, `diasVencimento`, `dataVencimento`) and is well indexed. `Venda` itself has **no index** on `clienteId`, `caixaSessionId` or `criadoEm` — and `criadoEm` is the key of every daily-revenue query.
- `CaixaSession` — `status: CaixaStatus`, `valorAbertura Float`, `valorFechamento Float?`, `dataAbertura`, `dataFechamento?`. **No index on `status`**, which is exactly how the open session is found.

**Other**

- `Notificacao` — `titulo`, `mensagem`, `lida`, `criadoEm`. **No index on `lida`**; **not scoped to a user** — every notification is global to the tenant.
- `Meta` / `ItemChecklistMeta` / `HistoricoMeta` — the best-modelled area: 10 indexes on `Meta`, soft-delete via `excluidaEm` + `excluidaPorId`, plus `concluidaEm`/`canceladaEm` timestamps, automatic-progress config (`origemProgresso`, `fonteAutomatica`, `metricaAutomatica`, `configuracaoAutomatica Json`, `ultimaSincronizacaoEm`, `erroSincronizacao`).

**Enums (31):** `RoleUsuario`, `ModeloImpressaoOS`, `TipoPessoa`, `TipoPapel`, `CategoriaCliente`, `EstagioFunil`, `StatusPropostaComercial`, `StatusOS`, `TipoPeca`, `ResultadoRetornoGarantia`, `StatusPagamento`, `FormaPagamento`, `OrigemReceita`, `TipoDespesa`, `StatusParcelaDespesa`, `StatusNotaFiscal`, `CategoriaProduto`, `TipoCliente` (**dead — duplicates `CategoriaCliente` and is referenced by no model**), `StatusPedido`, `OrigemPedido`, `CaixaStatus`, `CategoriaMeta`, `TipoValorMeta`, `OrigemProgressoMeta`, `DirecaoMeta`, `FonteAutomaticaMeta`, `MetricaAutomaticaMeta`, `PrioridadeMeta`, `StatusMeta`, `TipoHistoricoMeta`.

### 5.3 Soft delete, archiving and lifecycle fields

| Field | Model | Meaning | Enforcement |
|---|---|---|---|
| `archivedAt` | `OrdemServico` | Delivered order moved out of the Kanban into the "Finalizadas" list | Set by `archiveDeliveredOrderService` / `gerarGarantiaEFinalizarOS`; cleared on any status change away from `ENTREGUE` (`os.ts:791`) |
| `excluidaEm` + `excluidaPorId` + `motivoExclusao` + `statusAnterior` | `OrdemServico` | Soft delete with mandatory reason | `excluirOrdemServico` (`os.ts:1337-1478`); also sets `archivedAt` |
| `excluidaEm` + `excluidaPorId` | `Meta` | Soft delete | `excluirMeta` (`metas.ts:1962`) |
| `concluidaEm`, `canceladaEm` | `Meta` | Terminal timestamps | `alterarStatusMeta` |
| `canceladaEm` + `motivoCancelamento` | `TermoGarantiaOS` | Warranty term cancellation | **Never written by any action** — grep finds no writer. Dead column. |
| `finalizadoEm` + `finalizadoPorId` | `RetornoGarantiaOS` | Warranty return closed | `finalizarRetornoGarantiaOS` (`garantias.ts:1519-1534`); doubles as the idempotency guard (`garantias.ts:1511`) |
| `dataFinalizacao`, `dataRecebimento` | `ContaReceber` | Settlement | `darBaixaConta` |
| `ativo` | `Produto`, `UsuarioCentral`, `UsuarioEmpresa` | Boolean soft-disable | `excluirProduto` sets `ativo: false` |

**No Prisma middleware/extension applies a global soft-delete filter.** Every query must remember `excluidaEm: null` by hand. Compliance is high in `dashboard.ts` and `metas.ts` but not universal — see F-14.

### 5.4 Migration history and drift

**Tenant — `prisma/migrations/` (7 entries):**

| Migration | Lines | Contents |
|---|---|---|
| `20260621_baseline_producao` | 3 | Comment only. Creates nothing. |
| `20260621_garantias_auditoria_dashboard` | 307 | Creates `TermoGarantiaOS`, `RetornoGarantiaOS`, `LogAuditoria`, `Meta`, `ItemChecklistMeta`, `HistoricoMeta` + 10 enums |
| `20260621235500_corrigir_schema_ordem_servico_garantias` | 64 | `ALTER TABLE "OrdemServico" ADD COLUMN IF NOT EXISTS` ×9, three `DO $$ … IF NOT EXISTS pg_constraint` FK blocks, five `CREATE INDEX IF NOT EXISTS` |
| `20260624_multi_pagamento_pdv` | 62 | `ALTER TABLE "ContaReceber"`, `"VendaPagamento"` |
| `20260624093000_adicionar_configuracoes_os_garantias` | 12 | `ALTER TABLE "Configuracao"` |
| `20260626120000_adicionar_configuracoes_pdv_pagamentos` | 112 | `ALTER TABLE "Configuracao"` |
| `20260903120000_adicionar_modelos_impressao_os` | 9 | `CREATE TYPE "ModeloImpressaoOS"`, `ALTER TABLE "Configuracao"` |

**Static drift analysis.** Applying all seven migrations to an empty database yields six tables (the garantias/metas/audit group) and none of the core business tables. The following models in `prisma/schema.prisma` have **no `CREATE TABLE` anywhere in `prisma/migrations/`**: `Usuario`, `Configuracao`, `Cliente`, `Oportunidade`, `PropostaComercial`, `PropostaItem`, `OrdemServico`, `ItemOS`, `ContaReceber`, `Despesa`, `ParcelaDespesa`, `NotaFiscal`, `Produto`, `Conta`, `PedidoVenda`, `PedidoVendaItem`, `PedidoVendaParcela`, `Venda`, `VendaPagamento`, `ItemVenda`, `CaixaSession`, `Notificacao` — 22 of 28 models.

The full DDL exists only in `prisma/tenant-baseline/operacional-baseline-20260706.sql` (all 28 `CREATE TABLE` + all 31 `CREATE TYPE`), generated with `prisma migrate diff --from-empty`. Its README states it "is only for new tenants… does not replace or rewrite `prisma/migrations`, and it is not used by `npm run build`." So the deploy pipeline (`npm run build` → `migrate deploy`) and the tenant-provisioning path (`scripts/provisionar-tenant-cunhado.mjs` + the baseline SQL) apply **two different definitions of the schema**, with no mechanism keeping them in sync.

The `ADD COLUMN IF NOT EXISTS` / `DO $$ … IF NOT EXISTS` style in `20260621235500` is a direct symptom: it is written to be re-runnable against databases in unknown states.

**Central — `prisma/central/migrations/` (2 entries):** `20260706010226_init_central`, `20260706060000_sessao_central`. These do create the full central schema.

Both `migration_lock.toml` files declare `provider = "postgresql"`.

### 5.5 Prisma client instantiation

Three distinct clients:

1. **`lib/prisma.ts`** — legacy global singleton bound to `process.env.DATABASE_URL`. Throws at module scope if unset (`:13-17`). Cached on `globalThis` only when `NODE_ENV !== "production"` (`:48-50`), with an ad-hoc invalidation heuristic that checks whether the cached client has `meta`/`historicoMeta`/`itemChecklistMeta` delegates and compares a hard-coded `PRISMA_SCHEMA_VERSION = "20260624-configuracao-os-garantias"` string (`:11`, `:34-41`). **One consumer remains: `app/rastreio/[id]/page.tsx:10`.**
2. **`lib/central/prisma-central.ts`** — same shape for `CENTRAL_DATABASE_URL`, same module-scope throw (`:15-17`), same version-string heuristic.
3. **`lib/tenant/cache-prisma-tenant.ts`** — the real multi-tenant path. A `Map<tenantId, {connectionFingerprint, prisma}>` on `globalThis`, keyed by tenant, with a SHA-256 fingerprint of the connection string; if a tenant's resolved connection changes mid-process it **throws rather than reconnecting** (`:47-53`). This is a good safety property.

**Serverless concerns.** Every client uses `PrismaNeon` over the Neon WebSocket driver with `ws` injected when `WebSocket` is undefined. The tenant cache is unbounded — in a long-lived Node server with many tenants it accumulates a client (and its pool) per tenant forever, with no eviction or `$disconnect`. On Vercel's per-instance lambdas that is bounded by instance lifetime, but it is a leak on any container deployment. `serverExternalPackages` (§2.2) keeps all of this out of Edge bundles; the proxy correctly touches none of it.

### 5.6 Query-level problems

**Missing soft-delete filters.** `app/actions/auditoria.ts:159` — `prisma.ordemServico.count({})` with no `where` (this one is intentional: line 160 counts deleted separately). More concerning, `app/(dashboard)/os/[id]/page.tsx:121-217` fetches by id and only *then* checks `excluidaEm` in render, and `garantias.ts:932` (`listarGarantiasOS`) filters warranty terms without demonstrably joining through to `os.excluidaEm` — warranties of deleted orders may remain listed. `UNVERIFIED` for the exact behaviour of `listarGarantiasOS` under a deleted OS; the `where` clause at `garantias.ts:932+` should be reviewed directly.

**N+1 and over-fetching.**

- `obterDadosDashboardOS` (`os.ts:456-480`) — two unbounded `findMany` with `include: { itens: true, cliente, osOrigemGarantia, retornoGarantia }`. Every service order the shop has ever created, with every line item, on every `/os` page load.
- `processarVenda` (`pdv.ts:866-895`) — a serial `await itemVendaDelegate.create()` **per cart line** inside the transaction, then a second serial loop of `produto.updateMany` per line (`:896-920`). Two round-trips per item; `createMany` plus a single batched decrement would be one each.
- `obterSessaoCentral` (`lib/auth/sessao-central.ts:74-113`) — 1 session lookup + 4 parallel lookups + 1 `update` for `ultimoUsoEm` = **6 central-DB round-trips on every request**. The `ultimoUsoEm` write in particular makes every page view a write transaction.
- `app/actions/dashboard.ts` mixes `$queryRaw` (lines 468-830) with Prisma counts (lines 1130-1510); `obterDashboardExecutivo` issues 40+ queries per dashboard render.

**Missing indexes for frequent filters** (from §5.2): `OrdemServico.status`, `OrdemServico.clienteId`, `ItemOS.osId`, `Cliente.papel`, `Cliente.categoria`, `ContaReceber.status`, `ContaReceber.dataVencimento`, `ContaReceber.ordemServicoId`, `ContaReceber.clienteId`, `ParcelaDespesa.despesaId`, `ParcelaDespesa.dataVencimento`, `ParcelaDespesa.status`, `Produto.ativo`, `Venda.criadoEm`, `Venda.caixaSessionId`, `CaixaSession.status`, `Notificacao.lida`.

**Transactions.** Coverage is good for the write paths: `criarOrdemServico`, `atualizarStatusOrdemServico`, `excluirOrdemServico`, `gerarGarantiaEFinalizarOS`, `registrarRetornoGarantiaOS`, `finalizarRetornoGarantiaOS`, `processarVenda`, `processarVendaComOSNoPDV`, `aprovarPedido`, `criarDespesa`, `pagarParcela` and the metas mutations all use `prisma.$transaction`. Two gaps:

- `processarVenda` schedules a `setImmediate` callback **inside** the transaction body (`pdv.ts:921-945`) that runs low-stock checks against the **non-transactional** client after the fact. In a serverless function the response may return and the instance freeze before it runs; if the transaction then rolls back, the notification may already have been written. Fire-and-forget work has no place in a serverless request.
- `atualizarStatusOrdemServico` writes the `Notificacao` **outside** the transaction (`os.ts:829-853`) inside a swallow-everything `try/catch` — deliberate and reasonable, but it means the notification can exist for a status change that later fails.

---

## 6. Server Actions & Business Logic

23 modules, ~16 000 lines, 108 exported actions. All 23 start with `"use server"`. **Every action in 22 of 23 modules calls `exigirContextoTenant()` first**; `app/actions/auth.ts` is the exception by design (login/logout).

### 6.1 Cross-cutting patterns

| Aspect | Reality |
|---|---|
| **Auth check** | `exigirContextoTenant()` → `exigirSessaoCentral()` → throws `"Sessão expirada ou inválida"`. Present in **every** action except `login`/`logout`. **No action is unprotected.** |
| **Authorization** | **None.** Zero role comparisons anywhere (finding #1). |
| **Input validation** | zod is used in only **7 of 23** modules, and heavily in only 2. Counts of zod tokens per file: `configuracoes.ts` 60, `vendas.ts` 27, `propostas.ts` 2, `estoque.ts` 2, `crm.ts` 2, `oportunidades.ts` 1, `notificacoes.ts` 1, **all others 0** — including `pdv.ts`, `os.ts`, `os-itens.ts`, `garantias.ts`, `metas.ts`, `financeiro-receber.ts`, `financeiro-pagar.ts`, `caixa.ts`, `caixa-pdv.ts`, `notas-fiscais.ts`. Those modules hand-roll checks: `String(x ?? "").trim()`, `Number.isFinite`, length caps (e.g. `garantias.ts:1461-1463` caps four fields at 1000 chars), and membership tests against literal arrays (`os.ts:707`, `garantias.ts:1466-1476`). |
| **Return shape** | Three competing conventions: (a) `{ sucesso: true, … } \| { sucesso: false, erro }` — os, garantias, metas, configuracoes; (b) `{ success: boolean, message: string }` — vendas (`ApprovePedidoVendaResult`); (c) bare value or `throw` — pdv (`processarVenda` throws), estoque, financeiro-hub, dashboard, caixa. |
| **Error handling** | Mostly `try/catch` returning a generic string. Several modules use **string-matching on error messages** as control flow: `garantias.ts:1601-1618` re-dispatches on `"RETORNO_NAO_ENCONTRADO"` / `"RETORNO_JA_FINALIZADO"` / `"OS_RETORNO_NAO_ENCONTRADA"`; `os.ts:1464` matches `"OS ja excluida"`; `vendas.ts:297` matches `error.message.includes("Sessão")`; `os.ts:326-329` (`archivedAtUnsupported`) matches `"archivedAt"`/`"Unknown argument"` to decide whether to fall back to raw SQL. |
| **`revalidatePath`** | Used liberally and imprecisely. `atualizarStatusOrdemServico` revalidates 5 paths including `/dashboard` — **a route that does not exist** (`os.ts:858`); the dashboard is `/`. `processarVenda` revalidates 6 paths (`pdv.ts:1010-1015`); `excluirOrdemServico` revalidates 8 (`os.ts:1449-1457`). `revalidateTag` is used **nowhere**, and no `fetch`/`unstable_cache` tagging exists. |

### 6.2 Module-by-module

**`auth.ts`** — `login(prevState, formData)` (`:107`), `logout()` (`:128`).
`autenticarCentral` (`:25-105`): looks up `UsuarioCentral` by email, `bcrypt.compare`, retries once with `senha.trim()` (`:41-45`), loads active `UsuarioEmpresa` links, **requires exactly one active company** (`:70`) and **exactly one active tenant with a `connectionRef`** (`:87`) — otherwise returns a generic failure. A legitimate multi-company user is therefore indistinguishable from a wrong password. Deletes the legacy `konext_session` cookie (`:97-99`). No rate limiting, no lockout, no login audit entry. Validation is `String(formData.get(...))` only.

**`os.ts`** (1 702 lines, 12 actions) — covered in §6.3.

**`os-itens.ts`** (566 lines, 3 actions) — `adicionarItemOS`, `atualizarItemOS`, `removerItemOS`. Transactional, audited, validates `tipoPeca` against a literal array (`:11-16`). No zod.

**`garantias.ts`** (1 743 lines, 9 actions) — covered in §6.4.

**`pdv.ts`** (1 467 lines, 7 actions) — covered in §6.5.

**`vendas.ts`** (491 lines, 4 actions) — `createPedidoVenda` (zod-validated), `aprovarPedido`, `rejeitarPedido`, `cancelarPedido`. **The best-written module.** `aprovarPedido` (`:174-315`) is fully transactional, guards `status !== "PENDENTE"`, decrements stock with a conditional `updateMany({ where: { id, quantidadeEstoque: { gte } } })` and throws when `count === 0`, then branches on deferred vs immediate payment to create the right `ContaReceber` rows. One defect: it always writes `origem: "AVULSO"` (`:249`, `:274`) instead of a sales-order origin, so financial reports cannot attribute revenue to sales orders.

**`estoque.ts`** (252 lines, 5 actions) — zod via `formProdutoSchema`. `excluirProduto` sets `ativo: false`. `listarProdutos` returns full rows including `custo` (§4.13).

**`crm.ts`** (637 lines, 7 actions) — zod via `formClienteSchema`, `ZodError` handled. `consultarCnpjReceitaCliente` calls an **external CNPJ lookup API** from the server. `excluirCliente` — hard delete; behaviour with dependent rows is `UNVERIFIED`.

**`oportunidades.ts`** (461 lines, 3 actions), **`propostas.ts`** (209 lines, 3 actions) — zod-validated.

**`financeiro-receber.ts`** (480 lines, 7 actions) — `listarContasReceber`, `criarContaReceber`, `darBaixaConta`, `editarContaReceber`, `excluirContaReceber` (**hard delete**, with `// TODO: em migracao futura, priorizar cancelamento/soft-delete para trilha financeira mais robusta` at `:338` — the only TODO in the codebase), `listarContasReceberFiltradas`, `obterResumoReceber`. Audited. No zod.

**`financeiro-pagar.ts`** (491 lines, 5 actions) — `criarDespesa` (transactional, creates parcels), `pagarParcela`, three read actions. Audited. No zod.

**`financeiro.ts`** (100 lines, 2 actions) — **entirely dead.** Exports `listarContasReceber` and `darBaixaConta`, both superseded by `financeiro-receber.ts`. A repo-wide grep for `from "@/app/actions/financeiro"` returns zero hits.

**`financeiro-hub.ts`** (315 lines, 6 actions), **`financeiro-inteligencia.ts`** (758 lines, 2 actions), **`dashboard.ts`** (2 191 lines, 2 actions), **`caixa.ts`** (505 lines, 3 actions), **`caixa-pdv.ts`** (318 lines, 4 actions) — read/report actions. `caixa-pdv` has the only mutating cash actions: `abrirNovaCaixaSession(valorAbertura)` and `fecharCaixaSessionAtual(valorFechamento?)`.

**`metas.ts`** (2 017 lines, 15 actions) — the most disciplined module: it is the only one that normalises the operational user id before writing (`:176`, `String(contexto.usuarioOperacional.id ?? "").trim()`). Automatic goals recompute from 12 metrics inside `calcularValorAtualMetaAutomatica` (`:1756`); `sincronizarTodasMetasAutomaticas` (`:1910`) batch-refreshes. No zod.

**`configuracoes.ts`** (1 501 lines, 6 actions) — the heaviest zod user. `salvarConfiguracoes` (`:926`) validates all 69 fields including a cross-field rule (`prazoMinimoGarantiaDias > prazoGarantiaPadraoDias` → error at `:309-313`). `obterConfiguracoes` (`:552-700`) is a 150-line waterfall of Prisma reads, `$queryRaw` fallbacks and per-field `typeof === "boolean" ? … : default` coercions to survive schema drift. Contains the `atualizarPerfil` IDOR (finding #2) and `atualizarLogoEmpresa`, which takes a client-supplied `configId` with the same pattern (lower impact — one settings row per tenant).

**`notas-fiscais.ts`** (221 lines, 5 actions), **`notificacoes.ts`** (93 lines, 4 actions), **`auditoria.ts`** (2 read actions) — straightforward.

### 6.3 Service-order state machine — as implemented

**Statuses** (`enum StatusOS`, `prisma/schema.prisma`; mirrored at `os.ts:212-221` and `components/os/tabuleiro-kanban.tsx:62-71`):

`AGUARDANDO_ORCAMENTO → AGUARDANDO_APROVACAO → APROVADO → AGUARDANDO_PECA → EM_MANUTENCAO → GARANTIA_RETORNO → PRONTO → ENTREGUE`

**Allowed transitions: all 8 × 8.** There is no transition table. `atualizarStatusOrdemServico(osId, status)` (`os.ts:691-882`) does, in order:

1. `exigirContextoTenant()`.
2. `if (!osId)` → business-rule error.
3. `if (!statusValidos.includes(status))` → business-rule error (`os.ts:707`) — *membership only, not reachability*.
4. Opens `prisma.$transaction`; loads the OS with `_count.itens` and `termoGarantia.id`.
5. `if (antes.excluidaEm)` → `"Nao e permitido alterar status de uma OS excluida."`
6. Loads `RegrasOs` from `Configuracao` (`obterRegrasOs`, `os.ts:243-300`).
7. **Three `ENTREGUE`-only gates** (`os.ts:767-787`):
   - `exigirGarantiaAntesEntrega && !ehRetornoGarantia && !termoGarantia?.id` → *"Para mover a OS para Entregue, gere o termo de garantia primeiro."*
   - `exigirDiagnosticoParaFinalizar && !observacoes.trim()` → *"Informe o diagnóstico técnico antes de finalizar a OS."*
   - `!permitirFinalizarSemPagamento && !osPossuiPagamentoConfirmado()` → *"Esta OS ainda não possui confirmação de pagamento."* (`osPossuiPagamentoConfirmado`, `os.ts:315-329`, counts `ContaReceber` with `status IN (PAGO, RECEBIDO)`).
8. Updates `status`, and **clears `archivedAt` for any status other than `ENTREGUE`** (`os.ts:790-793`) — so dragging a delivered card back to any column un-archives it.
9. Writes the audit log inside the transaction.
10. Outside the transaction: best-effort `Notificacao` for 6 of 8 statuses (all except `AGUARDANDO_ORCAMENTO` and `AGUARDANDO_APROVACAO`), then 5 `revalidatePath` calls.

**Who enforces the rules:** only this function, and only for `ENTREGUE`. The Kanban (`components/os/tabuleiro-kanban.tsx`) applies `useOptimistic` + `useTransition`, calls `onMoverOS`, and reverts the optimistic state when the action returns `sucesso: false` — it is a pure mirror, not an independent guard. The one extra client rule is a confirmation dialog when moving an item-less OS to `ENTREGUE` (`ConfirmacaoEntregaSemItens`, `tabuleiro-kanban.tsx:50-60`).

**Related transitions:**

- `archiveDeliveredOrderService({ osId })` (`os.ts:920`) — sets `archivedAt` on an already-`ENTREGUE` order.
- `gerarGarantiaEFinalizarOS({ osId, prazoGarantiaDias })` (`os.ts:1108`) — the intended happy path: creates `TermoGarantiaOS`, sets `ENTREGUE` and `archivedAt` in one transaction. Enforces `MENSAGEM_FINALIZAR_SEM_ITENS` and `MENSAGEM_FINALIZAR_SEM_GARANTIA`.
- `excluirOrdemServico({ osId, motivoExclusao })` (`os.ts:1337`) — soft delete; requires a reason; stores `statusAnterior`; also sets `archivedAt`. **Writes `excluidaPorId: String(usuario.id)` with no guard** (`os.ts:1421`) — when the central user has no mapped operational `Usuario`, `usuarioOperacional.id` is `""` (`lib/tenant/exigir-contexto-tenant.ts:24`) and the FK `OrdemServico_excluidaPorId_fkey` rejects the write, failing the whole deletion.
- `gerarPedidoVendaPorOS(osId)` (`os.ts:1543`) — bridges OS → `PedidoVenda`/`Venda`/`ContaReceber`.

### 6.4 Warranty flow

1. **Term creation.** `garantirTermoGarantiaPorOS(...)` (`garantias.ts:432`) is called from `os.ts` on finalisation; `gerarTermoGarantiaOS(input)` (`garantias.ts:646`) is the explicit entry point. Creates `TermoGarantiaOS` with `dataInicioGarantia = now`, `dataFimGarantia = now + prazoGarantiaDias`, `textoGarantia` composed from the three `Configuracao` text blocks, `criadoPorId: String(usuario.id)` (`:663` — same unguarded-empty-id issue).
2. **Listing / dashboard.** `listarGarantiasOS(filtros)` (`:932`) and `obterDashboardGarantiasOS()` (`:1140`) compute active / expiring-in-7-days / expired / with-return counts, return rate, value under warranty, and top services and parts in return.
3. **Return registration.** `registrarRetornoGarantiaOS(input)` (`:1237`) creates a `RetornoGarantiaOS` with `resultado: EM_ANALISE` and a **new `OrdemServico`** with `ehRetornoGarantia: true`, `osOrigemGarantiaId` and `retornoGarantiaId` wired up, status `GARANTIA_RETORNO`.
4. **Return closure.** `finalizarRetornoGarantiaOS(input)` (`:1441-1620`) — validates `resultado` against six allowed values excluding `EM_ANALISE` (`:1466-1476`), requires `valorAdicional > 0` when `houveCobranca` (`:1479`), caps four text fields at 1000 chars, then in one transaction: guards `finalizadoEm` (idempotency, `:1511`), updates the return, **archives the return OS if it is already `ENTREGUE`** (`:1537-1544`), and **when `houveCobranca` creates a `ContaReceber`** hard-coded to `formaRecebimento: "PIX"`, `status: "PENDENTE"`, `dataVencimento: new Date()`, `origem: "ORDEM_SERVICO"` (`:1546-1560`). Writes the audit entry, then revalidates 6 paths.

Defects: `finalizadoPorId: String(usuario.id)` unguarded (`:1533`); the hard-coded PIX payment form; `TermoGarantiaOS.canceladaEm` is never written by anything.

### 6.5 POS (PDV) flow

`processarVenda(carrinho, total, pagamentos, clienteId?)` (`pdv.ts:778-1018`):

1. `exigirContextoTenant()`.
2. `paraCentavos(total)`; load PDV payment configuration; `normalizarPagamentosEntrada` applies configured card fees and instalment rules; `validarTotalPagamentos(pagamentosProcessados, totalCentavos)` — **validates payments against the client's own total** (finding #3).
3. Transaction:
   a. `obterCaixaSessionAberta(tx)` — a sale requires an open cash session.
   b. Load `custo` for the cart's product ids (`:801-820`) — the **only** value re-read from the database.
   c. Create `Venda` (with a `formaPagamento` fallback path for pre-multi-payment databases).
   d. `vincularVendaAoCaixa`.
   e. **Per item**: create `ItemVenda` with `precoUnitario` from the client.
   f. **Per item**: `produto.updateMany({ where: { id, quantidadeEstoque: { gte: qty } }, data: { decrement } })`, throw when `count === 0`. **`Configuracao.permitirVendaSemEstoque` is never consulted here** — the flag is stored, validated and exposed in the UI but has no effect on the sale path.
   g. `setImmediate(...)` low-stock notification (see §5.6).
   h. **Per payment**: create `VendaPagamento`; if the method is deferred (`ehPagamentoPrazo`), create a `ContaReceber` with `status: PENDENTE`, `origem: VENDA_PDV`, linked 1-1 to the `VendaPagamento`.
   i. `createSalesHistoryMirror(tx, …)` — writes a mirrored `PedidoVenda` with `origem: PDV` so POS sales appear in `/vendas/historico`.
4. Six `revalidatePath` calls.

`processarVendaComOSNoPDV(osId, pagamentos, …)` (`pdv.ts:1198`) is the OS-settlement variant, reached through `obterPedidoOSParaPDV(osId)` (`:1044`).

**Cash movements** are recorded only as (a) `CaixaSession.valorAbertura`/`valorFechamento` and (b) the set of `Venda` rows attached to a session via `Venda.caixaSessionId`. **There is no cash-movement ledger** — no sangria, no suprimento, no per-movement row. `obterResumoCaixaDiario` (`caixa.ts:68-310`) and `obterHistoricoFechamentos` (`:311`) derive everything by aggregation, so a manual cash withdrawal or top-up cannot be represented at all.

**Stock movements** are likewise unlogged: `quantidadeEstoque` is decremented in place by `processarVenda` and `aprovarPedido`, incremented by nothing (there is no purchase-entry or return-to-stock flow), and `criarProduto`/`atualizarProduto` set it directly. No `MovimentoEstoque` model exists.

---

## 7. Authentication & Security

### 7.1 Session implementation

Opaque random tokens, hashed at rest. `lib/auth/sessao-central.ts`:

- `gerarTokenSessao()` — `randomBytes(32).toString("base64url")` (256 bits, CSPRNG). **Good.**
- `gerarHashToken()` — `sha256(token)` hex; only the hash is stored (`SessaoCentral.tokenHash @unique`). **Good** — a central-DB leak does not yield usable session tokens.
- Lifetime: 7 days (`DURACAO_SESSAO_MS`, `:8`). **No sliding expiry and no rotation** — `ultimoUsoEm` is updated but `expiraEm` never moves.
- `obterSessaoCentral()` re-validates user `ativo`, company `ATIVA`, tenant `ATIVO` + `connectionRef`, and the `UsuarioEmpresa` link `ativo` on every call (`:91-125`). **Good** (revocation is effective immediately) but costly (§5.6).
- `revogarSessaoCentralAtual()` sets `revogadaEm` via `updateMany` and deletes the cookie. **There is no "revoke all sessions" and no session-list UI.**
- Expired/revoked rows are **never purged** — `SessaoCentral` grows without bound.

### 7.2 Password handling

`bcryptjs`. `bcrypt.compare` in `app/actions/auth.ts:39`. Hashing happens only in scripts, at **inconsistent cost factors**: `scripts/provisionar-tenant-cunhado.mjs:175` uses `bcrypt.hash(senha, 12)`, `scripts/criar-admin-cunhado.mjs:147` and `scripts/_tmp-criar-teste-principal.mjs:89` use `10`.

**There is no password-change, password-reset or forgot-password flow in the application.** Rotating a password requires running a script against the central database.

`app/actions/auth.ts:41-45` retries `bcrypt.compare` with a trimmed password. Harmless, but it means a password with leading/trailing whitespace authenticates two different strings.

No rate limiting, no account lockout, no CAPTCHA, no login/logout audit trail. `LogAuditoria` is written for business operations but never for authentication events.

### 7.3 Cookies

`lib/auth/sessao-central.ts:54-60`:

```ts
cookieStore.set(COOKIE_SESSAO_CENTRAL, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: Math.floor(DURACAO_SESSAO_MS / 1000),
});
```

`httpOnly` ✔, `secure` in production ✔, `sameSite: "lax"` — acceptable for Server Actions (which POST same-site). No `__Host-` prefix and no explicit `domain`. Cookie names live in `lib/auth/cookies.ts`: `konext_central_session` (active) and `konext_session` (legacy, actively deleted on login and by the proxy).

### 7.4 Proxy / route protection

`proxy.ts` — matcher `/((?!api|_next/static|_next/image|favicon.ico).*)`.

```ts
const ROTAS_PUBLICAS = ["/login"] as const;
…
if (pathname.startsWith("/_next") || pathname.includes(".")) return NextResponse.next();
if (!sessaoCentral && !rotaPublica(pathname) && !rotaApi) → redirect /login (+ delete legacy cookie)
if (sessaoCentral && pathname === "/login") → redirect /
```

**Coverage.** All 34 routes are covered. Two consequences worth calling out:

1. `pathname.includes(".")` bypasses the check for **any** path containing a dot. `/os/v1.2` or `/crm/contatos/user@example.com` would skip the session check at the proxy layer. This is mitigated — every page independently calls `exigirContextoTenant()` and throws — so it is defence-in-depth loss rather than an open door, but the rule is far broader than the static-asset case it was written for.
2. **The proxy only checks that a cookie is *present*.** It does not verify the token against the database (it cannot: Prisma is excluded from the Edge bundle). An arbitrary non-empty `konext_central_session` cookie passes the proxy; the page then throws inside `exigirSessaoCentral`. The result is an unhandled server error rather than a redirect, and since there is **no `error.tsx` anywhere in `app/`** (§8.5), the user sees Next's default error screen instead of the login page.

**`/api/cron/verificar-vencimentos`** is excluded from the matcher and protects itself with `Authorization: Bearer ${CRON_SECRET}`. Correct, provided `CRON_SECRET` is set — `UNVERIFIED` whether the handler fails closed when the variable is absent; that check should be read directly at `app/api/cron/verificar-vencimentos/route.ts`.

**Actions not protected: none.** Every one of the 106 non-auth actions begins with `exigirContextoTenant()`.

### 7.5 Multi-user / role model

Two parallel user concepts:

- **`UsuarioCentral`** (central DB) — the authenticating identity; `UsuarioEmpresa.role ∈ {ADMIN, GESTOR, USUARIO}`.
- **`Usuario`** (tenant DB) — the *operational* identity; `role ∈ {ADMIN, OPERADOR, TECNICO}`. It has a `senha` column that is never used.

`mapearUsuarioOperacional` (`lib/tenant/exigir-contexto-tenant.ts:18-65`) links them **by case-insensitive e-mail**, read-only, never creating. When there is no match it returns `{ id: "", nome: <central name>, email, role: <central role> }`. That empty-string id then flows into `excluidaPorId`, `criadoPorId` and `finalizadoPorId` writes (§6.3, §6.4) and breaks foreign keys. The two role vocabularies do not map onto each other, and **neither is ever enforced** (finding #1).

### 7.6 IDOR and input-validation gaps

| Location | Issue |
|---|---|
| `app/actions/configuracoes.ts:1318-1352` | **Confirmed IDOR.** `atualizarPerfil(usuarioId, data)` writes to an arbitrary tenant user id. |
| `app/actions/configuracoes.ts:1384-1440` | `atualizarLogoEmpresa(configId, …)` accepts an arbitrary `Configuracao` id; low impact (one row per tenant) but the same shape. |
| `app/actions/pdv.ts:778` | Prices and totals accepted from the client (finding #3). |
| `app/actions/os.ts:691` | Any status accepted (finding #6). |
| 16 of 23 action modules | No schema validation at all (§6.1). |

**Cross-tenant IDOR is structurally prevented** — every action resolves its own `PrismaClient` from the session's tenant, so an id from another tenant simply does not exist in the connected database. This is the strongest property of the architecture.

### 7.7 Secrets and data exposure

- No secret is hard-coded; everything comes from `process.env`. `.env*` is git-ignored.
- Connection strings are masked before logging (`scripts/migrate-deploy-com-retry.mjs:4-11`, `scripts/seed-demo-tenant.mjs`).
- `lib/auditoria.ts:4-13` redacts `senha`, `password`, `token`, `accessToken`, `refreshToken`, `cookie`, `hash` and **`senhaDesenho`** from audit payloads. Good practice.
- **`OrdemServico.senha` and `senhaDesenho` are stored in plaintext.** These are customers' device unlock codes and Android pattern locks. They are redacted from audit logs but sit in the clear in the OS table and are rendered on the OS detail page and on printouts.
- `Produto.custo` (cost price) and `ItemOS.custoPeca` reach the browser: `listarProdutos()` returns unselected rows (`estoque.ts:63-71`) and `obterDadosDashboardOS` ships every `ItemOS` including `custoPeca` (`os.ts:97-103`, `os.ts:437`). With no role gate, every user sees margins.
- `/rastreio/[id]` is careful about this (first name only, no costs — `app/rastreio/[id]/page.tsx:31-42`); nothing else is.
- Server-side error messages are returned verbatim to clients in several places (`os.ts:874`, `vendas.ts:308`), leaking Prisma internals on failure.

---

## 8. Frontend & UI

### 8.1 Component inventory

**Shared primitives — `components/ui/` (25 files):** alert-dialog, avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, input, label, pagination-controls, popover, progress, radio-group, scroll-area, select, sheet, sonner, switch, table, tabs, textarea. Standard shadcn, `radix-nova` style.

**In-house page kit — `components/ui/pagina/` (8 files + barrel + README):** `CabecalhoPagina`, `BarraFiltros`, `TabelaDados` (generic, with `ColunaTabela<T>`), `FiguraKPI`, `ChipStatus`, `EstadoVazio`, `Superficie`, and `formatacao.ts` (`formatarMoeda`, `formatarMoedaCompacta`, `formatarNumero`, `formatarPercentual`, `formatarDataCurta`, `formatarDias`, `formatarValor`). **This is the intended design standard** — and it is adopted by only a minority of pages (§8.8).

**Feature components (≈105 files)** across `configuracoes/` (17), `os/` (32 incl. `garantias/` 9 and `impressao/` 4), `metas/` (12), `financeiro/` (10), `dashboard/` (13), `crm/` (3), `layout/` (6), `provedores/` (2), `pdv/` (2), `vendas/` (2), `estoque/` (1), `pdf/` (2).

### 8.2 Duplicated components

| Duplicate | Evidence |
|---|---|
| `components/os/coluna-kanban.tsx` vs `components/os/lista-coluna-kanban.tsx` | Two Kanban column implementations. Only `lista-coluna-kanban` is used (`tabuleiro-kanban.tsx:27`); `coluna-kanban` is reachable only through the dead barrel `components/os/index.ts:7`, which nothing imports. |
| `app/actions/financeiro.ts` vs `app/actions/financeiro-receber.ts` | `listarContasReceber` and `darBaixaConta` exist in both. The former has zero importers. |
| `lib/formatadores.ts` vs `components/ui/pagina/formatacao.ts` | Two currency/date formatter sets. |
| **32 inline currency formatters** | `new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` is re-declared in 32 files — `crm/page.tsx:30`, `crm/propostas/nova/page.tsx:69`, `crm/propostas/page.tsx:43`, `crm/propostas/[id]/page.tsx:67`, `estoque/page.tsx:119`, `financeiro/inteligencia/page.tsx:45`, `financeiro/page.tsx:24`, `os/[id]/page.tsx:437`, `pdv/page.tsx:88`, `vendas/historico/page.tsx:34`, `recibo/[id]/page.tsx:43`, `metas.ts:753`, `cron/route.ts:85`, `cartao-kpi-financeiro.tsx:24`, `dashboard-financeiro-acoes.tsx:10`, `modal-novo-recebimento.tsx:93`, `pagina-notas-fiscais.tsx:270`, `sheet-historico-fechamentos.tsx:41`, `tabela-contas-a-pagar.tsx:58`, `card-meta.tsx:23`, `dashboard-metas.tsx:6`, `detalhe-meta-cliente.tsx:53`, `aba-orcamento.tsx:39`, `cartao-os.tsx:40`, `dashboard-os.tsx:275`, `dashboard-garantias.tsx:10`, `historico-consertos-cliente.tsx:11`, `tabela-garantias.tsx:16`, `termo-garantia-documento.tsx:17`, `secao-itens-os.tsx:73`, `PropostaPDF.tsx:363`, `modal-pagamento.tsx:49` — plus the two library versions above. Four naming conventions appear (`formatarMoeda`, `formatCurrency`, `formatCurrencyBRL`, `formatCurrencyPtBr`). |
| `ConteudoReceber` / `ConteudoPagar`, `FiltrosReceber` / `FiltrosPagar` | ~1 450 lines of near-symmetric ledger UI. |

### 8.3 State management

- **Server state**: Server Components + Server Actions. `@tanstack/react-query` is installed but never imported.
- **Cart**: Zustand (`store/useCartStore.ts`) — the only global store. Not persisted, so a refresh during a sale loses the cart.
- **Optimistic UI**: `useOptimistic` appears exactly once — `components/os/tabuleiro-kanban.tsx:266-280`, with a `SUBSTITUIR`/`REORGANIZAR` reducer and snapshot rollback on failure. Well done.
- **`useTransition`**: `tabuleiro-kanban.tsx:262`, `funil-vendas-kanban.tsx`.
- **`useActionState`**: `app/(auth)/login/page.tsx` only.
- **Everything else** is `useState` + `useEffect` + manual `carregando`/`erro` flags. `PaginaMetas` and `PaginaGarantiasOS` are the canonical examples (`pagina-metas.tsx:46-60`, `pagina-garantias-os.tsx:37-70`), both guarding first-run with a `useRef` (`inicializado`, `carregamentoInicialExecutado`) — a hand-rolled substitute for server-side data loading.
- **Theme**: a bespoke `ProvedorTema` (`components/provedores/provedor-tema.tsx`) with `localStorage["konext-theme"]`, a `matchMedia` listener and a `dark` class toggle, while `next-themes` sits unused in `package.json`. `suppressHydrationWarning` on `<html>` (`app/layout.tsx:27`) papers over the resulting first-paint mismatch — there is no blocking pre-hydration theme script, so a dark-mode user gets a light flash.

### 8.4 Kanban drag-and-drop (`@hello-pangea/dnd` ^18.0.1)

Two boards: `components/os/tabuleiro-kanban.tsx` (580 lines, service orders) and `components/crm/funil-vendas-kanban.tsx` (746 lines, sales funnel).

`TabuleiroKanban`: `DragDropContext` → 8 `Droppable` columns (`ListaColunaKanban`) → `Draggable` `CartaoOS`. `aplicarMovimentoOS` (`:191-258`) recomputes the grouped lists, with a defensive fallback that re-finds the card by `draggableId` when the source index does not match. `persistirMovimento` awaits `onMoverOS`, and restores `snapshotAnterior` via the `SUBSTITUIR` action on failure. An `AlertDialog` intercepts item-less orders moved to `ENTREGUE`.

`ListaColunaKanban` adds windowing: it renders `LOTE` cards at a time and grows via an `IntersectionObserver` sentinel. This is where the 3 `react-hooks/refs` errors and 1 `set-state-in-effect` error live (`lista-coluna-kanban.tsx:40,72,73,79`) — the library's render-prop refs are not compatible with the React 19 rules. **The board works today but is blocked on any React compiler adoption.**

### 8.5 Loading / error / empty states

**There is not a single `loading.tsx`, `error.tsx`, `not-found.tsx` or `global-error.tsx` anywhere in `app/`.** Consequences:

- No route-level streaming skeletons. `Suspense` is used inside only 8 files (`financeiro/page.tsx`, `financeiro/receber/page.tsx`, `financeiro/pagar/page.tsx`, `crm/page.tsx`, `crm/contatos/page.tsx`, `estoque/page.tsx`, `pdv/page.tsx`, `layout/cabecalho.tsx`).
- **Any thrown Server Action or page error — including the routine "Sessão expirada ou inválida" from an expired cookie — renders Next's default error page**, not a login redirect.
- `notFound()` is called (`rastreio`, `os/[id]/imprimir`) but there is no `not-found.tsx` to render, so it falls back to the framework default.

Empty states: `EstadoVazio` exists in the page kit and is used by the pages that adopted the kit; elsewhere each page inlines its own.

### 8.6 Forms, masks and validation

`react-hook-form` + `@hookform/resolvers/zod` in 7 modals/wizards. All 7 need `zodResolver(schema) as unknown as Resolver<T>` (`funil-vendas-kanban.tsx:360`, `modal-novo-cliente.tsx:89`, `modal-novo-produto.tsx:71`, `modal-novo-recebimento.tsx:59`, `modal-registro-cobranca.tsx:65`, `modal-nova-os.tsx:84`, `ordem-servico-form.tsx:106`) — a zod-4/RHF-7 type incompatibility papered over with a double cast in every instance. Three of them also trip `react-hooks/incompatible-library`.

Masks are **hand-rolled per component** via `replace(/\D/g, "")` + slice; there is no shared mask library and no shared mask module. CPF/CNPJ, phone and currency masks are each re-implemented in `modal-novo-cliente.tsx`, `painel-empresa.tsx`, `modal-pagamento.tsx` and others. `formatarDecimalPtBr` in `modal-pagamento.tsx` is the POS's own currency parser. Document validation is **format-only** — there is no CPF/CNPJ check-digit validation anywhere (`lib/validations/crm.ts` validates length, not the checksum).

### 8.7 Responsiveness and accessibility

Responsive: the layout uses Tailwind breakpoints throughout (`grid-cols-1 … xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]`, `app/(dashboard)/page.tsx:68`), and `components/layout/menu-mobile.tsx` provides a mobile nav. `components/os/dashboard-os.tsx` and `/pdv` are dense desktop-first surfaces; the 8-column Kanban is horizontally scrolled on mobile. Drag-and-drop on touch is `UNVERIFIED`.

Accessibility: shadcn/Radix primitives give keyboard and ARIA behaviour for free in dialogs, selects, tabs and dropdowns. Gaps found by lint: 5 raw `<img>` elements (`estoque/page.tsx:333`, `pdv/page.tsx:628`, `recibo/[id]/page.tsx:256`, `preview-identidade-empresa.tsx:58`, `termo-garantia-documento.tsx:41`) and 1 missing `alt` (`PropostaPDF.tsx:404`). No `aria-live` region for toast announcements beyond what sonner provides; no skip-link; colour-only status encoding in the Kanban chips and `ChipStatus`.

### 8.8 Design consistency

Three visual languages coexist:

1. **The page kit** (`components/ui/pagina/`) — `Superficie`, one 1px hairline, muted palette. Used by garantias, metas and parts of financeiro.
2. **Slate/glassmorphism** — `/vendas` hub and `/crm` hub use `bg-slate-950/55 backdrop-blur-xl`, `shadow-[0_20px_60px_-30px_…]`, cyan accents, hard-coded `text-slate-50` (`vendas/page.tsx:114-165`) — these do **not** respond to the theme.
3. **Token-based shadcn** — `bg-card`, `text-foreground`, `border-border` — used by the dashboard and OS detail.

`app/globals.css` defines the HSL token set, but pages of type 2 bypass it entirely, so the dark/light toggle produces inconsistent results across the app. `ARQUITETURA.md` documents a fourth palette (emerald/blue/violet/orange/red) that matches none of them.

---

## 9. Code Quality

### 9.1 Type escape hatches

| Pattern | Count | Notes |
|---|---|---|
| `: any` / `as any` / `<any>` | **0** | Genuinely clean — `strict: true` holds. |
| `as unknown as` | **42** | Listed below. |
| `@ts-ignore` / `@ts-expect-error` | **0** | |
| `eslint-disable` | **2** | `aba-entrada-equipamento.tsx:53` (`exhaustive-deps`), `os-impressao-termica.tsx:46` (`no-img-element`). |

The 42 `as unknown as` casts fall into four groups:

1. **Prisma delegate probing (24 casts)** — `configuracoes.ts:620,625`; `financeiro-hub.ts:210,215,220,229,246`; `financeiro-pagar.ts:214,215,271,376,431,433`; `financeiro-receber.ts:443`; `oportunidades.ts:120,148,246,342,405`; `os.ts:423`; `pdv.ts:802,803,1222,1223`; `auditoria.ts:41`. Every one erases Prisma's generated types to reach a `prisma.model ?? prisma.Model` fallback.
2. **`zodResolver` casts (7)** — §8.6.
3. **`globalThis` casts (5)** — `lib/prisma.ts:6,37,38,39`, `lib/central/prisma-central.ts:6`. Idiomatic.
4. **`ws as unknown as typeof WebSocket` (3)** — `lib/prisma.ts:20`, `lib/central/prisma-central.ts:20`, `lib/tenant/cache-prisma-tenant.ts:30`. Necessary.

Group 1 is the refactor target: it is ~57 % of all casts and exists solely to survive the migration drift of §5.4.

Non-null assertion (`!`) abuse: not found at any meaningful scale; the codebase prefers `?? default` and explicit guards.

### 9.2 Dead code

| Item | Evidence |
|---|---|
| `app/actions/financeiro.ts` (100 lines, 2 actions) | Zero importers. |
| `components/os/index.ts` (barrel) | Zero importers — grep for `from "@/components/os"` returns nothing. |
| `components/os/coluna-kanban.tsx` | Reachable only via the dead barrel. |
| `types/indice.ts` | Zero importers. |
| `enum TipoCliente` (`prisma/schema.prisma`) | Referenced by no model; duplicates `CategoriaCliente`. |
| `Usuario.senha` column | Never read or written by `app/`. |
| `TermoGarantiaOS.canceladaEm` / `motivoCancelamento` | No writer. |
| `Meta.erroSincronizacao` display | `UNVERIFIED` — the column is written; whether any UI shows it was not confirmed. |
| `tailwind.config.ts` | Superseded by Tailwind v4 CSS config. |
| `public/*.svg` (5 files) | The create-next-app defaults; no references. |
| `scripts/_tmp-conferir-financeiro.mjs`, `_tmp-criar-teste-principal.mjs`, `_tmp-limpar-legado-seed.mjs` | Self-labelled temporary; committed. `_tmp-limpar-legado-seed` is a one-shot data-cleanup script for a seed run that happened once. |
| Deps `axios`, `@tanstack/react-query`, `next-themes`, `tailwindcss-animate`, `shadcn` | §2.1. |
| `revalidatePath("/dashboard")` | `os.ts:858` — no such route. |
| 21 unused locals/imports | ESLint `no-unused-vars` warnings, concentrated in `new-sales-order-wizard.tsx` (5), `metas.ts` (4), `dashboard.ts` (3), `estoque/page.tsx` (2). |

### 9.3 Duplicated logic (side by side)

**A. Currency formatting** — 32 copies (§8.2). Representative pair:

```ts
// components/metas/card-meta.tsx:23
function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
// components/os/garantias/dashboard-garantias.tsx:10
function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
```

Byte-identical bodies, defined 30+ times, while `components/ui/pagina/formatacao.ts:1` already exports exactly this.

**B. `TipoPeca` option lists** — the six-value part-type list is redeclared seven times in three different shapes:
`app/actions/os-itens.ts:11-16` (string array), `lib/validations/os.ts:15-20` (zod enum), `types/os.ts:16-21` (union type), `components/os/abas/aba-orcamento.tsx:19-24` and `components/os/secao-itens-os.tsx:65-70` (`{value,label}` arrays, duplicated verbatim), `components/os/modal-nova-os.tsx:36-41` and `components/os/ordem-servico-form.tsx:31` (inline zod enums), plus `app/(dashboard)/os/[id]/page.tsx:23` (inline union).

**C. `StatusOS` sequence + presentation** — declared in `prisma/schema.prisma`, `app/actions/os.ts:212-221`, `components/os/tabuleiro-kanban.tsx:62-71` (`STATUS_SEQUENCIA`) and `dados/mock-os.ts:6-26` (`mapStatusLabel` + `mapStatusColor`), with a *different* colour scheme again in `tabuleiro-kanban.tsx:79-144` (`configuracaoStatus`). Four sources of truth for one enum.

**D. Receber / Pagar UI** — §8.2.

**E. Prisma delegate fallback** — the `x.model ?? x.Model` idiom is re-implemented independently in `os.ts`, `pdv.ts` (as `obterDelegateComFallback`/`obterDelegateComFallbackOpcional`), `configuracoes.ts`, `financeiro-pagar.ts`, `oportunidades.ts`, `auditoria.ts` and `api/cron/verificar-vencimentos/route.ts`.

### 9.4 Large files (>300 lines) and mixed responsibilities

52 545 lines of TS/TSX total. Files over 300 lines, with the responsibilities they mix:

| Lines | File | Mixed responsibilities |
|---|---|---|
| 2 191 | `app/actions/dashboard.ts` | Raw SQL + Prisma + business rules + DTO shaping + fallback handling; `obterDashboardExecutivo` alone is 1 138 lines |
| 2 017 | `app/actions/metas.ts` | CRUD + checklist + history + 12 automatic-metric calculators + audit |
| 1 743 | `app/actions/garantias.ts` | Term generation + listing + dashboard + returns + closure + receivable creation |
| 1 702 | `app/actions/os.ts` | 12 actions + DTO mapping + config reading + raw-SQL fallbacks + order→sale bridging |
| 1 501 | `app/actions/configuracoes.ts` | 69-field zod schema + legacy-runtime fallbacks + profile + logo upload |
| 1 492 | `app/(dashboard)/pdv/page.tsx` | Cart + product search + customer search + cash session + discounts + OS settlement + printing |
| 1 467 | `app/actions/pdv.ts` | Payment normalisation + sale + stock + receivables + sales mirror + notifications |
| 1 420 | `components/pdv/modal-pagamento.tsx` | Multi-payment splitting + fee calculation + instalments + change + currency parsing |
| 1 266 | `components/vendas/new-sales-order-wizard.tsx` | 4-step wizard + product/customer search + instalment builder |
| 876 | `app/(dashboard)/crm/propostas/nova/page.tsx` | Proposal wizard |
| 808 | `.../financeiro/receber/components/ConteudoReceber.tsx` | Table + filters + 3 modals + summary |
| 791 | `app/(dashboard)/crm/contatos/page.tsx` | List + search + pagination + CRUD modals + CNPJ lookup |
| 758 | `app/actions/financeiro-inteligencia.ts` | |
| 746 | `components/crm/funil-vendas-kanban.tsx` | Board + form + modal |
| 653 | `components/crm/modal-novo-cliente.tsx` | Form + masks + CNPJ lookup |
| 648 | `.../financeiro/pagar/components/ConteudoPagar.tsx` | |
| 647 | `app/(dashboard)/financeiro/inteligencia/page.tsx` | |
| 645 | `components/os/dashboard-os.tsx` | Kanban/list/deleted mode switching + filters + modals |
| 637 | `app/actions/crm.ts` | |
| 630 | `app/(dashboard)/vendas/historico/page.tsx` | Page + inline Prisma queries + filters + sheet |

…and roughly 30 more files between 300 and 600 lines.

### 9.5 Naming inconsistencies

The stated convention (`ARQUITETURA.md`, "Nomes em Português (PT-BR) — todas as variáveis, funções e interfaces em português") is followed in roughly 80 % of the code and abandoned in identifiable islands:

- **English action modules**: `app/actions/vendas.ts` — `createPedidoVenda`, `ApprovePedidoVendaResult`, `isDeferredPaymentMethod`, `customerLabel`, `inventoryUpdate`, `installment`; `app/actions/propostas.ts` — `createProposta`.
- **English inside Portuguese modules**: `app/actions/os.ts` exports `archiveDeliveredOrderService({ osId })` and internally uses `orderServiceId`, `orderServiceDelegate`, while its neighbours are `criarOrdemServico` and `excluirOrdemServico`. `os.ts` also mixes `RawOrdemServico`/`OrdemServicoPedido` with `includeOrderRelations`.
- **English component files**: `components/vendas/new-sales-order-wizard.tsx`, `components/vendas/sales-history-order-sheet.tsx`, `components/crm/proposal-actions-cell.tsx`, `components/pdf/PropostaPDF.tsx`, `components/ui/pagination-controls.tsx`.
- **File-name casing**: kebab-case everywhere except `components/pdf/PropostaPDF.tsx`, `hooks/useCalculadoraPrecosOS.ts`, `store/useCartStore.ts`, and the PascalCase files under `financeiro/receber/components/` (`ConteudoReceber.tsx`, `FiltrosReceber.tsx`) and `financeiro/pagar/components/`.
- **Directory naming**: `contextos` (pt) alongside `hooks`, `store`, `types` (en); `dados` (pt) alongside `lib` (en).
- **Misleading names**: `dados/mock-os.ts` contains no mock data — it holds the production status label/colour maps. `types/indice.ts` is the Portuguese `index` but is dead.
- **Accented identifiers**: `lib/validations/financeiro.ts:140` uses `rótulo` as an object key, mixed with unaccented keys elsewhere.

### 9.6 TODO / FIXME / HACK

Exactly **one** real marker in the entire codebase:

```ts
// app/actions/financeiro-receber.ts:338
// TODO: em migracao futura, priorizar cancelamento/soft-delete para trilha financeira mais robusta.
```

(All other grep hits for "TODO" are the Portuguese word *todos/todas* in UI strings and filter values.) The absence of markers is not a sign of health here — the known problems are recorded in prose comments instead, e.g. the 8-line multi-tenancy exception at `app/rastreio/[id]/page.tsx:4-9` and the schema comments `// Apos salvar o schema, execute: npx prisma db push` that appear four times in `prisma/schema.prisma`.

### 9.7 Currency and decimal handling

- **Schema**: `Float` (PostgreSQL `double precision`) for every transactional amount; `Decimal(5,2)` only for `Configuracao` percentages, plus `Oportunidade.valor` and `RetornoGarantiaOS.valorAdicional`. Full list in §5.2.
- **Application**: `lib/pdv/pagamentos.ts` implements `paraCentavos`/`paraMoeda` and does all POS payment maths in integer cents — correct, and used by `pdv.ts` and `modal-pagamento.tsx`. Nothing else uses it. `os.ts:322` sums `valorCobrado` with a plain `reduce(+)`; `financeiro-*.ts` aggregates `Float` columns directly in Prisma.
- The result is two incompatible money regimes in one system: exact cents inside the POS, binary floats everywhere they are stored and re-aggregated.

### 9.8 Date and timezone handling

- **No timezone library and no IANA zone anywhere.** `date-fns` is installed and imported in only 2 files.
- 14 sites compute day boundaries with `setHours(0,0,0,0)` / `setHours(23,59,59,999)` on server-local time — `api/cron/verificar-vencimentos/route.ts:48-58`, `caixa.ts`, `dashboard.ts`, `financeiro-hub.ts`, `metas.ts`.
- Display formatting is locale-correct (`toLocaleDateString("pt-BR")`, `formatarDataBrasileira`) but zone-naive.
- `OrdemServico.criadoEm`/`atualizadoEm` are `DateTime` (`timestamp(3)` without zone) — the Prisma default — and are compared against JS `Date`s built in the server's zone.
- On Vercel (UTC) a sale at 22:00 São Paulo lands on the next calendar day in every "today" aggregate.

---

## 10. Performance

### 10.1 Unnecessary client components

Seven pages are `"use client"` at the top level: `/login` (justified), `/crm`, `/crm/contatos`, `/crm/propostas/nova`, `/estoque`, `/financeiro/inteligencia`, `/pdv`, `/perfil`. Of these, `/crm` (392 lines) renders **static navigation cards only** and has no interactivity that requires a client boundary.

Worse are the **inverted pages**: `/metas` and `/os/garantias` are Server Components that render nothing but a `"use client"` child which then fetches on mount. Both are statically prerendered as empty shells (`○` in the build output). This is the opposite of the App Router model: the data is available on the server, is fetched through Server Actions anyway, and could be passed as props with zero client fetching.

### 10.2 Client bundle weight

The largest client trees are `/pdv` (page 1 492 + `modal-pagamento` 1 420 + cart store) and `/vendas/pedidos/novo` (wizard 1 266). `recharts` (3 import sites) and `@react-pdf/renderer` (1 site, `components/pdf/PropostaPDF.tsx` 564 lines) are both heavy and both statically imported — **no `next/dynamic` anywhere in the repo**. `@hello-pangea/dnd` loads on `/os` and `/crm/oportunidades`.

`lucide-react` is 30 minor versions behind (1.17.0 vs 1.47.0); icon imports are individual named imports, so tree-shaking should apply — `UNVERIFIED` without a bundle analysis.

### 10.3 Missing Suspense / streaming

No `loading.tsx` at any level (§8.5). `Suspense` inside 8 files only. The dashboard (`app/(dashboard)/page.tsx`, `force-dynamic`) awaits `obterDashboardExecutivoSeguro` + `obterConfiguracoes` **before rendering anything** — ~40 queries serialised into one blocking await, with no skeleton. This is the single biggest perceived-latency item in the app.

### 10.4 Over-fetching and pagination

| Query | Bound |
|---|---|
| `obterDadosDashboardOS` (`os.ts:456-480`) | **None.** All active + all archived orders, with all items. |
| `estoque.ts:63` `listarProdutos` | **None.** All active products, full rows including `custo`. |
| `pdv.ts:749` `listarProdutosPDV` | **None**, but `select`ed to 4 fields. |
| `pdv.ts:728` `listarClientesPDV` | **None.** All customers. |
| `crm.ts:419` `listarClientes` | **None** (the paginated variant at `:484` exists alongside it). |
| `financeiro-receber.ts:59` `listarContasReceber` | **None.** |
| `financeiro-pagar.ts:269` `listarParcelasPagar` | **None** — the file's own comment at `:321` notes the filtered variant was added "evitando retornar registros de todos os períodos sem filtragem", but the unbounded export remains. |
| `garantias.ts:1691` `obterHistoricoConsertosCliente` | `take: 30` ✔ |
| `metas.ts:874` `listarMetas` | Paginated (`tamanhoPagina: 24`) ✔ |
| `garantias.ts:932` `listarGarantiasOS` | Paginated (`tamanhoPagina: 20`) ✔ |
| `crm.ts:484`, `estoque.ts:82` | Paginated ✔ |

`PaginationControls` is used on exactly 3 surfaces (`crm/contatos`, `estoque`, `sheet-historico-fechamentos`).

### 10.5 Caching strategy

Effectively **none**. `export const dynamic = "force-dynamic"` on the dashboard; `revalidatePath` scattered across actions; **no `revalidateTag`, no `unstable_cache`, no `fetch` with `next: { revalidate }`, no `cache()` wrapper**. Every page load re-executes every query. Given that `obterSessaoCentral` alone costs 6 central-DB round-trips (§5.6) before any page query runs, per-request latency is dominated by fixed overhead.

The two Prisma "cache invalidation" heuristics (`lib/prisma.ts:34-44`, `lib/central/prisma-central.ts:34-38`) are not a caching strategy — they are drift detection for the `globalThis` client in development.

### 10.6 Images

`next/image` is used **nowhere**. Five raw `<img>` tags (§8.7) plus `imagemUrl` fields rendered directly. Logos and profile photos are stored as **data URLs in the database** — that is why `bodySizeLimit` is 5 MB (`next.config.ts:5`). A 5 MB base64 logo is re-fetched inside `Configuracao` on every `obterConfiguracoes()` call, which the dashboard, OS detail, every print page and the receipt all make. There is no object storage, no CDN, no resizing and no format negotiation.

---

## 11. Domain Generalization Readiness

**The system is built for phone repair, not technical assistance in general.** The coupling is at four levels.

### 11.1 Schema-level coupling

| Field / enum | Location | Problem |
|---|---|---|
| `OrdemServico.imei` | `prisma/schema.prisma` | A phone-only identifier. A notebook has a service tag, a TV a serial, an appliance a model+serial pair, a console a console-ID. |
| `OrdemServico.senhaDesenho` | idem, with the comment `// Guarda os nos do padrao em string (ex: "1-2-5-8-9")` | The Android 3×3 pattern lock. Meaningless outside phones; `components/os/abas/aba-entrada-equipamento.tsx` renders an actual 9-dot grid for it. |
| `enum TipoPeca` | idem | `TELA`, `BATERIA`, `CONECTOR_CARGA`, **`TAMPA_IPHONE`**, **`TAMPA_ANDROID`**, `OUTROS`. Two of six values name phone brands. |
| `enum CategoriaProduto` | idem | `ACESSORIO // Cabos, Capas, Películas`, `PECA_REPARO // Telas, Baterias, Conectores`, `EQUIPAMENTO_REDE`, `SERVICO`, `OUTROS`. |
| `OrdemServico.equipamento / marca / modelo` | idem | Three free-text columns — flexible, but with no catalogue, no per-segment field definitions and no validation. |
| No checklist model | — | `condicaoFisica` and `acessorios` are free text. There is no structured intake checklist that could vary by equipment type. |

### 11.2 Business-rule coupling

`lib/utils/precificacao.ts` hard-codes a **phone-repair price table** keyed by `TipoPeca`, documented at `components/os/README.md:40-45`:

| `TipoPeca` | Markup |
|---|---|
| `TELA` | cost + fixed BRL amount |
| `CONECTOR_CARGA` | cost + R$ 100 |
| `TAMPA_IPHONE` | cost + R$ 200 |
| `TAMPA_ANDROID` | cost + R$ 80 |

(The exact `TELA` and `BATERIA` figures are in the README table; the switch is at `lib/utils/precificacao.ts:20-35`. `UNVERIFIED` for the precise `TELA`/`BATERIA` constants.)

Fixed BRL markups per phone part, in application code, with no per-tenant override (`Configuracao.habilitarMargemAutomatica` toggles it on/off but cannot change the table). Consumed by `hooks/useCalculadoraPrecosOS.ts` and `components/os/abas/aba-orcamento.tsx`. Note that `app/actions/os.ts:6` carries the comment *"Importação de calcularPrecoVendaPeca removida — preços são definidos manualmente pelo operador"* — so the server no longer applies the table, but the client still does.

### 11.3 UI and label coupling

The `TipoPeca` option list is redeclared in 5 UI files with labels *"Tela"*, *"Bateria"*, *"Conector de Carga"*, *"Tampa iPhone"*, *"Tampa Android"* (`aba-orcamento.tsx:19-24`, `secao-itens-os.tsx:65-70`). `components/os/abas/aba-entrada-equipamento.tsx` (350 lines) is an intake form built around IMEI, unlock password and the pattern grid. The print templates (`os-impressao-a4.tsx`, `os-impressao-termica.tsx`), the warranty term (`termo-garantia-documento.tsx`) and the public tracking timeline (`app/rastreio/[id]/page.tsx`) all label the device block with phone vocabulary.

### 11.4 Other segment blockers

- **No equipment-type concept at all.** There is no `TipoEquipamento`/`Segmento` model, so nothing can vary intake fields, checklists, part types or pricing per device class.
- **No serial/asset-number field** other than `imei`.
- **No multi-item service orders** — one `OrdemServico` = one device. A shop taking in three TVs from one customer creates three unrelated orders.
- **No technician assignment** — `RoleUsuario.TECNICO` exists in the enum but there is no `OrdemServico.tecnicoId` field and no assignment UI. Workshop segments (appliances, consoles) typically need bench/technician routing.
- **No labour-hours or bench-time model** — `ItemOS` is parts-shaped (`custoPeca`, `valorCobrado`); services are represented by abusing `TipoPeca.OUTROS` or `CategoriaProduto.SERVICO`.
- **No warranty differentiation by equipment class** — a single `prazoGarantiaPadraoDias` for the whole tenant.
- **Seed data**: `scripts/seed-demo-tenant.mjs` (deterministic, seed `20260903`, all ids prefixed `seed-demo-`) generates demo rows; whether its equipment names are phone-specific is `UNVERIFIED` — the guard logic was reviewed, not the fixture payload.
- **Brazil-only**: BRL hard-coded in 32 formatters, `pt-BR` locale everywhere, CPF/CNPJ as the only document types, PIX/Boleto/Crediário payment methods, `EMPENHO_PUBLICO` (Brazilian public-procurement commitment) as a `FormaPagamento`, `OrigemReceita.LICITACAO`. Generalising beyond Brazil is a separate, larger project.

### 11.5 Multi-tenancy status

**The application is genuinely multi-tenant, database-per-tenant.** Central registry → session → `connectionRef` → env var → cached client. There is no `empresaId`/`tenantId` column in the tenant schema because isolation is physical. 106 of 108 actions go through `exigirContextoTenant()`. Seven `tenant:verificar-*-isolamento` scripts exist to assert isolation per module.

**Remaining blockers to multi-tenancy at scale:**

1. **`app/rastreio/[id]/page.tsx:10`** — the one code path still bound to the global `DATABASE_URL`. Blocks tenant #2 from ever having working tracking links.
2. **Tenant onboarding requires a deploy.** `connectionRef` names an environment variable (`lib/tenant/resolver-conexao-tenant.ts:23`), so every new tenant needs a Vercel env-var change and redeploy. Secure, but not self-service. With N tenants the platform environment holds N connection strings.
3. **Schema provisioning is manual and divergent.** New tenants get `prisma/tenant-baseline/operacional-baseline-20260706.sql`; existing tenants get `prisma migrate deploy`. There is no per-tenant migration runner and no way to know which tenants are on which schema version — `Tenant.versaoSchema` exists in the central schema but nothing in `app/` reads or updates it.
4. **The delegate-probing code (§9.3-E) is an admission that tenants are already drifting.** Each `?? prisma.Model` fallback and each `$queryRaw` fallback exists because some tenant database is expected to be missing a column.
5. **Connection-pool growth.** One `PrismaClient` + pool per tenant per instance, never evicted (§5.5).
6. **One company, one tenant.** `autenticarCentral` rejects any user with ≠1 active company or any company with ≠1 active tenant (`auth.ts:70,87`). There is no tenant-switcher UI, so the `Empresa 1—N Tenant` relation in the central schema cannot be exercised.
7. **No tenant-level rate limiting, quotas or usage metering.**

---

## 12. Testing, Tooling & DevOps

### 12.1 Tests

**None.** No `*.test.*`, no `*.spec.*`, no `__tests__`, no test runner in `devDependencies`, no test script. Zero coverage of the warranty state transitions, the payment-splitting maths in `lib/pdv/pagamentos.ts`, the 12 automatic-goal metrics, or the financial aggregations.

### 12.2 CI

**None.** No `.github/`, no `.gitlab-ci.yml`, no `.circleci/`, no pre-commit hooks, no `husky`, no `lint-staged`. Nothing enforces that `tsc` or `eslint` passes before merge — which is how 12 lint errors and a build that fails without env vars reached `main`.

### 12.3 Deploy

Vercel, inferred from `README.md` and the retry script's advisory-lock handling (a Vercel-build concurrency symptom). No `vercel.json`, so all settings live in the Vercel dashboard — **outside version control and outside this audit**.

The deploy pipeline is `npm run build` = `prisma generate && prisma:central:generate && node scripts/migrate-deploy-com-retry.mjs && next build`. Running migrations **inside the build step** means: (a) migrations run on every deploy including preview deploys, (b) a failed migration fails the build, (c) there is no separate approval gate for schema changes, and (d) concurrent builds race for the Prisma advisory lock — exactly what the retry wrapper was written to paper over. The README's own warning (*"Nunca rode `npm run build` localmente com o `.env` de produção ativo"*) is the clearest signal that this coupling is a hazard.

`scripts/verificar-ambiente.mjs` plus the `AMBIENTE` / `AMBIENTE_MISTO_CIENTE` variables exist to detect the mixed test/production connection state that this design makes easy to reach.

### 12.4 Seeds and operations scripts

21 `.mjs` scripts. The notable ones:

- **`seed-demo-tenant.mjs`** — deterministic demo data. Guards: requires `AMBIENTE=teste`, cross-checks `.env.teste`, refuses to run against a non-test host, prefixes every id with `seed-demo-` and only ever deletes rows carrying that prefix. **Well built.**
- **`bootstrap-tenant-principal.mjs`**, **`provisionar-tenant-cunhado.mjs`**, **`criar-admin-cunhado.mjs`** — tenant provisioning and admin creation, with `--dry-run` / `--confirm` gates. Note the naming: *"cunhado"* (brother-in-law) is a person, not a role — these scripts are hard-coded to one specific real-world tenant.
- **Seven `verificar-*-isolamento.mjs` scripts** (crm, estoque, os-garantias, pdv-vendas, financeiro, metas-dashboard-auditoria, plus the general one) and `verificar-arquitetura-final.mjs` — manual, ad-hoc isolation assertions. They are the closest thing to a test suite, but they are not automated, not asserted in CI and require live databases.
- **Three `_tmp-*` scripts** — committed leftovers (§9.2).

### 12.5 Logging and observability

- `console.error` in 3 places (`pdv.ts:1015`, `vendas.ts:311`, and one more), `console.log`/`console.warn` in the scripts. **No structured logging, no logger abstraction, no request ids, no Sentry/OpenTelemetry/APM.**
- Prisma is configured to log `["error", "warn"]` in development and `["error"]` in production (`lib/prisma.ts:28`, `lib/central/prisma-central.ts:28`).
- `LogAuditoria` is a **business** audit trail (who changed which entity), not operational logging. It is written by os, os-itens, garantias, metas, financeiro-receber, financeiro-pagar and configuracoes — **not** by pdv, vendas, crm, estoque, caixa or auth. So the highest-value events for a retail system — a sale, a cash close, a login — are unaudited.
- Silent failure is a recurring pattern: `catch {}` with a comment appears in `exigir-contexto-tenant.ts:62`, `os.ts:299`, `os.ts:851`, `pdv.ts:943`, `configuracoes.ts:1292`, `garantias.ts` and elsewhere. Notification failures, audit-table-missing failures and user-mapping failures are all swallowed with no telemetry.

### 12.6 Backup considerations

Nothing in the repository addresses backup, restore, point-in-time recovery or tenant data export. With N tenant databases plus one central database, a restore also needs the central↔tenant mapping to be consistent at the same point in time. There is no documented runbook and no tenant-export path. `Tenant.versaoSchema` is the only field that could support "restore this tenant to the schema it was on", and nothing maintains it.

---

## 13. Documentation Drift

### 13.1 `ARQUITETURA.md` — substantially obsolete

| Claim | Reality |
|---|---|
| Entire tree rooted at `src/` | **No `src/` directory exists.** `app/`, `components/`, `lib/` are at the repo root. |
| `src/app/auth/entrar/page.tsx` — login at `/auth/entrar` | Login is `app/(auth)/login/page.tsx` at `/login`. |
| `src/tipos/indice.ts` | The directory is `types/`, and `types/indice.ts` is dead code. |
| `src/dados/moqueado.ts` — mock data | The file is `dados/mock-os.ts` and contains status label maps, not mocks. |
| `src/components/layout/barralateral.tsx` — collapsible sidebar | No such file. Navigation is a **header** (`components/layout/cabecalho.tsx` + `nav-principal.tsx` + `menu-mobile.tsx`). |
| `cartao-kpi.tsx`, `grafico-faturamento.tsx`, `grafico-status-os.tsx`, `tabela-atividade.tsx` | None exist. The dashboard components are `banda-kpis`, `grafico-resultado`, `grafico-saldo`, `tabela-dre`, `fila-os`, `tabela-parados`, `medidores-orcamento`, `bloco-garantia`, `bloco-metas`, `lista-movimentacoes`. |
| "Next.js 14+" | Next.js **16.2.7**. |
| "Zustand: State management (preparado para uso futuro)" | In active use for the PDV cart. |
| "Axios: Cliente HTTP", "React Query: Cache de dados" | **Neither is imported anywhere.** |
| "Next-themes: Suporte a Light/Dark mode" | Replaced by a hand-rolled `ProvedorTema`; `next-themes` is unused. |
| "Dados Mockados… KPIs, Gráfico de Faturamento, Transações Recentes" | The entire app is database-backed via Prisma. |
| "Páginas Implementadas: Login, Dashboard, Perfil" (3 pages) | **34 routes**, 10 modules. |
| "Perfil: Alteração de senha [x]" | **No password-change flow exists.** |
| "Fluxo de Integração Backend: substituir mockados em…" | The backend integration is complete; this section describes a state from ~60 commits ago. |
| Colour palette "Emerald/Blue/Violet/Orange/Red" | `app/globals.css` defines an HSL token system; three different visual languages are in use (§8.8). |
| "Sidebar colapsível com ícones" | There is no sidebar. |

**Nothing in `ARQUITETURA.md` describes the multi-tenant architecture, the central database, sessions, Server Actions, the warranty module, the POS, goals, or the audit log** — i.e. it omits everything the system actually is.

### 13.2 `QUICKSTART.md` — obsolete

- `http://localhost:3000/auth/entrar` — wrong URL (`/login`).
- "Teste com qualquer email e senha (mínimo 6 caracteres)" — authentication is real, against bcrypt hashes in the central database.
- "4 KPI Cards com dados moqueados", "Tabela com 5 atividades recentes" — the dashboard is database-driven.
- "`/perfil` — Alterar senha" — does not exist.
- "`npm install` then `npm run dev`" — omits that `npm run prisma:central:generate` is required for the project to typecheck, and that `DATABASE_URL` + `CENTRAL_DATABASE_URL` are mandatory.

### 13.3 `README.md` — partially accurate

The `build` vs `build:local` section is **accurate and valuable** — it correctly documents the migration hazard. Everything above it is the untouched `create-next-app` boilerplate, including *"You can start editing the page by modifying `app/page.tsx`"* — a file that does not exist (the root page is `app/(dashboard)/page.tsx`). The README never mentions multi-tenancy, required environment variables, or the central database.

### 13.4 `AGENTS.md` / `CLAUDE.md`

Accurate as far as they go, but they state only that the Next.js version differs from training data. They document **none** of the six repo-specific deviations listed in §2.7 — most importantly `proxy.ts` instead of `middleware.ts`, the two-schema Prisma setup, and the fact that a fresh checkout does not typecheck until the central client is generated.

### 13.5 `INTEGRACAO_BACKEND.md` and `RELATORIO_FINAL.md`

Historical artefacts of the frontend→backend migration. `INTEGRACAO_BACKEND.md` describes an integration that has since been completed and superseded by the multi-tenant rewrite. Content not re-verified line by line — `UNVERIFIED`, but both predate the multi-tenant commits (`cb36e8c`, `1d393dc`, `a366f96`) and cannot describe the current design.

### 13.6 `components/os/README.md`

Mostly accurate for the OS module, but it documents `coluna-kanban.tsx` ("Coluna individual") as part of the live structure when that component is dead (§9.2), and it publishes the hard-coded phone price table (§11.2) as though it were configuration.

### 13.7 In-code documentation drift

`prisma/schema.prisma` carries four stale instructions to run `npx prisma db push` (after the `TipoPapel` enum, after `FormaPagamento`, after the `Despesa` model, after `NotaFiscal`). `db push` is incompatible with the migration-based deploy pipeline; following these comments would cause exactly the drift described in §5.4.

`components.json` points `tailwind.css` at `src/app/globals.css` — a `src/` path (§2.4).

---

## 14. Findings Table

| ID | Severity | Area | Finding | Evidence (file:line) |
|---|---|---|---|---|
| F-01 | Critical | Security / AuthZ | No authorization layer. `role` is propagated through the session and tenant context but never compared anywhere; every authenticated user can perform every operation including OS deletion, settings changes, financial discharge and cash close. | `lib/auth/sessao-central.ts:142`; `lib/tenant/exigir-contexto-tenant.ts:78`; `app/actions/configuracoes.ts:1302` (only reads, never compares) |
| F-02 | Critical | Build / DX | Clean checkout does not typecheck. `postinstall` generates only the tenant client; `@prisma/client-central` is missing until `prisma:central:generate` runs. | `lib/central/prisma-central.ts:1`; `app/actions/auth.ts:68`; `package.json` `postinstall` |
| F-03 | Critical | Security / IDOR | `atualizarPerfil(usuarioId, data)` updates any tenant user by client-supplied id with no ownership check. | `app/actions/configuracoes.ts:1318-1352` |
| F-04 | Critical | Security / POS | `processarVenda` trusts client-supplied `item.preco` and `total`; only `custo` is re-read from the database. Discount cap enforced only in the UI. | `app/actions/pdv.ts:778-820`, `:866-895`; `app/(dashboard)/pdv/page.tsx:998-1002` |
| F-05 | Critical | Build / Runtime | `next build` fails at page-data collection without `DATABASE_URL` because `lib/prisma.ts` throws at module scope and `/rastreio/[id]` imports it. | `lib/prisma.ts:13-17`; `app/rastreio/[id]/page.tsx:10` |
| F-06 | Critical | Multi-tenancy | `/rastreio/[id]` queries the global `DATABASE_URL` client, so the public tracking page can only ever read one tenant. | `app/rastreio/[id]/page.tsx:4-10` |
| F-07 | Critical | Routing | `/rastreio/[id]` is not in `ROTAS_PUBLICAS`, so anonymous visitors are redirected to `/login` — the customer-facing feature is unreachable. | `proxy.ts:6`, `:20-30` |
| F-08 | Critical | Business logic | No service-order transition matrix. Any status can move to any other; only membership in `statusValidos` is checked. | `app/actions/os.ts:707`, `:212-221`; `components/os/tabuleiro-kanban.tsx:195-265` |
| F-09 | Critical | Data / Migrations | Migration history cannot rebuild the schema: the baseline is a comment, and 22 of 28 models have no `CREATE TABLE` in `prisma/migrations/`. Full DDL lives only in a baseline file excluded from the deploy flow. | `prisma/migrations/20260621_baseline_producao/migration.sql`; `prisma/tenant-baseline/README.md` |
| F-10 | High | Data integrity | Actions write `String(usuario.id)` unguarded; when the central user has no mapped operational `Usuario`, the id is `""` and FK writes fail (OS deletion, warranty term, return closure). | `lib/tenant/exigir-contexto-tenant.ts:24`; `app/actions/os.ts:1421`; `app/actions/garantias.ts:663`, `:1359`, `:1533`; contrast `app/actions/metas.ts:176` |
| F-11 | High | Correctness | No timezone handling. 14 day-boundary computations use server-local time; on Vercel (UTC) São Paulo evening transactions fall on the wrong business day. | `app/api/cron/verificar-vencimentos/route.ts:48-58`; `app/actions/caixa.ts`; `app/actions/dashboard.ts` |
| F-12 | High | Data / Money | All transactional amounts are `Float` (`double precision`); integer-cent arithmetic exists only inside the POS module. | `prisma/schema.prisma` (`ContaReceber.valor`, `Venda.valorTotal`, `Produto.custo`, `ItemOS.*`); `lib/pdv/pagamentos.ts` |
| F-13 | High | Architecture | Pervasive Prisma delegate probing and `$queryRaw` fallbacks erase types and convert schema drift into silent wrong results. ~40 sites, 24 `as unknown as` casts. | `app/actions/os.ts:717-735`, `:786-800`, `:499-536`; `app/actions/configuracoes.ts:552-700`; `app/actions/pdv.ts:802-803`; `lib/auditoria.ts:41`; `app/api/cron/verificar-vencimentos/route.ts:41-46` |
| F-14 | High | Data | No global soft-delete filter; every query must remember `excluidaEm: null` by hand. `/os/[id]` fetches deleted orders then filters in render. | `app/(dashboard)/os/[id]/page.tsx:121`, `:217`; `app/actions/auditoria.ts:159` |
| F-15 | High | Security | Customer device unlock codes and Android pattern locks stored in plaintext. | `prisma/schema.prisma` `OrdemServico.senha`, `senhaDesenho`; `lib/auditoria.ts:12` (redacted in logs only) |
| F-16 | High | Security | No password-change, reset or forgot-password flow; rotation requires running a script against the central database. Inconsistent bcrypt cost (10 vs 12). | `app/actions/auth.ts:39`; `scripts/provisionar-tenant-cunhado.mjs:175` (12) vs `scripts/criar-admin-cunhado.mjs:147` (10) |
| F-17 | High | Security | No rate limiting, lockout or authentication audit trail on login. | `app/actions/auth.ts:25-105`; `LogAuditoria` has no auth entries |
| F-18 | High | Correctness | The due-date cron reads `Conta`, a model no UI writes to; receivables live in `ContaReceber` and payables in `ParcelaDespesa`. The job notifies on an empty table. | `app/api/cron/verificar-vencimentos/route.ts:41`, `:60`; `prisma/schema.prisma` `model Conta` |
| F-19 | High | Reliability | `setImmediate` fire-and-forget work scheduled inside a transaction in a serverless handler; may never run, or may run after rollback. | `app/actions/pdv.ts:921-945` |
| F-20 | High | Reliability | No `error.tsx`, `loading.tsx` or `not-found.tsx` anywhere. An expired session throws and renders Next's default error page instead of redirecting to login. | Zero such files under `app/`; `lib/auth/sessao-central.ts:175` |
| F-21 | High | Performance | `obterDadosDashboardOS` fetches all active + all archived orders with all items, unbounded, and serialises them to the client on every `/os` load. | `app/actions/os.ts:456-480` |
| F-22 | High | Performance | `obterSessaoCentral` costs 6 central-DB round-trips per request, including a write (`ultimoUsoEm`). | `lib/auth/sessao-central.ts:74-130` |
| F-23 | High | Lint / React 19 | 12 ESLint errors: 8 `react-hooks/set-state-in-effect`, 3 `react-hooks/refs`, 1 `no-empty-object-type`. The `refs` errors are `@hello-pangea/dnd` incompatibility. | `components/os/lista-coluna-kanban.tsx:40,72,73,79`; `components/pdv/modal-pagamento.tsx:331,349,359`; `components/dashboard/grafico-resultado.tsx:49`; `components/dashboard/grafico-saldo.tsx:37`; `components/layout/menu-mobile.tsx:64`; `components/configuracoes/preview-identidade-empresa.tsx:37`; `app/actions/pdv.ts:67` |
| F-24 | High | Generalization | Domain hard-coded to phone repair: `imei`, `senhaDesenho`, `TipoPeca.TAMPA_IPHONE`/`TAMPA_ANDROID`, and a fixed BRL markup table per phone part. | `prisma/schema.prisma` (`OrdemServico`, `enum TipoPeca`); `lib/utils/precificacao.ts:20-35`; `components/os/README.md:40-45` |
| F-25 | High | Generalization | No equipment-type/segment model, no structured checklist, no serial field other than IMEI, one device per order, no technician assignment. | `prisma/schema.prisma` (`OrdemServico`, `ItemOS`); `RoleUsuario.TECNICO` unused |
| F-26 | High | Testing / CI | Zero tests and zero CI. Nothing gates `tsc` or `eslint` before merge. | No test files, no runner, no `.github/` |
| F-27 | High | DevOps | `prisma migrate deploy` runs inside the build step, so migrations execute on every deploy with no approval gate, and concurrent builds race for the advisory lock. | `package.json` `build`; `scripts/migrate-deploy-com-retry.mjs:28-36`; `README.md` |
| F-28 | Medium | Data | Two parallel user models (`UsuarioCentral` central, `Usuario` tenant) linked only by case-insensitive e-mail; two disjoint role vocabularies; `Usuario.senha` is dead. | `lib/tenant/exigir-contexto-tenant.ts:18-65`; `prisma/schema.prisma` `model Usuario`; `prisma/central/schema.prisma` `RoleEmpresa` |
| F-29 | Medium | Data | `SessaoCentral` has no foreign keys to `UsuarioCentral`/`Empresa`/`Tenant`; expired and revoked rows are never purged. | `prisma/central/schema.prisma` `model SessaoCentral` |
| F-30 | Medium | Data | Missing indexes on high-frequency filters: `OrdemServico.status`/`clienteId`, `ItemOS.osId`, `ContaReceber.status`/`dataVencimento`/`ordemServicoId`/`clienteId`, `ParcelaDespesa.*`, `Produto.ativo`, `Venda.criadoEm`, `CaixaSession.status`, `Notificacao.lida`, `Cliente.*`. | `prisma/schema.prisma`; filters at `app/actions/dashboard.ts:1158-1176`, `app/actions/financeiro-receber.ts:386-450` |
| F-31 | Medium | Data | `Configuracao` is a 69-column singleton with no unique constraint or guard; a second row silently shadows the first. | `prisma/schema.prisma` `model Configuracao`; `app/actions/os.ts:243`; `app/actions/configuracoes.ts:1273` |
| F-32 | Medium | Business logic | No stock-movement ledger and no cash-movement ledger. Stock quantity is mutated in place; cash is derived only from `CaixaSession` + attached sales. No sangria/suprimento is representable. | `prisma/schema.prisma` (`Produto`, `CaixaSession`); `app/actions/pdv.ts:896-920`; `app/actions/caixa.ts:68-310` |
| F-33 | Medium | Business logic | `Configuracao.permitirVendaSemEstoque` is stored, validated and shown in settings but never consulted in the sale path. | `app/actions/configuracoes.ts:253`; `app/actions/pdv.ts:896-920` |
| F-34 | Medium | Business logic | `aprovarPedido` writes `origem: "AVULSO"` for sales-order receivables, so revenue cannot be attributed to sales orders. | `app/actions/vendas.ts:249`, `:274` |
| F-35 | Medium | Business logic | `finalizarRetornoGarantiaOS` hard-codes `formaRecebimento: "PIX"` and `dataVencimento: new Date()` for warranty surcharges. | `app/actions/garantias.ts:1546-1560` |
| F-36 | Medium | Validation | 16 of 23 action modules have no schema validation; `pdv`, `os`, `garantias`, `metas` and all financial modules hand-roll checks. | §6.1 zod token counts |
| F-37 | Medium | Error handling | Error-message string matching used as control flow in at least five places. | `app/actions/garantias.ts:1601-1618`; `app/actions/os.ts:326-329`, `:1464`; `app/actions/vendas.ts:297` |
| F-38 | Medium | Security | Raw server error messages returned to the client, leaking Prisma internals. | `app/actions/os.ts:874`; `app/actions/vendas.ts:308` |
| F-39 | Medium | Security | Proxy skips the session check for any path containing a dot. | `proxy.ts:16-18` |
| F-40 | Medium | Security | Proxy only checks cookie presence, never validity; an arbitrary cookie reaches the page, which then throws (see F-20). | `proxy.ts:11-13`, `:23` |
| F-41 | Medium | Security | Product cost and OS part cost are shipped to the browser with no role gate. | `app/actions/estoque.ts:63-71`; `app/actions/os.ts:97-103`, `:437` |
| F-42 | Medium | Observability | `LogAuditoria` omits the highest-value events: sales, cash open/close, CRM and stock changes, and all authentication. No structured logging or APM; failures swallowed in `catch {}`. | Audit writers limited to os, os-itens, garantias, metas, financeiro-receber, financeiro-pagar, configuracoes; `catch {}` at `lib/tenant/exigir-contexto-tenant.ts:62`, `app/actions/os.ts:299`, `:851`, `app/actions/pdv.ts:943` |
| F-43 | Medium | Performance | No caching strategy: no `revalidateTag`, no `unstable_cache`, no `cache()`, no `fetch` revalidation. Every page re-runs every query. | Repo-wide grep |
| F-44 | Medium | Performance | Unbounded list actions coexist with paginated ones: `listarProdutos`, `listarClientes`, `listarClientesPDV`, `listarContasReceber`, `listarParcelasPagar`. | `app/actions/estoque.ts:63`; `app/actions/crm.ts:419`; `app/actions/pdv.ts:728`; `app/actions/financeiro-receber.ts:59`; `app/actions/financeiro-pagar.ts:269` |
| F-45 | Medium | Performance | No `next/image`; logos and photos stored as data URLs in the database, re-fetched on every settings read (hence the 5 MB Server Action limit). | `next.config.ts:5`; §8.7 `<img>` sites |
| F-46 | Medium | Architecture | `/metas` and `/os/garantias` are static shells whose client children fetch on mount, discarding SSR entirely. | `app/(dashboard)/metas/page.tsx`; `app/(dashboard)/os/garantias/page.tsx`; `components/metas/pagina-metas.tsx:46-60`; `components/os/garantias/pagina-garantias-os.tsx:37-70` |
| F-47 | Medium | Code quality | Currency formatting duplicated in 32 files under four different names, while a shared implementation already exists. | §8.2; `components/ui/pagina/formatacao.ts:1`; `lib/formatadores.ts:8` |
| F-48 | Medium | Code quality | `TipoPeca` declared in 7 places and `StatusOS` presentation in 4, with two conflicting colour schemes. | §9.3-B, §9.3-C |
| F-49 | Medium | Code quality | 20 files over 300 lines with mixed responsibilities; `dashboard.ts` is 2 191 lines and `obterDashboardExecutivo` alone is 1 138. | §9.4 |
| F-50 | Medium | UX | `/vendas` hub: 5 of 8 cards link to `href: "#"`. | `app/(dashboard)/vendas/page.tsx:44,64,72,84,98` |
| F-51 | Medium | UX | Settings has a `painel-usuarios` but no user-management action exists; users are created only by CLI script. | `components/configuracoes/painel-usuarios.tsx`; no create/invite/role action in `app/actions/` |
| F-52 | Medium | Docs | `ARQUITETURA.md` describes a `src/`-rooted, mock-data, three-page frontend that no longer exists and omits multi-tenancy entirely. | §13.1 |
| F-53 | Medium | Docs | `QUICKSTART.md` documents `/auth/entrar`, fake login and a password-change screen — none of which exist. | §13.2 |
| F-54 | Medium | Docs | `prisma/schema.prisma` instructs `npx prisma db push` in four comments, contradicting the migration-based pipeline. | `prisma/schema.prisma` (after `TipoPapel`, `FormaPagamento`, `Despesa`, `NotaFiscal`) |
| F-55 | Medium | Design | Three incompatible visual languages; the slate/glassmorphism pages ignore the theme tokens entirely. | `app/(dashboard)/vendas/page.tsx:114-165`; `app/(dashboard)/crm/page.tsx`; vs `app/globals.css` |
| F-56 | Medium | Multi-tenancy | Tenant onboarding requires an environment-variable deploy; `Tenant.versaoSchema` is never read or written by the app. | `lib/tenant/resolver-conexao-tenant.ts:23`; `prisma/central/schema.prisma` `Tenant.versaoSchema` |
| F-57 | Medium | Multi-tenancy | Tenant Prisma client cache is unbounded — one client + pool per tenant, never evicted or disconnected. | `lib/tenant/cache-prisma-tenant.ts:39-61` |
| F-58 | Medium | Multi-tenancy | Login rejects any user with ≠1 active company or any company with ≠1 active tenant, making the central `Empresa 1—N Tenant` relation unusable; failure is indistinguishable from bad credentials. | `app/actions/auth.ts:70`, `:87` |
| F-59 | Low | Dead code | Unused dependencies shipped: `axios`, `@tanstack/react-query`, `next-themes`, `tailwindcss-animate`, and `shadcn` (a CLI in `dependencies`). | `package.json`; zero import sites |
| F-60 | Low | Dead code | `app/actions/financeiro.ts`, `components/os/index.ts`, `components/os/coluna-kanban.tsx`, `types/indice.ts`, `enum TipoCliente`, `Usuario.senha`, `TermoGarantiaOS.canceladaEm`, `tailwind.config.ts`, `public/*.svg`. | §9.2 |
| F-61 | Low | Repo hygiene | Three `_tmp-*` one-off scripts committed to `scripts/`. | `scripts/_tmp-conferir-financeiro.mjs`; `scripts/_tmp-criar-teste-principal.mjs`; `scripts/_tmp-limpar-legado-seed.mjs` |
| F-62 | Low | Config | `components.json` references `src/app/globals.css`, a path that does not exist; `tailwind.config` is `""`. | `components.json` |
| F-63 | Low | Config | `tailwind.config.ts` is inert under the Tailwind v4 CSS-first pipeline. | `tailwind.config.ts`; `postcss.config.mjs`; `app/globals.css:1` |
| F-64 | Low | Config | `.gitignore` excludes `/lib/generated/prisma`, a path that no longer exists. | `.gitignore` |
| F-65 | Low | Correctness | `revalidatePath("/dashboard")` targets a non-existent route. | `app/actions/os.ts:858` |
| F-66 | Low | Naming | Portuguese/English mix and casing inconsistency across modules, files and identifiers, against the project's own stated convention. | §9.5 |
| F-67 | Low | Naming | `dados/mock-os.ts` holds production status maps, not mock data. | `dados/mock-os.ts:1-26` |
| F-68 | Low | A11y | 5 raw `<img>` elements and 1 missing `alt`. | `app/(dashboard)/estoque/page.tsx:333`; `app/(dashboard)/pdv/page.tsx:628`; `app/(printer)/recibo/[id]/page.tsx:256`; `components/configuracoes/preview-identidade-empresa.tsx:58`; `components/os/garantias/termo-garantia-documento.tsx:41`; `components/pdf/PropostaPDF.tsx:404` |
| F-69 | Low | Tooling | No Prettier, `.editorconfig` or formatting script; formatting is unenforced and visibly inconsistent. | Repo root; e.g. `app/actions/os.ts:833-840` |
| F-70 | Low | Type safety | Seven `zodResolver(...) as unknown as Resolver<T>` double casts working around a zod-4/RHF-7 incompatibility. | `components/crm/funil-vendas-kanban.tsx:360`; `components/crm/modal-novo-cliente.tsx:89`; `components/estoque/modal-novo-produto.tsx:71`; `components/financeiro/modal-novo-recebimento.tsx:59`; `components/financeiro/modal-registro-cobranca.tsx:65`; `components/os/modal-nova-os.tsx:84`; `components/os/ordem-servico-form.tsx:106` |
| F-71 | Low | Dependencies | `lucide-react` is 30 minor versions behind (1.17.0 → 1.47.0); Next/React/Prisma each one minor behind; `@types/node` pinned to v20 on Node 24. | `npm outdated` |
| F-72 | Low | Business logic | `PropostaComercial.cliente` is free text, not a `Cliente` relation — proposals cannot be joined to CRM. | `prisma/schema.prisma` `model PropostaComercial` |
| F-73 | Low | Business logic | `Notificacao` has no user scope; all notifications are tenant-global. | `prisma/schema.prisma` `model Notificacao` |
| F-74 | Low | UX | Hand-rolled theme provider with no pre-hydration script; dark-mode users get a light flash masked by `suppressHydrationWarning`. | `components/provedores/provedor-tema.tsx:36-66`; `app/layout.tsx:27` |
| F-75 | Low | UX | No CPF/CNPJ check-digit validation; masks are re-implemented per component with no shared module. | `lib/validations/crm.ts`; `components/crm/modal-novo-cliente.tsx`; `components/configuracoes/painel-empresa.tsx` |
| F-76 | Low | Ops | Tenant provisioning scripts are named after a specific person (`cunhado`) rather than a role. | `scripts/provisionar-tenant-cunhado.mjs`; `scripts/criar-admin-cunhado.mjs`; `package.json` `tenant:cunhado:*` |
| F-77 | Low | Ops | No backup, restore or tenant-export runbook for an N-database topology requiring point-in-time consistency with the central registry. | Repository-wide absence |

---

## 15. Open Questions

These require a product or business decision before the refactor can be scoped.

1. **Role semantics.** Two role vocabularies exist (`ADMIN/GESTOR/USUARIO` central, `ADMIN/OPERADOR/TECNICO` tenant) and neither is enforced. Which is authoritative? What is the intended permission matrix — specifically, who may delete a service order, give financial discharge, close the cash register, change prices and edit settings?

2. **Public order tracking.** `/rastreio/[id]` is designed as a customer-facing link but is behind the login wall and pinned to one tenant. Is this feature still wanted? If so, it needs an opaque public token on `OrdemServico` (a migration) and a tenant-resolution strategy for unauthenticated requests — subdomain, path prefix, or token-embedded tenant id.

3. **Multi-company users.** Login rejects users with more than one active company (`auth.ts:70`). Is multi-company access a goal? If yes, a tenant-switcher and a post-login selection step are needed.

4. **Migration strategy.** How should schema changes reach existing tenant databases? Options: a per-tenant migration runner decoupled from the build, a versioned rollout tracked in `Tenant.versaoSchema`, or a rebase of `prisma/migrations` onto the baseline. This choice determines whether the delegate-probing code (F-13) can be deleted or must stay.

5. **Domain generalization scope.** What is the target breadth — notebooks, TVs, appliances, consoles? Should there be a per-segment configuration of intake fields, checklists, part types and pricing, or a generic "custom fields" mechanism? This decides whether `imei`/`senhaDesenho`/`TipoPeca` become a typed `TipoEquipamento` model or a JSON attribute bag, and whether existing tenant data must be migrated.

6. **Pricing model.** The hard-coded BRL markup table (`lib/utils/precificacao.ts`) cannot be adjusted per tenant, and the server has already stopped applying it (`app/actions/os.ts:6`) while the client still does. Should it become per-tenant configuration, per-segment configuration, or be removed entirely in favour of manual pricing?

7. **Fiscal integration.** `NotaFiscal` stores metadata only. Is real NF-e/NFS-e emission (SEFAZ, XML, certificates, contingency) planned? That is a major subsystem and changes the data model.

8. **Money representation.** Migrating `Float` → `Decimal` across ~25 columns is a breaking data migration. Is there an acceptable maintenance window, and what rounding policy applies to historical values?

9. **Cash and stock ledgers.** Are sangria/suprimento and stock-movement history required? Both need new models and back-fill decisions for existing data.

10. **Device credential storage.** `OrdemServico.senha` and `senhaDesenho` hold customer unlock codes in plaintext. Should they be encrypted at rest, made write-only-until-needed, or dropped in favour of a "customer unlocks at the counter" policy? This has LGPD implications.

11. **Financial deletion policy.** `excluirContaReceber` hard-deletes, and its own TODO proposes soft-delete. Which does the business need for its audit trail?

12. **Notification model.** Notifications are tenant-global and unread-tracked globally. Should they be per-user, per-role, or remain a shared feed?

13. **Audit scope.** `LogAuditoria` covers seven modules and no authentication events. Which operations must be auditable for the business — and is there a retention requirement?

14. **Tenant onboarding.** Adding a tenant currently requires a Vercel environment-variable deploy. Is self-service onboarding a goal? If so, connection strings must move into a secret store or an encrypted central column, which changes the security model in `lib/tenant/resolver-conexao-tenant.ts`.

15. **Documentation.** `ARQUITETURA.md`, `QUICKSTART.md`, `INTEGRACAO_BACKEND.md` and `RELATORIO_FINAL.md` describe a system that no longer exists. Should they be rewritten or deleted?

---

*End of report. 15 sections, 77 findings. Every claim above is backed by a file path and, where applicable, a line range; items that could not be confirmed read-only are marked `UNVERIFIED`.*

---

# PHASE 0 ADDENDUM — Incident investigation

*Added during Phase 0 (containment). Sections 16 and 17 are a **static** investigation: no database was accessed. Everything below is derived from the code and the migration files in this repository. Where a claim can only be settled against production data, it is marked as a question for `npm run db:diagnostico`.*

---

## 16. Incident & Module Investigation

### 16.1 Chronological review of migrations touching `OrdemServico` status / archive / finalization

Only **two** of the seven tenant migrations touch these columns or the `StatusOS` enum.

#### (1) `20260621_baseline_producao` — creates nothing

```sql
-- Baseline do banco de produção já existente.
-- Esta migration não altera o schema.
-- Ela apenas representa o estado inicial antes do uso formal do Prisma Migrate.
```

`OrdemServico` and `StatusOS` therefore have **no `CREATE TABLE` / `CREATE TYPE` anywhere in the migration history**. Everything below is an `ALTER` against a table Prisma Migrate never created and whose prior shape it cannot know. This is the structural reason the rest of this section exists.

#### (2) `20260621_garantias_auditoria_dashboard` — adds the warranty/soft-delete columns, but **not** `archivedAt`

```sql
-- AlterEnum
ALTER TYPE "StatusOS" ADD VALUE 'GARANTIA_RETORNO';

-- AlterTable
ALTER TABLE "OrdemServico" ADD COLUMN     "ehRetornoGarantia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "excluidaEm" TIMESTAMP(3),
ADD COLUMN     "excluidaPorId" TEXT,
ADD COLUMN     "motivoExclusao" TEXT,
ADD COLUMN     "osOrigemGarantiaId" TEXT,
ADD COLUMN     "prazoGarantiaDias" INTEGER,
ADD COLUMN     "retornoGarantiaId" TEXT,
ADD COLUMN     "statusAnterior" "StatusOS";
```
(`prisma/migrations/20260621_garantias_auditoria_dashboard/migration.sql:31-42`)

Then the constraints and indexes (`:257-293`), including:

```sql
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_excluidaPorId_fkey"
  FOREIGN KEY ("excluidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TermoGarantiaOS" ADD CONSTRAINT "TermoGarantiaOS_osId_fkey"
  FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Two fragilities in this file:**

- `ALTER TYPE "StatusOS" ADD VALUE 'GARANTIA_RETORNO'` has no `IF NOT EXISTS`. Re-running the migration against a database that already has the value fails outright. More importantly, PostgreSQL restricts `ALTER TYPE … ADD VALUE` inside a transaction block, and Prisma Migrate wraps each migration in one. The new value is not consumed later in the same file, so on PostgreSQL 12+ this normally succeeds — but this is exactly the statement that aborts a migration mid-file on older servers, and this migration adds **eight columns after it**. If it aborted here, every column below it is missing while the migration may still be recorded. **The `_prisma_migrations` rows collected by item 1 of `db:diagnostico` settle this; until then it is `UNVERIFIED`.**
- `archivedAt` is **not** in this migration. At this point in history the column does not exist.

#### (3) `20260621235500_corrigir_schema_ordem_servico_garantias` — the repair migration that introduces `archivedAt`

```sql
-- Corrige divergencias de schema da tabela OrdemServico sem operacoes destrutivas.
-- Foco: campos usados nas features de garantia/retorno e exclusao logica.

ALTER TABLE "OrdemServico"
  ADD COLUMN IF NOT EXISTS "ehRetornoGarantia" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "osOrigemGarantiaId" TEXT,
  ADD COLUMN IF NOT EXISTS "retornoGarantiaId" TEXT,
  ADD COLUMN IF NOT EXISTS "excluidaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "excluidaPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoExclusao" TEXT,
  ADD COLUMN IF NOT EXISTS "statusAnterior" "StatusOS",
  ADD COLUMN IF NOT EXISTS "prazoGarantiaDias" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
```

followed by three idempotent FK blocks (`DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = …)`) and five `CREATE INDEX IF NOT EXISTS`.

**This migration re-adds the same eight columns as (2), plus `archivedAt`.** Its existence, its name (*"corrigir divergencias"*), and its defensive `IF NOT EXISTS` on every single statement are direct evidence that migration (2) did **not** land completely on at least one database. The application code was then written to survive the same condition at runtime (§16.2).

**Chronological conclusion.** `archivedAt` entered the schema *after* the warranty feature, through a repair migration, and only via `ADD COLUMN IF NOT EXISTS`. There is no `NOT NULL`, no default, no backfill and no index on it. Every service order that existed before this migration has `archivedAt IS NULL` regardless of its status — including every order already `ENTREGUE`. **That alone produces a population of delivered-but-un-archived orders, with no bug required.**

### 16.2 Every code path that writes or clears `archivedAt` and `status`

| # | Path | `status` | `archivedAt` | Audit? | Transaction? |
|---|---|---|---|---|---|
| 1 | `criarOrdemServico` (`app/actions/os.ts:545-688`) | sets `dados.status` (client-chosen, `os.ts:636`) | — | yes | yes |
| 2 | `atualizarStatusOrdemServico` (`os.ts:691-882`) | sets any member of `statusValidos` | **clears to `NULL` for every status except `ENTREGUE`** (`os.ts:799`) | yes | yes |
| 3 | `atualizarStatusOrdemServico` — raw-SQL fallback (`os.ts:806-813`) | sets status | **forces `archivedAt = NULL`** | yes | yes |
| 4 | `archiveDeliveredOrderService` (`os.ts:920-1106`) | — | sets `now()` only if currently null (`os.ts:1061-1069`) | yes | yes |
| 5 | `gerarGarantiaEFinalizarOS` (`os.ts:1108-1337`) | forces `"ENTREGUE"` | `ordemServico.archivedAt ?? new Date()` (`os.ts:1253`) | yes | yes |
| 6 | `excluirOrdemServico` (`os.ts:1337-1478`) | untouched (copied to `statusAnterior`) | sets `now()` (`os.ts:1423`) | yes | yes |
| 7 | `finalizarRetornoGarantiaOS` (`app/actions/garantias.ts:1537-1544`) | — | sets `now()` if the return OS is `ENTREGUE` and not yet archived | yes (on `RETORNO_GARANTIA_OS`) | yes |
| 8 | `garantirTermoGarantiaPorOS` (`garantias.ts:631-634`) | — | — (writes `prazoGarantiaDias`) | **no audit entry for `ORDEM_SERVICO`** | inherits caller's tx |

#### The `archivedAtUnsupported` branch

```ts
// app/actions/os.ts:326-329
function archivedAtUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.includes("archivedAt") || message.includes("Unknown argument") || message.includes("Invalid `ordemServico");
}
```

Three call sites: `obterDadosDashboardOS` (`os.ts:497`), `atualizarStatusOrdemServico` (`os.ts:803`) and `archiveDeliveredOrderService` (`os.ts:994`).

This predicate is **far too broad**. `message.includes("Unknown argument")` matches *any* Prisma validation error about *any* argument on *any* model, and `Invalid \`ordemServico` matches every validation failure on that delegate. A typo in an unrelated `select`, a stale generated client, or a genuinely malformed `where` all get silently reclassified as "this database is too old to have `archivedAt`" and are routed into a fallback that **behaves differently from the primary path**.

The behavioural difference matters most at `os.ts:803`:

```ts
} catch (error) {
  if (!archivedAtUnsupported(error) || status === "ENTREGUE") {
    throw error;
  }
  await tx.$executeRaw`
    UPDATE "OrdemServico"
    SET status = ${status}::"StatusOS", "archivedAt" = NULL, "atualizadoEm" = NOW()
    WHERE id = ${osId}
  `;
}
```

When the target status **is** `ENTREGUE`, the error is re-thrown — so a failure while delivering never reaches the fallback. When it is anything else, the raw fallback runs and **explicitly nulls `archivedAt`**, on a database the code has just concluded might not even have that column.

#### Which paths can leave a delivered OS un-archived

1. **Path 2/3 — the Kanban.** Dropping a card into any column other than `ENTREGUE` sets `archivedAt = NULL` unconditionally (`os.ts:799`). Moving `ENTREGUE → PRONTO` un-archives, and moving back `PRONTO → ENTREGUE` **does not re-archive** — `atualizarStatusOrdemServico` never sets `archivedAt`, it only clears it. The OS is now `ENTREGUE` with `archivedAt IS NULL`, invisible in the "Finalizadas" list and permanently parked in the Kanban's `ENTREGUE` column. **This is the mechanism behind finding (e), and it is the most likely root cause of the incident.**
2. **Legacy rows.** Every order delivered before `20260621235500` has `archivedAt IS NULL` (§16.1).
3. **Path 5 partial failure.** `gerarGarantiaEFinalizarOS` is transactional, so a failure rolls back both the term and the status — this path cannot produce the split. But see §16.3: it can fail *entirely* and leave the OS wherever it was.
4. **Path 7.** `finalizarRetornoGarantiaOS` archives the return OS only if it is already `ENTREGUE`; a return OS closed while in any other status keeps `archivedAt IS NULL` forever, and nothing re-visits it.

#### Most likely root cause

> A delivered OS becomes un-archived because `atualizarStatusOrdemServico` treats `archivedAt` as a derived flag of "not delivered" and clears it on **every** non-`ENTREGUE` transition (`os.ts:799`), while **no** status transition ever *sets* it. Only the two explicit finalization actions set `archivedAt`. Since the Kanban accepts every drop between every pair of columns (§16.5-d/e) and the UI's own "next" button walks through `ENTREGUE`, any accidental move out of and back into `ENTREGUE` permanently strips the archive flag with no way to restore it from the UI.

The pre-existing legacy population (cause 2) and this ongoing mechanism (cause 1) produce the same symptom, which is why the two must be separated by the audit-trail reconstruction in `db:diagnostico` item 6: rows whose last audited state already had `archivedAt` null and were never touched are legacy; rows with a recorded `ENTREGUE → other → ENTREGUE` sequence are the live bug.

### 16.3 Scenarios that make finalization fail for legacy rows

`archiveDeliveredOrderService` (requires the OS to already be `ENTREGUE`) and `gerarGarantiaEFinalizarOS` (accepts `PRONTO` or `ENTREGUE`) are the two finalization entry points. Both can fail on rows created before the warranty feature:

1. **Status gate mismatch between the two layers.** `gerarGarantiaEFinalizarOS` accepts `PRONTO` **or** `ENTREGUE` (`os.ts:1208`), but it delegates term creation to `garantirTermoGarantiaPorOS`, which throws when the status is anything other than `PRONTO`:
   ```ts
   // app/actions/garantias.ts:175-176, 503-505
   const STATUS_PERMITE_GARANTIA = "PRONTO";
   …
   if (String(os.status) !== STATUS_PERMITE_GARANTIA) {
     throw new Error(MENSAGEM_ERRO_STATUS_GARANTIA);
   }
   ```
   An OS that is already `ENTREGUE` and has **no** warranty term therefore **cannot be finalized by either path**: `archiveDeliveredOrderService` refuses with `MENSAGEM_FINALIZAR_SEM_GARANTIA` (`os.ts:1042-1048`), and `gerarGarantiaEFinalizarOS` throws. This is precisely the shape of a legacy delivered row. **It is a closed trap with no UI escape.**
2. **Empty operational user id breaking a foreign key.** `excluirOrdemServico` writes `excluidaPorId: String(usuario.id)` (`os.ts:1421`) with no normalisation. When the central user has no matching tenant `Usuario` row, `mapearUsuarioOperacional` returns `id: ""` (`lib/tenant/exigir-contexto-tenant.ts:23-28`), and `OrdemServico_excluidaPorId_fkey` rejects the empty string, failing the whole transaction. *Correction to §6.3 of the original audit:* `garantirTermoGarantiaPorOS` is **not** affected — it normalises with `input.criadoPorId ? String(input.criadoPorId) : null` (`garantias.ts:626` (guard)), so the empty string becomes `NULL`. `finalizarRetornoGarantiaOS` **is** affected but does not crash: `finalizadoPorId: String(usuario.id)` (`garantias.ts:1533`) has no FK in the schema, so `""` is written and silently corrupts the attribution. Only `metas.ts:176` normalises correctly.
3. **Missing items.** `!ehRetornoGarantia && _count.itens === 0` → `MENSAGEM_FINALIZAR_SEM_ITENS` in both paths (`os.ts:1183-1188`, `os.ts:1036-1041`). Independently, `exigirItemParaGarantia` throws `MENSAGEM_ERRO_GARANTIA_SEM_ITENS` inside term creation (`garantias.ts:571-573`).
4. **Configuration gates.** `exigirDiagnosticoParaFinalizar` requires non-empty `observacoes` (`os.ts:1189`); `permitirFinalizarSemPagamento = false` requires a `ContaReceber` in `PAGO`/`RECEBIDO` (`os.ts:1196-1203`). Legacy orders predating these fields typically satisfy neither.
5. **Three different warranty-period ranges.** The client modal accepts 1–365 (`components/os/modal-finalizar-os.tsx:34`), the server action accepts 1–3650 (`os.ts:1125`), and `validarPrazoGarantiaConfigurado` clamps to `prazoMinimoGarantiaDias`/`prazoMaximoGarantiaDias` from `Configuracao`. A value accepted by the modal can still be rejected server-side.
6. **Drifted database.** If `archivedAt` is genuinely absent, `archiveDeliveredOrderService`'s read falls back to raw SQL (`os.ts:994-1010`) but its **write** does not — `txOrderServiceDelegate.update({ data: { archivedAt: new Date() } })` (`os.ts:1063-1069`) has no fallback and throws.

### 16.4 Goals (`metas`) — the 12 automatic metrics

Shared period resolution (`app/actions/metas.ts:286-295`): `inicio = configuracaoAutomatica.dataInicio ?? meta.dataInicio`, `fim = configuracaoAutomatica.dataFim ?? meta.dataPrazo`. **If both are absent the metric is computed over all time** — `montarFiltroData` returns `undefined` and the filter is simply omitted (`metas.ts:278-284`).

Receivable date window (`metas.ts:531-543`): `OR [ dataRecebimento ∈ [inicio,fim] , (dataRecebimento IS NULL AND dataVencimento ∈ [inicio,fim]) ]`.

**Timezone: none.** No metric applies any zone. `parseDataIso` builds a `Date` from the stored ISO string and the boundaries are used verbatim; `meta.dataPrazo` is a date at 00:00, so a goal ending "today" excludes everything that happened today. This compounds the system-wide timezone gap (F-11).

| # | Metric | Table & filter | Date field | Soft-delete filter | Notes / inconsistency |
|---|---|---|---|---|---|
| 1 | `FATURAMENTO_OS` | `ContaReceber` `origem=ORDEM_SERVICO`, `ordemServicoId≠null`, `status ∈ (RECEBIDO,PAGO)`, `_sum(valor)` (`:557-577`) | `dataRecebimento` ⟶ `dataVencimento` | **none on the OS** | See A, B, C below |
| 2 | `QUANTIDADE_OS_FINALIZADAS` | `OrdemServico` `count`, `status ∈ config.statusOS ?? (PRONTO,ENTREGUE)` (`:579-590`) | `atualizadoEm` | `excluidaEm: null` ✔ | Counts by **last update**, so any Kanban drag re-dates the order into the current period. A card dragged today counts as "finished today" even if delivered months ago. |
| 3 | `QUANTIDADE_OS_CRIADAS` | `OrdemServico` `count` (`:592-606`) | `criadoEm` | `excluidaEm: null` ✔ | Consistent. |
| 4 | `TICKET_MEDIO_OS` | same `where` as #1, `_avg(valor)` (`:608-627`) | idem | none | Averages **receivable rows**, not orders: an OS split into 3 instalments counts as 3 samples, lowering the average. |
| 5 | `RETORNOS_GARANTIA` | `RetornoGarantiaOS` `count` (`:629-635`) | `criadoEm` | n/a | Counts opened returns, including `EM_ANALISE` and improcedentes. |
| 6 | `GARANTIAS_ATIVAS` | `TermoGarantiaOS` `count`, `canceladaEm: null`, `dataFimGarantia >= now()` (`:637-646`) | — | does not join `OrdemServico` | **Ignores the period entirely** — always "as of now". Counts terms of soft-deleted orders, since `excluidaEm` is not joined. `canceladaEm` is never written by any action (F-60), so that filter is inert. |
| 7 | `TAXA_RETORNO_GARANTIA` | `count(RetornoGarantiaOS)/count(TermoGarantiaOS)*100`, both by `criadoEm` in period (`:648-673`) | `criadoEm` | none | Numerator and denominator are **different cohorts**: returns created in the window are divided by terms created in the same window, but a return almost always belongs to a term issued in an *earlier* window. The ratio is not a return rate. |
| 8 | `RECEBIMENTOS_FINANCEIRO` | `ContaReceber` `status ∈ (RECEBIDO,PAGO)`, optional `origem ∈ config.origensReceita`, `_sum(valor)` (`:675-690`) | idem #1 | none | Overlaps #1 and #10 — a PDV sale can be counted by all three. |
| 9 | `DESPESAS_FINANCEIRO` | `ParcelaDespesa` `status=PAGO`, `_sum(valorPago)` (`:692-706`) | `dataPagamento` | n/a | Consistent, but `valorPago` is nullable; rows paid without the field sum as 0. |
| 10 | `FATURAMENTO_PDV` | `ContaReceber` `origem=VENDA_PDV`, `status ∈ (RECEBIDO,PAGO)`, `_sum(valor)` (`:708-721`) | idem #1 | n/a | **Structurally under-counts.** `processarVenda` only creates a `ContaReceber` for *deferred* payment methods (`app/actions/pdv.ts:957-985`). Cash, PIX and debit sales produce a `Venda` and **no** `ContaReceber`, so they are invisible to this metric. The dashboard, by contrast, sums `Venda.valorTotal`. |
| 11 | `QUANTIDADE_VENDAS` | `Venda` `count` (`:723-730`) | `criadoEm` | n/a | Consistent. Counts the `PedidoVenda` mirror separately from the `Venda`, so PDV sales are not double-counted here — but are in `/vendas/historico`. |
| 12 | `QUANTIDADE_ITEM_ESTOQUE` | `Produto.quantidadeEstoque` for `config.produtoId`, `ativo: true` (`:732-748`) | — | n/a | Ignores the period (a point-in-time reading). Returns `sucesso: false` if the product was deactivated, which writes `erroSincronizacao` rather than 0. |

#### Inconsistencies against the source modules

The dashboard's revenue definition lives in `lib/dashboard/regras-financeiras.ts` (`obterReceitaTotalPadrao`, `:150-205`):

```sql
SELECT v."valorTotal" FROM "Venda" v …            -- every sale, by criadoEm
UNION ALL
SELECT cr.valor FROM "ContaReceber" cr
 WHERE cr.status::text = 'RECEBIDO'               -- RECEBIDO only
   AND cr."vendaId" IS NULL                       -- never double-count a sale
   AND COALESCE(cr."dataRecebimento", cr."criadoEm") BETWEEN … 
   AND (os.id IS NULL OR os."excluidaEm" IS NULL) -- excludes deleted OS
   AND (os.id IS NULL OR os."ehRetornoGarantia" = false
        OR COALESCE(rg."houveCobranca", false) = true
        OR COALESCE(rg."valorAdicional", 0) > 0)  -- excludes free warranty work
```

Against metric #1 (`FATURAMENTO_OS`), four divergences:

- **A. Status set.** Dashboard counts `RECEBIDO` only; metas counts `RECEBIDO` **and** `PAGO`. `StatusPagamento` has both and the codebase uses them interchangeably, so the goal is systematically higher.
- **B. Date fallback.** Dashboard falls back to `criadoEm`; metas falls back to `dataVencimento`. An unpaid-but-due receivable enters the goal's window and never enters the dashboard's.
- **C. Soft-deleted orders.** Dashboard excludes them explicitly; **no metas metric joins `OrdemServico` to check `excluidaEm`**. Revenue from deleted orders still counts toward every financial goal.
- **D. Warranty rework.** Dashboard excludes revenue from warranty-return orders that had no extra charge; metas has no equivalent rule.

Metric #10 vs the same dashboard query is the largest gap: the dashboard sums `Venda.valorTotal` for **all** sales, the goal sums only `ContaReceber` rows that exist solely for deferred payments. In a shop where most PDV sales are cash/PIX/debit, a PDV revenue goal will read near zero while the dashboard shows the real figure.

Metric #2 vs `dashboard.ts:1177` (`status: "ENTREGUE"`) and vs `caixa.ts:449` (`status: "ENTREGUE", excluidaEm: null, atualizadoEm BETWEEN …`): the goal's default cohort is `PRONTO` **or** `ENTREGUE`, so "orders finished" in a goal is a different number from "orders delivered" everywhere else.

### 16.5 Proposals — why an existing proposal cannot be edited

There is no edit path, at any layer:

- **No action.** `app/actions/propostas.ts` exports exactly three functions — `listarClientesProposta` (`:30`), `listarProdutosProposta` (`:55`), `createProposta` (`:92`). There is no `atualizarProposta`, no `excluirProposta` and no status-transition action anywhere in the codebase.
- **No route.** The only proposal routes are `/crm/propostas` (list), `/crm/propostas/nova` (create wizard), `/crm/propostas/[id]` (read-only detail) and `/propostas/[id]/imprimir`. There is no `[id]/editar`.
- **No UI affordance.** `components/crm/proposal-actions-cell.tsx` renders a single `<Link href={/crm/propostas/${proposalId}}>` (`:46`) — view only. The detail page imports no action and renders no form (`app/(dashboard)/crm/propostas/[id]/page.tsx`).
- **No status lock is involved.** `StatusPropostaComercial {RASCUNHO, ENVIADA, APROVADA, REJEITADA}` exists and `createProposta` writes the status chosen at creation (`propostas.ts:94`, `:149`, with a `RASCUNHO`-specific branch at `:175`). Nothing ever transitions it afterwards. A proposal saved as `RASCUNHO` stays a draft forever; one saved as `ENVIADA` can never be marked approved or rejected.

**Answer: the feature was never built.** It is not a lock and not a bug — create-and-print is the whole implemented lifecycle. Related structural gap: `PropostaComercial.cliente` is a free-text `String`, not a relation to `Cliente`, so even a future edit screen cannot resolve the customer.

### 16.6 Settings — every field of `Configuracao`

60 fields excluding `id`. All 60 are persisted by `salvarConfiguracoes` (`app/actions/configuracoes.ts:926`) behind a zod schema, and all are surfaced by the settings panels. The column below that matters is **whether anything outside the settings screen reads the value**.

| Field | Saved | Read at | Verdict |
|---|---|---|---|
| `razaoSocial` | ✔ | `app/(printer)/propostas/[id]/imprimir/page.tsx:50`; warranty term `garantias.ts:596` | working |
| `nomeFantasia` | ✔ | `app/(dashboard)/page.tsx:62`; `garantias.ts:596` | working |
| `cnpj` | ✔ | `(printer)/propostas/[id]/imprimir/page.tsx:51`; `garantias.ts:597` | working |
| `inscricaoEstadual` | ✔ | `(printer)/propostas/[id]/imprimir/page.tsx:52` | working |
| `telefone` | ✔ | `(printer)/propostas/[id]/imprimir/page.tsx:57`; `garantias.ts:598` | working |
| **`cep`** | ✔ | **nowhere** | **saved-but-unused** |
| `logradouro`, `numero`, `bairro` | ✔ | `(printer)/propostas/[id]/imprimir/page.tsx:38`; `garantias.ts:599-603` | working |
| `cidade`, `estado` | ✔ | `(printer)/propostas/[id]/imprimir/page.tsx:43`; `garantias.ts:599-603` | working |
| `endereco` (free-text duplicate of the block above) | ✔ | `(printer)/propostas/[id]/imprimir/page.tsx:55` | working, but duplicates the structured address — two sources of truth |
| `logoUrl` | ✔ | `app/(dashboard)/perfil/page.tsx:41`; print templates | working |
| **`chavePix`** | ✔ | **nowhere** | **saved-but-unused** — labelled "Chave PIX Padrão" and never printed on any receipt or warranty term |
| `mensagemCupom` | ✔ | `(printer)/recibo/[id]/page.tsx:334` | working |
| `modeloImpressaoOSPadrao` | ✔ | `app/(dashboard)/os/[id]/page.tsx:285`; `lib/impressao/resolver-modelo-impressao.ts` | working |
| `imprimirLogoTermica` | ✔ | `lib/impressao/obter-dados-impressao-os.ts:193` | working |
| `mensagemRodapeImpressaoOS` | ✔ | `lib/impressao/obter-dados-impressao-os.ts:194` | working |
| **`habilitarMargemAutomatica`** | ✔ | **nowhere** | **saved-but-unused** — the automatic markup it claims to toggle is applied unconditionally client-side by `hooks/useCalculadoraPrecosOS.ts` → `lib/utils/precificacao.ts`; the flag is never consulted |
| **`permitirVendaSemEstoque`** | ✔ | **nowhere** | **broken** — `processarVenda` always enforces `quantidadeEstoque >= quantidade` and throws otherwise (`app/actions/pdv.ts:896-920`), so enabling the option has no effect (F-33) |
| `permitirPagamentoMisto` | ✔ | `app/actions/pdv.ts:140` | working |
| `permitirDescontoPDV` | ✔ | `app/(dashboard)/pdv/page.tsx:998` | **client-only** — disables the input, never re-checked on the server |
| `descontoMaximoPDVPercentual` | ✔ | `app/(dashboard)/pdv/page.tsx:1002` | **client-only** — same; a tampered Server Action payload bypasses the cap (F-04) |
| `permitirVendaFiado` | ✔ | `app/actions/pdv.ts:160` | working (server-enforced) |
| `habilitarPix` / `habilitarDinheiro` / `habilitarCartaoDebito` / `habilitarCartaoCredito` / `habilitarBoleto` / `habilitarCrediario` | ✔ | `app/actions/pdv.ts:106-130` | working |
| `taxaCartaoDebitoPercentual`, `taxaCartaoCredito1x…12xPercentual` (13 fields) | ✔ | `app/actions/pdv.ts:76-89` | working |
| `maxParcelasCartaoCredito` | ✔ | `app/actions/pdv.ts:91` | working |
| `prazoPadraoBoletoDias` | ✔ | `app/actions/pdv.ts:92` | working |
| `prazoPadraoCrediarioDias` | ✔ | `app/actions/pdv.ts:93` | working |
| `prazoGarantiaPadraoDias` | ✔ | `app/actions/garantias.ts:380` | working |
| `prazoMinimoGarantiaDias` / `prazoMaximoGarantiaDias` | ✔ | `garantias.ts:384-388` | working server-side, but the client modal hard-codes 1–365 (`modal-finalizar-os.tsx:34`) and the action hard-codes 1–3650 (`os.ts:1125`) — three ranges (§16.3-5) |
| `exigirGarantiaAntesEntrega` | ✔ | `app/actions/os.ts:293`, enforced at `os.ts:769-776` | **partial** — enforced only in `atualizarStatusOrdemServico`; `gerarGarantiaEFinalizarOS` never consults it |
| `exigirItemParaGarantia` | ✔ | `garantias.ts:392`, enforced at `garantias.ts:571` | working |
| `exigirItemParaEnviarPDV` | ✔ | `app/actions/os.ts:1631` | working |
| `exigirDiagnosticoParaFinalizar` | ✔ | `os.ts:297`, enforced at `os.ts:779` and `os.ts:1189` | working |
| `permitirFinalizarSemPagamento` | ✔ | `os.ts:301`, enforced at `os.ts:782` and `os.ts:1196` | working |
| `permitirGarantiaPersonalizada` | ✔ | `garantias.ts:396` | working |
| `textoCoberturaGarantia` / `textoExclusoesGarantia` / `textoResponsabilidadeDados` | ✔ | `garantias.ts:399-402`, composed into `textoGarantia` | working — **but the text is frozen into `TermoGarantiaOS.textoGarantia` at creation**, so editing these never updates already-issued terms |

**Summary: 4 dead settings** (`cep`, `chavePix`, `habilitarMargemAutomatica`, `permitirVendaSemEstoque`) and **3 client-only settings** (`permitirDescontoPDV`, `descontoMaximoPDVPercentual`, and the warranty range as presented by the modal) that the UI presents as enforced rules.

### 16.7 Findings from the manual production check

#### (a) The warranty term is created when the OS enters `PRONTO`, not at delivery

**Exact path.** `components/os/garantias/acao-garantia-os.tsx:68`:

```ts
const podeGerarGarantia = statusOS === STATUS_PERMITE_GARANTIA && !possuiTermoGarantia && possuiItens;
```
with `const STATUS_PERMITE_GARANTIA = "PRONTO"` (`:28`). The component is rendered from `app/(dashboard)/os/[id]/page.tsx:286` and `app/(printer)/os/[id]/garantia/page.tsx:37`. Clicking it calls `gerarTermoGarantiaOS` (`app/actions/garantias.ts:646`), which calls `garantirTermoGarantiaPorOS`, which enforces the same rule server-side (`garantias.ts:503-505`).

So the button exists **only** while the OS sits in `PRONTO`, and the server refuses the operation in any other status. Delivery (`ENTREGUE`) is the one status in which a missing term can no longer be created.

**Two consequences, both worse than the trigger itself:**

1. **The warranty clock starts at the wrong moment.**
   ```ts
   // app/actions/garantias.ts:577-578
   const dataInicioGarantia = new Date(os.atualizadoEm);
   const dataFimGarantia = adicionarDias(dataInicioGarantia, prazoGarantiaDias);
   ```
   The start date is the order's **last-modified timestamp**, not the delivery date and not even the term-creation date. Every Kanban drag rewrites `atualizadoEm`, so the warranty of a device the customer has not yet collected starts on the day of the last drag. If the device is collected a week later, the customer loses a week of coverage. When the term is created inside `gerarGarantiaEFinalizarOS`, `atualizadoEm` is still the pre-finalization value, so the start date precedes the delivery recorded in the same transaction.
2. **Delivered orders without a term are unrecoverable** — the trap in §16.3-1.

#### (b) `atualizadoEm` later than the last `LogAuditoria` entry — writes with no audit trail

Every path that touches `OrdemServico` (or its `TermoGarantiaOS` / `ItemOS`) **without** writing a `LogAuditoria` row for `entidade = 'ORDEM_SERVICO'`:

| # | Path | What it writes | Audit written |
|---|---|---|---|
| 1 | `garantirTermoGarantiaPorOS` (`garantias.ts:631-634`) | `UPDATE "OrdemServico" SET "prazoGarantiaDias" = …` | **none for `ORDEM_SERVICO`** — callers log `entidade: TERMO_GARANTIA_OS` instead (`garantias.ts:673`, `os.ts:1228`) |
| 2 | `registrarRetornoGarantiaOS` (`garantias.ts:1237`) | creates the return OS and links `retornoGarantiaId` on the origin OS | logs `RETORNO_GARANTIA_OS` only |
| 3 | `finalizarRetornoGarantiaOS` (`garantias.ts:1537-1544`) | `UPDATE "OrdemServico" SET "archivedAt" = now()` | logs `RETORNO_GARANTIA_OS` only |
| 4 | `adicionarItemOS` / `atualizarItemOS` / `removerItemOS` (`app/actions/os-itens.ts:225`, `:362`, `:481`) | `ItemOS` rows; the FK cascade and Prisma's `@updatedAt` bump the parent | logs `ITEM_OS` |
| 5 | `gerarPedidoVendaPorOS` (`os.ts:1543`) | creates `PedidoVenda`/`Venda`/`ContaReceber` against the OS | **no audit entry at all** |
| 6 | `processarVendaComOSNoPDV` (`app/actions/pdv.ts:1198`) | settles the OS through the POS | **no audit entry at all** — `pdv.ts` never imports `registrarLogAuditoria` |
| 7 | Any path, when the audit table is missing | — | `registrarLogAuditoria` **swallows the failure**: `if (erroTabelaAuditoriaInexistente(erro)) { console.warn(…); return { id: "auditoria-indisponivel" }; }` (`lib/auditoria.ts:134-138`). The business write commits; the trail silently does not. |

**Which of these can partially succeed during a finalization attempt.** `gerarGarantiaEFinalizarOS` wraps term creation *and* the status change in one `prisma.$transaction` (`os.ts:1211-1274`), so within a single invocation the split described in the question cannot happen — a failure rolls both back.

The dangerous combination is **sequential**, and it is the likely explanation for the observed rows:

> The operator first clicks **"Gerar garantia"** on a `PRONTO` order. `gerarTermoGarantiaOS` commits: the term is created **and** `OrdemServico.prazoGarantiaDias` is updated, bumping `atualizadoEm` — with the audit entry filed under `TERMO_GARANTIA_OS`, not `ORDEM_SERVICO` (path 1). The operator then attempts to finalize, and that attempt fails on one of the §16.3 gates. Net result: the OS row has a fresh `atualizadoEm`, a warranty term, no new `ORDEM_SERVICO` audit event, and an unchanged status.

Path 7 is the second explanation and is silent by construction. Paths 5 and 6 are wholly unaudited financial operations against an OS.

The `db:diagnostico` query `atualizadoDepoisDaAuditoria` (item 6) lists exactly these rows.

#### (c) Orders with items but no warranty term while in `PRONTO`

**Nothing skips or fails silently, because nothing ever creates the term automatically.** `atualizarStatusOrdemServico` (`os.ts:691-882`) — the only code path that moves an order into `PRONTO` — never calls `garantirTermoGarantiaPorOS` and never imports it for that purpose. Term creation has exactly two triggers, both requiring an explicit human action:

1. `gerarTermoGarantiaOS`, from the "Gerar garantia" button (only visible in `PRONTO`);
2. `gerarGarantiaEFinalizarOS`, from the "Finalizar" flow.

So **"in `PRONTO`, has items, has no term" is the default state of every order**, not an anomaly. The conditions that additionally *prevent* the term once the operator does try are:

- `exigirItemParaGarantia = true` and no items → `MENSAGEM_ERRO_GARANTIA_SEM_ITENS` (`garantias.ts:571-573`) — does not apply here by definition;
- a term already exists → early return with `criadoNovo: false` (`garantias.ts:498-507`), no error;
- `os.excluidaEm` set → throws (`garantias.ts:494-496`);
- status ≠ `PRONTO` → throws (`garantias.ts:503-505`);
- the prazo fails `validarPrazoGarantiaConfigurado` against the configured min/max;
- the button itself is hidden whenever `possuiItens` is false or a term already exists (`acao-garantia-os.tsx:68`), so the operator may never see an error at all — the affordance simply is not there.

The only genuinely *silent* case is the last one: an order with zero items shows the blocking text `"Cadastre uma peca ou servico antes de gerar a garantia."` only when `mostrarTextoBloqueio` is passed; otherwise nothing renders.

#### (d) Operators dragging orders through every column within seconds

The UI gives no way to reach `PRONTO` other than passing through every intermediate status:

- **Every column accepts every drop.** `components/os/tabuleiro-kanban.tsx:470` renders `<Droppable key={status} droppableId={status}>` with **no `isDropDisabled`**, and `aoFinalizarDrag` (`:377-414`) validates only that source and destination are members of `STATUS_SEQUENCIA`. The server agrees: `atualizarStatusOrdemServico` checks membership, never reachability (§6.3 of the original audit).
- **The only shortcut is a one-step button.** `CartaoOS` exposes `onMoverAnterior` / `onMoverProxima` (`components/os/cartao-os.tsx:146-179`), wired to `encontrarStatusAnterior` / `encontrarStatusSeguinte` — strict ±1 along `STATUS_SEQUENCIA` (`tabuleiro-kanban.tsx:174-182`, `:508-535`). There is no "jump to status" control and no multi-select.
- **`GARANTIA_RETORNO` sits between `EM_MANUTENCAO` and `PRONTO`** in `STATUS_SEQUENCIA` (`tabuleiro-kanban.tsx:62-71`). Walking a normal repair forward with the "next" button therefore **routes every non-warranty order through the warranty column**. Reaching `PRONTO` from `AGUARDANDO_ORCAMENTO` takes six clicks, one of which is a lie about the order's nature.

**Side effects of each of those six steps:**

1. **A notification row per step.** `statusComNotificacao` covers six of eight statuses (`os.ts:836-843`); walking the board fires `APROVADO`, `AGUARDANDO_PECA`, `EM_MANUTENCAO`, `GARANTIA_RETORNO` and `PRONTO` — five `Notificacao` rows for one order. They are tenant-global and have no user scope (F-73), so the bell floods for everyone.
2. **An audit row per step**, each with a full `dadosAntes`/`dadosDepois` payload (`os.ts:815-834`).
3. **`archivedAt` cleared on every step** (`os.ts:799`).
4. **`atualizadoEm` rewritten on every step**, which directly corrupts goal metric #2 (`QUANTIDADE_OS_FINALIZADAS` counts by `atualizadoEm`) and the warranty start date (§16.7-a).
5. **Five sequential Server Action round-trips**, each re-reading `Configuracao` via `obterRegrasOs` (`os.ts:243`) and each issuing five `revalidatePath` calls (`os.ts:867-871`) — the whole dashboard and OS tree are invalidated five times.

#### (e) `PRONTO → ENTREGUE → PRONTO` within seconds, losing `archivedAt`

**The exact interaction.** In the Kanban, drag a card from `PRONTO` to `ENTREGUE`, then drag it back to `PRONTO`. Both drops are accepted (no `isDropDisabled`, §16.7-d). The second drop calls `atualizarStatusOrdemServico(osId, "PRONTO")`, which executes:

```ts
// app/actions/os.ts:794-800
await txOrdemServico.update({
  where: { id: osId },
  data: {
    status,
    ...(status !== "ENTREGUE" ? { archivedAt: null } : {}),
  },
});
```

`archivedAt` is set to `NULL`. Dragging back to `ENTREGUE` does **not** restore it — the same statement adds nothing to `data` when `status === "ENTREGUE"`. The order ends up `ENTREGUE` with `archivedAt IS NULL`: absent from the "Finalizadas" list, still occupying the Kanban, and reported by recorte (a) of the diagnostic.

There is a second, faster route to the same state: the `ENTREGUE` column is a normal drop target, so an order can be dropped straight into `ENTREGUE` from anywhere. That transition sets the status but **never sets `archivedAt`** — archiving happens only in `archiveDeliveredOrderService` and `gerarGarantiaEFinalizarOS`. **Every order delivered by drag rather than by the "Finalizar" button is born un-archived.** Given the confirmation dialog for item-less orders is the only friction on that drop (`tabuleiro-kanban.tsx:394-403`), this is likely the dominant source of the incident population, ahead of the drag-back case.

**Every place `archivedAt` is cleared** (exhaustive):

1. `app/actions/os.ts:799` — `atualizarStatusOrdemServico`, Prisma path, on every status ≠ `ENTREGUE`.
2. `app/actions/os.ts:806-813` — the same action's raw-SQL fallback, `SET "archivedAt" = NULL`.

No other code clears it. Note the audit payload records the clear explicitly (`os.ts:829`: `archivedAt: status === "ENTREGUE" ? antes.archivedAt : null`), so the reconstruction in `db:diagnostico` item 6 can date every occurrence.

#### (f) Orders with zero items blocked by `exigirItemParaGarantia` + `exigirGarantiaAntesEntrega`

The message the operator actually sees, per path:

| Path | Trigger | Message shown |
|---|---|---|
| Kanban drop / next button onto `ENTREGUE` | `exigirGarantiaAntesEntrega` and no term | *"Para mover a OS para Entregue, gere o termo de garantia primeiro."* (`os.ts:223`) via `toast.error(resultado.erro)` (`components/os/dashboard-os.tsx:109`) |
| Same, item-less order | client-side pre-check | `AlertDialog` "confirm delivery without items" (`tabuleiro-kanban.tsx:394-403`) — **a confirmation, not a block**; after confirming, the server may still refuse with the message above |
| "Finalizar" button, order already `ENTREGUE` | no term | *"Para finalizar a OS, informe o prazo de garantia e gere o termo de garantia."* + `requerGarantia: true` (`os.ts:1042-1048`), which re-opens the modal asking for a warranty period (`dashboard-os.tsx:146-150`) |
| …operator then submits the period | `gerarGarantiaEFinalizarOS`, zero items | *"Para finalizar a OS, cadastre pelo menos uma peca ou servico na OS."* (`os.ts:1183-1188`) |
| …order is `ENTREGUE` with items but no term | `garantirTermoGarantiaPorOS` throws | *"A garantia so pode ser gerada quando a OS estiver como Pronto."* — and because `gerarGarantiaEFinalizarOS` does **not** wrap its `$transaction` in `try/catch`, this is an **unhandled Server Action rejection**. It surfaces through `dashboard-os.tsx:163-166` as `toast.error(error.message)` in development; in a production build React replaces the message with a generic digest, so the operator sees an opaque error with no cause at all. |
| "Gerar garantia" button, zero items | client-side | button hidden; text *"Cadastre uma peca ou servico antes de gerar a garantia."* only when `mostrarTextoBloqueio` is passed (`acao-garantia-os.tsx:40`, `:69`) |

**Does the message explain the cause?** Partly, and it degrades along the path:

- The item-less messages are clear and actionable.
- The warranty messages are clear about *what* to do but never say the operation is blocked by a **setting** (`exigirGarantiaAntesEntrega` / `exigirItemParaGarantia`), so an operator cannot tell that an administrator could relax it.
- The `ENTREGUE`-without-term case is the worst: the UI offers a warranty-period modal, the operator fills it in, and the server then rejects on a *status* rule the modal never mentioned — in production, with no message at all. This is the dead end from §16.3-1 surfacing as an unexplained failure.

---

## 17. Dead & Abandoned Features Inventory

> **Nothing is deleted in Phase 0.** This section only records what exists.

### 17.1 Dashboard-like pages, panels, widgets and charts

| Path | Shows | Data source | In navigation? | State | Duplicates |
|---|---|---|---|---|---|
| `app/(dashboard)/page.tsx` | Executive dashboard: KPIs, DRE, monthly result, accumulated balance, budget gauges, OS queue, stalled orders, warranty block, goals block, latest movements | `obterDashboardExecutivoSeguro` + `obterConfiguracoes` | yes (`/`) | real | — |
| `components/dashboard/*` (13 files) | The widgets above | props from the page | — | real | `grafico-resultado` / `grafico-saldo` both trip `set-state-in-effect` |
| `app/(dashboard)/financeiro/page.tsx` | Financial hub: KPI cards + action strip | `obterResumoDashboardFinanceiro` | yes | real | KPI numbers overlap the executive dashboard, computed by a different query |
| `app/(dashboard)/financeiro/inteligencia/page.tsx` | Payment-fee analytics | `obterInteligenciaTaxasPagamento`, `obterDadosAnaliticos` | yes | real | revenue re-derived a third way |
| `components/os/dashboard-os.tsx` | OS Kanban + finished list + deleted list | `obterDadosDashboardOS` | yes (`/os`) | real | — |
| `components/os/garantias/dashboard-garantias.tsx` | Warranty KPIs | `obterDashboardGarantiasOS` (client fetch) | yes | real | — |
| `components/metas/dashboard-metas.tsx` | Goals KPIs | `obterDashboardMetas` (client fetch) | yes | real | — |
| `app/(dashboard)/crm/page.tsx` | CRM hub | **none** — static cards | yes | navigation only | same pattern as `/vendas` |
| `app/(dashboard)/vendas/page.tsx` | Sales hub, 8 cards | **none** — static array | yes | **5 of 8 cards are `href: "#"`** | — |
| `app/(dashboard)/inicio/page.tsx` | "modules released" notice | `exigirContextoTenant` only | **no** — not in `ITENS_NAVEGACAO` | **stub**, migration-era | — |
| `components/configuracoes/painel-auditoria.tsx` | Audit panel | `app/actions/auditoria.ts` | yes (settings) | read-only report | — |
| `components/configuracoes/painel-usuarios.tsx` | Users panel | — | yes (settings) | **stub** — no user-management action exists anywhere | — |
| `components/configuracoes/painel-placeholder.tsx` | Placeholder | — | yes | **placeholder by name** | — |

### 17.2 Unreachable or unimported code

Verified by resolving every import edge across `app/`, `components/`, `lib/`, `hooks/`, `contextos/`, `store/`.

**An entire abandoned financial UI generation — 5 components, ~1 758 lines, zero importers:**

- `components/financeiro/modal-novo-recebimento.tsx` (577)
- `components/financeiro/modal-nova-conta-a-pagar.tsx` (571)
- `components/financeiro/modal-registro-cobranca.tsx` (306)
- `components/financeiro/tabela-contas-a-pagar.tsx` (204)
- `components/financeiro/cartao-kpi-financeiro.tsx` (100)

They were superseded by `app/(dashboard)/financeiro/receber/components/ConteudoReceber.tsx` and `.../pagar/components/ConteudoPagar.tsx`, which inline their own modals and tables. Three of the five still generate lint warnings (`react-hooks/incompatible-library` at `modal-nova-conta-a-pagar.tsx:73`, `modal-novo-recebimento.tsx:77`, `modal-registro-cobranca.tsx:76`) — the project is paying lint and bundle-analysis cost for dead code.

**Other unreachable modules:**

- `components/os/index.ts` — barrel with zero importers; it is the only reference to `components/os/coluna-kanban.tsx`, itself superseded by `lista-coluna-kanban.tsx`.
- `types/indice.ts` — zero importers.
- `app/actions/financeiro.ts` — `listarContasReceber` + `darBaixaConta`, superseded by `financeiro-receber.ts`; zero importers.

**Stubs, placeholders and "coming soon":**

- `/vendas` — 5 dead links (`vendas/page.tsx:44,64,72,84,98`).
- `painel-usuarios`, `painel-placeholder` (§17.1).
- `/inicio` — orphan route.
- `NotaFiscal` module — metadata CRUD with no fiscal integration.

**Superseded implementations kept side by side:**

| Old | New |
|---|---|
| `lib/formatadores.ts` | `components/ui/pagina/formatacao.ts` |
| `components/os/coluna-kanban.tsx` | `components/os/lista-coluna-kanban.tsx` |
| `app/actions/financeiro.ts` | `app/actions/financeiro-receber.ts` |
| `Conta` model | `ContaReceber` + `ParcelaDespesa` |
| hand-rolled `ProvedorTema` | `next-themes` (installed, unused — the *dependency* is the dead one) |
| `tailwind.config.ts` | Tailwind v4 CSS config in `app/globals.css` |

**Dead dependencies:** `axios`, `@tanstack/react-query`, `next-themes`, `tailwindcss-animate`, and `shadcn` (a CLI in `dependencies`).

**Committed throwaway scripts:** `scripts/_tmp-conferir-financeiro.mjs`, `scripts/_tmp-criar-teste-principal.mjs`, `scripts/_tmp-limpar-legado-seed.mjs`.

**Other dead references:** `revalidatePath("/dashboard")` (`os.ts:871`, `garantias.ts:693`) targets a route that does not exist; `public/*.svg` (5 create-next-app defaults); `.gitignore` entry `/lib/generated/prisma`.

### 17.3 Consolidated inventory

| ID | Type | Path | Evidence | Dependencies | DB impact | Removal risk |
|---|---|---|---|---|---|---|
| D-01 | Component | `components/financeiro/modal-novo-recebimento.tsx` | no importer | `@/lib/validations/financeiro` | none | **low** |
| D-02 | Component | `components/financeiro/modal-nova-conta-a-pagar.tsx` | no importer | idem | none | **low** |
| D-03 | Component | `components/financeiro/modal-registro-cobranca.tsx` | no importer | idem | none | **low** |
| D-04 | Component | `components/financeiro/tabela-contas-a-pagar.tsx` | no importer | — | none | **low** |
| D-05 | Component | `components/financeiro/cartao-kpi-financeiro.tsx` | no importer | — | none | **low** |
| D-06 | Barrel | `components/os/index.ts` | no importer | re-exports live components | none | **low** |
| D-07 | Component | `components/os/coluna-kanban.tsx` | only via D-06 | `@/dados/mock-os` | none | **low** (remove after D-06) |
| D-08 | Types | `types/indice.ts` | no importer | — | none | **low** |
| D-09 | Actions | `app/actions/financeiro.ts` | no importer | `exigirContextoTenant` | reads `ContaReceber` | **low** |
| D-10 | Route | `app/(dashboard)/inicio/page.tsx` | not in `ITENS_NAVEGACAO` | `exigirContextoTenant` | none | **medium** — may be a bookmarked landing page |
| D-11 | UI | `/vendas` 5 cards `href="#"` | `vendas/page.tsx:44,64,72,84,98` | — | none | **low** (UI text only) |
| D-12 | Panel | `components/configuracoes/painel-usuarios.tsx` | no user-management action exists | — | none | **medium** — removing hides the fact that the feature is missing |
| D-13 | Panel | `components/configuracoes/painel-placeholder.tsx` | placeholder | — | none | **low** |
| D-14 | Script | `scripts/_tmp-*.mjs` (3 files) | self-labelled temporary | Prisma clients | **writes** if executed | **low** to delete, **high** to run |
| D-15 | Dependency | `axios`, `@tanstack/react-query`, `next-themes`, `tailwindcss-animate`, `shadcn` | no import site | — | none | **low** |
| D-16 | Config | `tailwind.config.ts` | inert under Tailwind v4 | — | none | **medium** — verify the v4 pipeline picks up every path first |
| D-17 | Lib | `lib/formatadores.ts` | superseded, still imported in a few places | — | none | **medium** — migrate call sites first |
| D-18 | Call | `revalidatePath("/dashboard")` | route does not exist | — | none | **low** |
| D-19 | Assets | `public/*.svg` (5) | no reference | — | none | **low** |
| D-20 | Enum | `TipoCliente` (`prisma/schema.prisma`) | referenced by no model | — | **enum type in every tenant DB** | **medium** — DDL change, needs a migration |

### 17.4 Models and fields used only by dead code — **do not drop**

These are unreferenced (or referenced only by dead code) in the application, but **may hold production data**. They are listed here so the architect does not mistake them for D-class removals. Confirm row counts with `npm run db:diagnostico` item 10 before any decision.

| Model / field | Status in code | Why it must not be dropped |
|---|---|---|
| `Conta` (whole model) | Written by no UI; read only by `app/api/cron/verificar-vencimentos/route.ts:41` | Precursor of `ContaReceber`/`ParcelaDespesa`. May hold historical entries from before the split. The cron reading it is the reason it looks "alive". |
| `Usuario.senha` | Never read or written by `app/` | Legacy local credentials. Dropping destroys the only record of pre-central authentication. |
| `TermoGarantiaOS.canceladaEm`, `motivoCancelamento` | No writer anywhere | Warranty cancellation may have been recorded manually in SQL. |
| `RetornoGarantiaOS.finalizadoPorId` | Written without FK, may contain `""` (§16.3-2) | Contains real user ids for correctly-mapped users; needs cleaning, not dropping. |
| `OrdemServico.statusAnterior` | Written only by `excluirOrdemServico` (`os.ts:1422`); read by `listarOrdensServicoExcluidas` | The only record of what a soft-deleted order was before deletion — required to undo a deletion. |
| `OrdemServico.senha`, `senhaDesenho` | Read by the OS detail and print templates | Customer device credentials. Removal is a **privacy** decision (F-15), not a dead-code decision. |
| `PropostaComercial.*`, `PropostaItem.*` | Create-and-print only; no edit path (§16.5) | Fully populated by the create wizard; these are real commercial documents. |
| `Meta.erroSincronizacao`, `ultimaSincronizacaoEm` | Written by `sincronizarMetaAutomatica`; surfaced weakly | The only diagnostic trail for automatic goals. |
| `Notificacao` (whole model) | Written by several paths, read by the bell | Not dead — but unscoped to a user (F-73); a redesign must migrate, not truncate. |
| `Configuracao.cep`, `chavePix`, `habilitarMargemAutomatica`, `permitirVendaSemEstoque` | No reader (§16.6) | Operators have almost certainly filled `chavePix` and `cep` in. Dropping the columns loses configured business data that a future feature will need. |
