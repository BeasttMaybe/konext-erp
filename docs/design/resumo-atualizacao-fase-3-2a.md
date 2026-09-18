# Resumo atualização — Fase 3-2A: Dashboard operacional

Branch: `fase-3-2a-dashboard` (a partir de `fase-3-1-design-system`, ainda não mesclada a `main`).

## Objetivo

Reconstruir a home (`/`) como um painel **operacional** — "o que está na minha bancada hoje?" — em vez de um resumo financeiro. Profundidade financeira (DRE, orçamento, saldo acumulado, ticket médio) permanece em `/financeiro`, tela com camada de dados própria (`app/actions/financeiro-hub.ts`), não tocada nesta fase.

## Commits

1. `c228773` — camada de dados (`app/actions/dashboard.ts`, `lib/dominio/dashboard/selecao-secoes-home.ts`)
2. `eda97de` — variantes `azul`/`garantia` do `CartaoIndicador` + tokens `--kx-garantia-fundo`/`-texto`
3. `4015400` — 7 componentes novos de seção da home + remoção de 13 componentes órfãos
4. `a93ef84` — reescrita de `app/(dashboard)/page.tsx`

Nenhuma migração de banco foi feita — não há mudança de schema nesta fase, e nenhuma escrita em banco (dados só de leitura, endpoints de teste).

## Estrutura da nova home

1. **Cabeçalho** (`cabecalho-dashboard.tsx`): nome da empresa, data de hoje, seletor de período (Hoje · 7 dias · 30 dias · Mês) via `?periodo=`.
2. **4 cartões de indicador** (`kpis-home.tsx`):
   - **Faturamento do período** — só visível com a permissão `dashboard.financeiro`; comparação com o período anterior e margem líquida como descrição.
   - **OS em andamento** — soma das etapas Orçamento + Conserto (`EtapaOS`), com detalhamento por etapa.
   - **Prontas para retirada** — reaproveita dado já existente (`operacao.prontasAguardandoRetirada`); destaca em `--kx-alerta` as que esperam retirada há mais de 7 dias.
   - **Garantias ativas** — reaproveita dado já existente (`operacao.garantia`); destaca as que vencem nos próximos 7 dias.
3. **Gráfico de receita (serviços vs produtos) + Fluxo de OS**: gráfico de 2 séries diárias (serviços = OS; produtos = PDV + pedidos de venda aprovados) com linha de margem líquida do período; ao lado, as 4 etapas do fluxo de OS (Orçamento/Conserto/Pronto/Entregue) com cores aprovadas e barra de proporção. O gráfico e sua coluna só aparecem com `dashboard.financeiro`; o Fluxo de OS é sempre visível.
4. **Últimas movimentações + Metas do mês**: tabela única com OS e vendas de PDV mais recentes (referência, cliente, descrição, status, valor); ao lado, progresso das metas do mês — quando nenhuma meta está definida, um único estado vazio com link para "Definir metas".
5. **Pendências**: aviso único reunindo pendências operacionais (OS paradas há mais de 7 dias, garantias vencendo em 7 dias) e, com `dashboard.financeiro`, pendências financeiras (contas a receber/pagar em atraso) — itens quebram linha e cada um linka para onde é resolvido.

## O que saiu da home (agora só em `/financeiro`)

Donut de margem (virou linha de texto no cartão de Faturamento), Saldo do período, A receber, A pagar, Ticket médio, Orçamento do período, e o cartão dedicado de "Valor em aberto (OS)" (o número continua calculado na camada de dados, só não é mais exibido na home).

## Limitações conhecidas

- O Kanban de OS (`/os?modo=kanban`) não lê nenhum filtro por status/etapa na query string — os links do Fluxo de OS e da pendência de "OS paradas" abrem o Kanban sem recorte específico.
- Não existe rota de detalhe de venda avulsa de PDV no app; o link de uma venda em "Últimas movimentações" aponta para `/pdv`.

## Validação

`tsc --noEmit` limpo · `eslint` limpo nos arquivos tocados (incluindo as regras `konext/sem-hex-hardcoded`/`konext/sem-cor-tailwind-solta`) · `vitest run` → 408/408 testes verdes · `npm run build:local` limpo, `/` gerada como rota dinâmica junto das outras 30 rotas · `prisma validate` sem diff de schema.
