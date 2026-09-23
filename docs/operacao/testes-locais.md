# Local role testing

How to spin up a disposable test user for each company role (`ADMIN`, `GESTOR`, `USUARIO`) against your local `.env`, and a manual checklist of what each role should and should not be able to click through the UI.

---

## 1. Creating a test user

`scripts/dev/criar-usuario-teste.mjs` creates (or updates) a `UsuarioCentral` + `UsuarioEmpresa` in the central database for an existing company, and the matching `Usuario` row — same `id` in both databases, so `LogAuditoria` authorship works — in that company's tenant database.

### 1.1 Guardrails

- **Refuses to run unless `AMBIENTE="teste"` is set in your `.env`.** This is a hard gate, checked before anything else, so the script can never be run by accident against a production `.env`.
- **Refuses any `-pooler` connection string** (central or tenant) — same rule as the backup/diagnostic scripts in [`backup-restore.md`](./backup-restore.md#13-direct-connections-only--no-pooler). Use the direct endpoint.
- **Dry by default**: it always prints what it's about to do (masked central host, e-mail, role, company) and does **not** write anything unless you also set `CONFIRMAR=SIM`.
- Never echoes the password back, in the preview or in the success output.

### 1.2 Usage

```bash
# Preview only — prints what would happen, writes nothing
AMBIENTE=teste npm run dev:usuario-teste -- \
  --email usuario.teste@konext.local \
  --senha "Teste1234" \
  --papel USUARIO \
  --empresa <company-slug>

# Same, but actually writes
AMBIENTE=teste CONFIRMAR=SIM npm run dev:usuario-teste -- \
  --email usuario.teste@konext.local \
  --senha "Teste1234" \
  --papel USUARIO \
  --empresa <company-slug>
```

(`AMBIENTE=teste` can also just live in your `.env` instead of being passed inline every time.)

| Flag | Required | Notes |
|---|---|---|
| `--email` | yes | Login e-mail. Re-running with the same e-mail updates that user's password/role instead of creating a duplicate. |
| `--senha` | yes | Minimum 8 characters, letters and numbers — same rule as `lib/auth/senha.ts`'s `validarNovaSenha`. Hashed with the same bcrypt cost (`CUSTO_HASH_SENHA`) used everywhere else in the app. |
| `--papel` | yes | One of `ADMIN`, `GESTOR`, `USUARIO` — this is the central `RoleEmpresa`, the only thing that drives permissions (see `lib/auth/permissoes.ts`). |
| `--empresa` | yes | Slug of an existing, `ATIVA` company with exactly one `ATIVO` tenant. The script does not create companies or tenants. |

The tenant-side `Usuario.role` (a different, cosmetic-only enum — `ADMIN`/`OPERADOR`/`TECNICO`) is derived automatically from `--papel` and never affects authorization; see the comment in `types/tenant.ts` for why the two vocabularies must never be conflated.

---

## 2. Manual test checklist per role

Log in as each role (via the users you created above) and confirm the table below. "Hidden" means the control/section does not render at all; where hiding an action would leave an empty actions area, the UI shows *"Você não tem permissão para esta ação. Fale com o administrador da loja."* instead.

| Screen | Control | ADMIN | GESTOR | USUARIO |
|---|---|:---:|:---:|:---:|
| `/` (home) | Full financial dashboard (KPIs, charts, DRE) | visible | visible | **hidden** — operational-only view (OS queue, stalled orders, warranty, goals) |
| `/configuracoes` | Whole page | visible | **blocked** (Acesso não permitido) | **blocked** |
| `/perfil` | "Logo da empresa" field | visible | hidden | hidden |
| `/estoque` | "Novo Produto" button | visible | visible | hidden |
| `/estoque` | Row actions menu (Editar/Excluir) | visible | visible | hidden → explanatory line |
| `/financeiro/**` | Whole section | visible | visible | visible (has `financeiro.ver`) |
| `/financeiro/inteligencia` | Whole page | visible | visible | **blocked** |
| `/financeiro/receber` | "Nova Conta" button | visible | visible | hidden |
| `/financeiro/receber` | Row menu: Dar Baixa / Editar / Excluir | visible | visible | hidden (Detalhes stays) |
| `/financeiro/pagar` | "Nova Despesa" button | visible | visible | hidden |
| `/financeiro/pagar` | "Pagar / Antecipar" button | visible | visible | hidden → explanatory line |
| `/financeiro/notas-fiscais` | Create/edit form | visible | visible | hidden |
| `/financeiro/notas-fiscais` | Row actions (Editar/Emitir/Cancelar) | visible | visible | hidden → explanatory line |
| `/crm/contatos` | "Excluir" menu item | visible | visible | hidden (other menu items stay) |
| `/os` (Kanban) | "Reabrir" action | visible | visible | hidden |
| `/os` → excluded-orders tab | "Excluir OS" button | visible | visible | hidden → explanatory line |
| `/os/[id]` | Cost/margin column | shows values | shows values | shows "—" |
| `/pdv` | Sell / checkout | works | works | works |
| `/pdv` | Discount above the configured cap | allowed | allowed | server rejects (no cosmetic gate on the field itself) |
| `/metas` | "Nova meta" / "Atualizar metas automáticas" | visible | visible | hidden |
| `/metas/[id]` | Atualizar progresso / Pausar / Reabrir / Concluir / Cancelar | visible | visible | hidden → explanatory line if nothing else is available |
| `/metas/[id]` | Excluir (trash icon) | visible | visible | hidden |
| Sales approval sheet (`/vendas`, `/vendas/historico`) | Aprovar / Rejeitar / Cancelar | visible | visible | hidden → explanatory line |
| `/vendas/pedidos/novo` | Whole page | visible | visible | visible (`vendas.criar` is granted to everyone) |

A failing row (a control visible that should be hidden, or vice versa) is a regression in the permission wiring — check the corresponding `useTemPermissao(...)` call in that screen's component against the matrix in `lib/auth/permissoes.ts`.

Server-side enforcement is the actual security boundary and does not depend on this checklist — hiding a button is UX, not access control. If in doubt, confirm the underlying action still rejects the call with `ErroPermissao` even when a button is (incorrectly) visible.

---

## 3. Sidebar active-item indicator (Playwright, on demand)

`scripts/verificacao/verificar-indicador-menu-lateral.mjs` checks that the sidebar's sliding active-item indicator (`.kx-notch-ativo` in `components/shell/barra-lateral.tsx`) is actually painted on top of the sidebar — not just that its CSSOM background-color is correct.

This distinction matters: the regression fixed in `fix-regressao-menu-kpi` (the `<aside>` losing `position`/`z-index` in `6cb2ad5`, so the indicator's negative `z-index` escaped its stacking context and got painted *behind* the sidebar's own background) left `getComputedStyle` reporting the right color the whole time — only the actual rendered pixel was wrong. `jsdom` never paints anything, so this class of bug is invisible to a regular Vitest/Testing Library test; the script drives a real headless Chromium (via `playwright-core`, already in this repo's dependency tree) and samples the actual screenshot pixel where the indicator should be.

This project has no `@playwright/test` dependency, no Playwright config, and no CI wiring for it — the script is **not** picked up by `npx vitest run` and is not run in CI. It's a manual/on-demand check: run it locally after touching `barra-lateral.tsx`, `shell-dashboard.tsx`, or the `--kx-z-*`/`--kx-fundo` tokens.

```bash
npm run dev                                              # terminal 1
node scripts/verificacao/verificar-indicador-menu-lateral.mjs   # terminal 2
```

Needs a test user (see §1 above); defaults to `agente.teste@konext.local` / `AgenteTeste1234` (`--papel ADMIN`, `--empresa konext-principal`) — override with `EMAIL_TESTE`/`SENHA_TESTE`/`BASE_URL` env vars if yours differs. Checks the first, a middle, and the last nav item, plus that the slide transition is disabled under `prefers-reduced-motion: reduce`.
