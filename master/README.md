# Konext Master

Sistema para administrar as lojas que usam o Konext ERP. É um projeto **separado** do ERP (outro endereço, outro login), mas vive no mesmo repositório para usar o **mesmo banco central** e o **mesmo catálogo de módulos**, sem cópias que possam divergir:

- o cliente do banco é gerado a partir de `../prisma/central/schema.prisma` (`scripts/gerar-cliente-central.mjs`);
- os módulos vêm de `../lib/modulos/catalogo.ts`.

As migrations do banco central continuam sendo do ERP (`banco.yml` → `central-aplicar`).

## O que faz hoje
Só visualização:
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
