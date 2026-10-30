# CI e comandos de banco pelo GitHub Actions

Dois workflows, em `.github/workflows/`. Eles existem por um motivo concreto: o
ambiente onde o Claude trabalha tem a rede restrita a GitHub e ao registro do npm.
Na prática, isso significa que, **lá**:

- `binaries.prisma.sh` responde 403, então nenhum comando do CLI do Prisma roda —
  nem `prisma generate`, nem `prisma validate`. Sem o cliente gerado,
  `npx tsc --noEmit` reporta centenas de erros falsos (todo tipo do Prisma vira
  `any`) e `npm run build` não conclui;
- `*.neon.tech` responde 403, e a porta 5432 não passa pelo proxy, então não há
  acesso ao banco por nenhuma via;
- `api.vercel.com` também é bloqueado.

Os runners do GitHub não têm nenhuma dessas restrições. Então a validação de
verdade e os comandos de banco rodam neles.

---

## 1. `ci.yml` — portão de validação

Dispara em todo push de qualquer branch, em todo pull request, e manualmente.

Dois jobs em paralelo, de propósito — uma falha de lint não esconde o resultado dos
tipos, dos testes e do build:

| Job | O que roda |
|---|---|
| `validar` | `npm ci` (que gera os dois clientes Prisma no postinstall) → `prisma validate` nos dois schemas → `tsc --noEmit` → `npm test` → `npm run build` |
| `lint` | `npm run lint` |

Nenhuma etapa escreve no banco: `generate`, `tsc` e os testes não conectam, e o
build só precisa da connection string presente.

**Enquanto os secrets não existirem**, as duas strings caem num placeholder
(`postgresql://ci:ci@127.0.0.1:5432/ci`). Tipos, testes e lint continuam válidos
assim; só o build pode exigir a string real, dependendo do que o Next tente
pré-renderizar.

## 2. `banco.yml` — migrations e scripts, sob demanda

`workflow_dispatch` com os parâmetros `ambiente` (teste/producao), `comando`,
`tenant`, `ponto_restauracao` e `autorizar_destrutivo`.

Comandos disponíveis: `verificar-ambiente`, `diagnostico`, `migrar-dry-run`,
`migrar-aplicar`, `relatorio-os`, `verificar-datas`, `verificar-dinheiro`.

As travas **não** estão no workflow — continuam nos scripts, onde sempre estiveram
(ver [`migrations.md`](./migrations.md)): `--dry-run` é o padrão, `--aplicar` exige
`CONFIRMAR=SIM` e `PONTO_RESTAURACAO`, SQL destrutivo exige
`AUTORIZAR_DESTRUTIVO=SIM`, e connection string com `-pooler` é recusada. O que o
workflow acrescenta é:

- **`environment: <ambiente>`** — permite exigir aprovação humana para produção em
  Settings → Environments → `producao` → Required reviewers. É o equivalente, aqui,
  da regra de que escrita em produção não acontece sem decisão de uma pessoa;
- **`concurrency` por ambiente** — nunca dois comandos no mesmo banco ao mesmo tempo;
- uma checagem que falha cedo se `migrar-aplicar` vier sem `ponto_restauracao`;
- os relatórios de `docs/diagnostico/` são guardados como artifact por 30 dias.

---

## 3. Secrets — o que precisa existir

O caminho `/actions/secrets` da API do GitHub é bloqueado pelo proxy do Claude (por
boa razão: são credenciais). Portanto **os secrets são cadastrados à mão**, pela web,
pelo dono do repositório.

**Settings → Secrets and variables → Actions → Repository secrets** — usados pelo `ci.yml`:

| Secret | Valor |
|---|---|
| `TESTE_DATABASE_URL` | tenant de teste (`ep-purple-field-aq2o0ful`), sem `-pooler` |
| `TESTE_CENTRAL_DATABASE_URL` | central de teste (`ep-weathered-rice-atb8kse4`), sem `-pooler` |
| `TESTE_TENANT_PRINCIPAL_DATABASE_URL` | idem tenant principal |
| `TESTE_TENANT_CUNHADO_DATABASE_URL` | idem tenant do cunhado |

Para o `banco.yml`, mais quatro com prefixo `PROD_`, com os valores de produção e
**sem `-pooler`** no endereço: `PROD_DATABASE_URL`, `PROD_CENTRAL_DATABASE_URL`,
`PROD_TENANT_PRINCIPAL_DATABASE_URL`, `PROD_TENANT_CUNHADO_DATABASE_URL`. O workflow
escolhe entre os `TESTE_` e os `PROD_` pelo `ambiente` informado no disparo.

### Por que não por environment

O desenho original usava GitHub Environments com **Required reviewers** no `producao`,
para que toda escrita em produção parasse e esperasse aprovação humana. Regras de
proteção de environment exigem plano pago em repositório privado, e este repositório
está no Free — a opção não existe aqui.

O que substitui, e o que **não** substitui:

- `confirmo_producao` precisa ser exatamente `APLICAR EM PRODUCAO` para `migrar-aplicar`
  em produção. Isso impede o disparo por engano e registra a intenção no histórico do
  run — mas não impede quem dispara, porque é a mesma pessoa que digita.
- A trava real continua sendo o **ponto de restauração**, criado e confirmado antes de
  qualquer escrita, mais a recusa de SQL destrutivo sem `AUTORIZAR_DESTRUTIVO=SIM`.
- A decisão de aplicar em produção é do dono do projeto, combinada fora do mecanismo.
  Quem quiser o portão imposto pela ferramenta precisa do GitHub Pro.

## 4. Como o Claude usa isso

```bash
gh api repos/BeasttMaybe/konext-erp/actions/runs?per_page=5   # ler resultado do CI
gh api repos/<owner>/<repo>/commits/<sha>/check-runs          # status de um commit
gh workflow run banco.yml -f ambiente=teste -f comando=migrar-dry-run
```

O que continua **fora** do alcance do Claude, e por quê:

- cadastrar secrets — caminho bloqueado no proxy;
- criar o branch de restauração no Neon — o console e a API do Neon são bloqueados.
  Para `migrar-aplicar` em produção, o branch é criado pelo dono e o nome dele é
  passado em `ponto_restauracao`;
- a validação visual com screenshot do app rodando (ver
  [`testes-locais.md`](./testes-locais.md#3-sidebar-active-item-indicator-playwright-on-demand)),
  que continua manual e local.
