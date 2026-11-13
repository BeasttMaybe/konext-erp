# Konext Master

Sistema para administrar as lojas que usam o Konext ERP. É um projeto **separado** do ERP (outro endereço, outro login), mas vive no mesmo repositório para usar o **mesmo banco central** e o **mesmo catálogo de módulos**, sem cópias que possam divergir:

- o cliente do banco é gerado a partir de `../prisma/central/schema.prisma` (`scripts/gerar-cliente-central.mjs`);
- os módulos vêm de `../lib/modulos/catalogo.ts`.

As migrations do banco central continuam sendo do ERP (`banco.yml` → `central-aplicar`).

## Criar loja nova
"Nova loja" cria tudo sozinho (`lib/provisionar.ts`):
1. Empresa, tenant e os cargos padrão no banco central.
2. Banco próprio da loja no Neon. Fica no projeto `konext-lojas`, que é criado na primeira loja, com um banco e um papel do Postgres por loja.
3. O endereço desse banco vai **cifrado** para `ConexaoTenant`, com a chave `CHAVE_DAS_CONEXOES`. O `connectionRef` do tenant fica `COFRE`.
4. As migrations da loja, aplicadas pelo mesmo código que o CI prova ser igual ao `prisma migrate deploy`.
5. A conta do responsável, como administrador e dono da loja. A senha temporária aparece **uma vez** na tela.

Se algo falhar no meio, a loja fica "Preparando". O botão "Continuar criação", no detalhe da loja, refaz só o que falta.

Depois de criada, a loja recebe as próximas migrations pelo `banco.yml` de sempre. O runner abre o cofre com o secret `CHAVE_DAS_CONEXOES`, e o ponto de restauração também cobre o projeto `konext-lojas`.

## O que faz hoje
- lista de lojas com status, usuários, módulos, erros das últimas 24 h e último acesso;
- detalhe de cada loja com módulos, banco, usuários, erros recentes e ações de administração.

Ele não abre o banco de nenhuma loja.

## Acesso
- Os administradores ficam na tabela `AdministradorMaster`, separada dos usuários das lojas.
- O **primeiro** administrador é criado na própria tela de login, com o código `MASTER_CODIGO_DE_CRIACAO`. Depois que existe um administrador, essa tela some.
- Depois de 5 senhas erradas em 15 minutos, o acesso é pausado. A sessão dura 12 h, num cookie `httpOnly` com `SameSite=Strict`.
- O master não aparece em buscadores e não pode ser carregado dentro de outro site.

## Variáveis de ambiente (projeto master na Vercel)
| nome | valor |
|---|---|
| `CENTRAL_DATABASE_URL` | a mesma do projeto do ERP |
| `MASTER_CODIGO_DE_CRIACAO` | uma frase longa escolhida por você (12+ caracteres), usada uma vez |
| `NEON_API_KEY` | chave da API do Neon (Neon → Account settings → API keys), para criar o banco das lojas novas |
| `CHAVE_DAS_CONEXOES` | frase longa (32+ caracteres). A **mesma** frase vai também no projeto do ERP na Vercel e nos secrets do GitHub |
| `URL_DO_ERP` | opcional: o endereço do ERP, mostrado no acesso da loja nova |

## Vercel
O projeto é criado a partir deste mesmo repositório:
- **Root Directory** = `master`
- **Framework**: Next.js
- **Include files outside the root directory** ligado (é o padrão)

## Local
```
cd master
npm install
npm run dev
```
Roda na porta 3200 e precisa de `CENTRAL_DATABASE_URL`.
