<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ambientes

Endpoints Neon deste projeto (nunca credenciais — só o host, que já é seguro de citar). Cada projeto Neon tem um branch de teste e um de produção, para os dois bancos (tenant e central):

| | Teste/branch | Produção |
|---|---|---|
| Tenant | `ep-purple-field-aq2o0ful` | `ep-orange-recipe-aq2e102u` |
| Central | `ep-weathered-rice-atb8kse4` | `ep-broad-glade-atqpp0f4` |

Regras, sem exceção:
- Scripts e comandos deste projeto sempre rodam contra os endpoints de **teste**, a menos que o dono do projeto diga explicitamente o contrário.
- Nenhuma connection string usada por um script de migração/reparo pode conter `-pooler` — ver `docs/operacao/migrations.md`.
- Toda escrita em produção exige um branch de restauração Neon recém-criado (`PONTO_RESTAURACAO`) antes de rodar, mesmo com confirmação explícita do dono.
