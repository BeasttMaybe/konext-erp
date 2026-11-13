# Módulos por loja

O Konext pode ser vendido por partes. O catálogo está em `lib/modulos/catalogo.ts`.

## Núcleo
O núcleo fica sempre ligado em qualquer plano:
- Dashboard
- Clientes
- Configurações
- Ajuda
- Meu perfil

## Módulos
| id | nome | depende de |
|---|---|---|
| `os` | Ordens de Serviço | — |
| `estoque` | Estoque | — |
| `pdv` | PDV e Caixa | estoque |
| `vendas` | Vendas | estoque |
| `propostas` | Propostas | — |
| `financeiro` | Financeiro | — |
| `fiscal` | Notas fiscais (Bling) | financeiro |
| `metas` | Metas | — |

## Onde fica
Na tabela `ModuloEmpresa` (banco central), com uma linha por loja e módulo: `empresaId`, `modulo`, `ativo`.

- **Sem linha, o módulo está ligado.** Toda loja nasce com tudo ligado.
- O sistema master grava só as exceções.
- Um módulo cujo requisito está desligado também fica desligado.

## O que acontece quando um módulo é desligado
1. Ninguém da loja tem as permissões dele, porque `exigirContextoTenant` filtra. Toda action que confere permissão passa a recusar, e os botões que dependem de permissão somem.
2. O módulo sai do menu (`itensDaNavegacao`).
3. As telas dele mostram "não está no seu plano" (`layout.tsx` de cada pasta, com `PortaoDoModulo`).
4. Configurações → Estado do sistema mostra os módulos do plano.

## Até o master existir
Para desligar um módulo, rode este SQL no banco **central**. É uma escrita em produção, então as regras de `AGENTS.md` valem: ponto de restauração antes.

```sql
INSERT INTO "ModuloEmpresa" ("empresaId", "modulo", "ativo", "atualizadoEm")
VALUES ('<id da empresa>', 'metas', false, now())
ON CONFLICT ("empresaId", "modulo") DO UPDATE SET "ativo" = EXCLUDED."ativo", "atualizadoEm" = now();
```

Para religar, apague a linha ou grave `ativo = true`.
