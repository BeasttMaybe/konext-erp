# Rodar o sistema inteiro sem o Neon

Para quem (pessoa ou agente) precisa **ver o sistema rodando** num ambiente que
não alcança o Neon nem `binaries.prisma.sh` — por exemplo, um sandbox que só
enxerga o GitHub e o npm.

Sem isto, a única validação possível é ler código e esperar a CI. Em
11/11/2026 este roteiro achou, antes da CI ou no lugar dela:

- um erro de tipo que só aparece com o cliente Prisma gerado;
- uma política de segurança que a rota enviava e **não chegava ao navegador**
  (os cabeçalhos de `next.config.ts` passam por cima dos da resposta);
- duas requisições duplicadas em toda tela, invisíveis na leitura do código.

Nenhum dos três apareceria em teste de unidade.

## 1. Gerar o cliente Prisma

O `prisma generate` tenta baixar o *schema engine*, que só é usado em
migração. Apontar a variável para qualquer executável existente evita o
download — o `generate` não chega a executá-lo:

```bash
export PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npx prisma generate
npx prisma generate --config prisma.central.config.ts
```

A partir daqui `npx tsc --noEmit`, `npx vitest run` (os 94 arquivos) e
`npx next build` funcionam.

## 2. Dois bancos num Postgres comum

```bash
createdb central && createdb loja
for f in prisma/central/migrations/*/migration.sql; do psql -d central -v ON_ERROR_STOP=1 -f "$f"; done
for f in prisma/migrations/*/migration.sql;         do psql -d loja    -v ON_ERROR_STOP=1 -f "$f"; done
```

Aplicar as migrations na ordem, num banco vazio, também é o teste de que elas
se reproduzem do zero.

No `central`, crie uma `Empresa`, um `Tenant` (`status = 'ATIVO'`,
`connectionRef = 'TENANT_LOCAL_DATABASE_URL'`), um `UsuarioCentral` com a senha
em bcrypt, um `Cargo` com `fixo = true` e o `UsuarioEmpresa` ligando tudo. No
`loja`, um `Usuario` com o mesmo e-mail. **Gere a senha na hora; não grave
senha de teste no repositório.**

## 3. A ponte

O sistema fala com o banco pelo driver *serverless* do Neon, que usa
WebSocket — ele não conecta num Postgres comum. `scripts/dev/local/` tem:

- `ponte-ws.cjs` — repassa WebSocket para TCP (usa o `ws` do próprio projeto);
- `preparar-neon.cjs` — carregado por `--require`, aponta o driver para a ponte.

**Nada disso entra no código do sistema.** A configuração é injetada de fora,
no processo, e por isso o que roda é exatamente o build de produção.

```bash
node scripts/dev/local/ponte-ws.cjs "$PWD" &

RAIZ_DO_PROJETO="$PWD" \
NODE_OPTIONS="--require $PWD/scripts/dev/local/preparar-neon.cjs" \
CENTRAL_DATABASE_URL="postgresql://postgres:x@localhost:5432/central" \
TENANT_LOCAL_DATABASE_URL="postgresql://postgres:x@localhost:5432/loja" \
CRON_SECRET="qualquer-valor-de-teste" \
npx next start -p 3100
```

## 4. Navegar por todas as telas

```bash
SENHA_DE_TESTE='…' node scripts/dev/local/navegar.cjs "/,/os,/pdv,/financeiro,/configuracoes" /tmp/telas
```

Faz login pelo formulário real e visita cada rota, acusando tela de erro,
resposta 5xx e erro no console. Sai com código 1 se alguma falhar.

## 5. Contar consultas

`ALTER SYSTEM SET log_statement = 'all'; SELECT pg_reload_conf();` e contar as
linhas do log entre o antes e o depois de abrir uma tela. Foi assim que a
otimização de sessão foi **medida** (tela inicial: 122 → 70 consultas) em vez
de estimada. Desligue depois com `ALTER SYSTEM RESET log_statement`.
