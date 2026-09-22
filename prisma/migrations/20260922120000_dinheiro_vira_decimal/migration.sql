-- Fase 2A-2: toda coluna classificada como DINHEIRO (reais) vira
-- DECIMAL(12,2), e toda coluna classificada como PERCENTUAL (taxas,
-- descontos, participacao) vira DECIMAL(7,4) — ver a tabela completa no
-- relatorio da Fase 2A-2 (Parte 1). Gerada por
--   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- contra o tenant de TESTE (ep-purple-field-aq2o0ful) e editada A MAO na
-- sequencia: toda clausula "ALTER COLUMN ... SET DATA TYPE DECIMAL(...)"
-- gerada pelo Prisma ganhou "USING round("coluna"::numeric, N)" logo depois
-- (o Prisma, sozinho, faz so um cast direto — um Float/double precision com
-- ruido binario, ex. 1409.8899999999999, viraria um Decimal com o MESMO
-- ruido, so que agora fixo pra sempre no tipo; "round(...)" arredonda pro
-- numero de casas correto ANTES da conversao, exatamente como
-- scripts/verificacao/verificar-dinheiro.mjs --antes/--depois prova).
--
-- N = 2 pra colunas DINHEIRO (centavos), N = 4 pra colunas PERCENTUAL
-- (as colunas *Percentual/*Porcentagem ja usadas no PDV tem ate 2 casas
-- hoje, mas taxaCartaoCreditoNxPercentual eram Decimal(5,2) e viram
-- Decimal(7,4) — mais casas de precisao pra taxa composta, sem mudar
-- nenhum valor ja gravado: round(x::numeric, 4) de um numero que so tem 2
-- casas decimais e o proprio numero).
--
-- Mesmo precedente documentado na secao 5.3 de docs/operacao/migrations.md
-- e na migracao 20260921134054_colunas_instante_viram_timestamptz (Fase
-- 2A-1, USING ... AT TIME ZONE 'UTC' pro mesmo motivo: nunca deixar o
-- Prisma fazer so um cast cru quando o valor de origem pode ter ruido).
--
-- Meta.valorAlvo/valorAtual e HistoricoMeta.valorAnterior/valorNovo FICAM
-- DE FORA de proposito — sao polimorficos (podem representar dinheiro,
-- quantidade OU percentual, dependendo de Meta.tipoValor em tempo de
-- execucao) e nao sao "dinheiro" no sentido desta fase. Ver relatorio da
-- Fase 2A-2 (Parte 1) pra decisao pendente.
--
-- AlterTable
ALTER TABLE "CaixaSession" ALTER COLUMN "valorAbertura" SET DATA TYPE DECIMAL(12,2) USING round("valorAbertura"::numeric, 2),
ALTER COLUMN "valorFechamento" SET DATA TYPE DECIMAL(12,2) USING round("valorFechamento"::numeric, 2);

-- AlterTable
ALTER TABLE "Configuracao" ALTER COLUMN "descontoMaximoPDVPercentual" SET DATA TYPE DECIMAL(7,4) USING round("descontoMaximoPDVPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoDebitoPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoDebitoPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito1xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito1xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito2xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito2xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito3xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito3xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito4xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito4xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito5xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito5xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito6xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito6xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito7xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito7xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito8xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito8xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito9xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito9xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito10xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito10xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito11xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito11xPercentual"::numeric, 4),
ALTER COLUMN "taxaCartaoCredito12xPercentual" SET DATA TYPE DECIMAL(7,4) USING round("taxaCartaoCredito12xPercentual"::numeric, 4);

-- AlterTable
ALTER TABLE "Conta" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2) USING round("valor"::numeric, 2);

-- AlterTable
ALTER TABLE "ContaReceber" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2) USING round("valor"::numeric, 2);

-- AlterTable
ALTER TABLE "Despesa" ALTER COLUMN "valorTotal" SET DATA TYPE DECIMAL(12,2) USING round("valorTotal"::numeric, 2);

-- AlterTable
ALTER TABLE "ItemOS" ALTER COLUMN "custoPeca" SET DATA TYPE DECIMAL(12,2) USING round("custoPeca"::numeric, 2),
ALTER COLUMN "valorCobrado" SET DATA TYPE DECIMAL(12,2) USING round("valorCobrado"::numeric, 2);

-- AlterTable
ALTER TABLE "ItemVenda" ALTER COLUMN "custoUnitario" SET DATA TYPE DECIMAL(12,2) USING round("custoUnitario"::numeric, 2),
ALTER COLUMN "precoUnitario" SET DATA TYPE DECIMAL(12,2) USING round("precoUnitario"::numeric, 2),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2) USING round("subtotal"::numeric, 2);

-- AlterTable
ALTER TABLE "NotaFiscal" ALTER COLUMN "valorTotal" SET DATA TYPE DECIMAL(12,2) USING round("valorTotal"::numeric, 2);

-- AlterTable
ALTER TABLE "Oportunidade" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2) USING round("valor"::numeric, 2);

-- AlterTable
ALTER TABLE "ParcelaDespesa" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2) USING round("valor"::numeric, 2),
ALTER COLUMN "valorPago" SET DATA TYPE DECIMAL(12,2) USING round("valorPago"::numeric, 2);

-- AlterTable
ALTER TABLE "PedidoVenda" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2) USING round("total"::numeric, 2);

-- AlterTable
ALTER TABLE "PedidoVendaItem" ALTER COLUMN "precoUnitario" SET DATA TYPE DECIMAL(12,2) USING round("precoUnitario"::numeric, 2),
ALTER COLUMN "descontoPorcentagem" SET DATA TYPE DECIMAL(7,4) USING round("descontoPorcentagem"::numeric, 4),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2) USING round("subtotal"::numeric, 2);

-- AlterTable
ALTER TABLE "PedidoVendaParcela" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2) USING round("valor"::numeric, 2);

-- AlterTable
ALTER TABLE "Produto" ALTER COLUMN "custo" SET DATA TYPE DECIMAL(12,2) USING round("custo"::numeric, 2),
ALTER COLUMN "precoVenda" SET DATA TYPE DECIMAL(12,2) USING round("precoVenda"::numeric, 2);

-- AlterTable
ALTER TABLE "PropostaComercial" ALTER COLUMN "subtotalBruto" SET DATA TYPE DECIMAL(12,2) USING round("subtotalBruto"::numeric, 2),
ALTER COLUMN "descontoTotal" SET DATA TYPE DECIMAL(12,2) USING round("descontoTotal"::numeric, 2),
ALTER COLUMN "valorTotal" SET DATA TYPE DECIMAL(12,2) USING round("valorTotal"::numeric, 2);

-- AlterTable
ALTER TABLE "PropostaItem" ALTER COLUMN "precoUnitario" SET DATA TYPE DECIMAL(12,2) USING round("precoUnitario"::numeric, 2),
ALTER COLUMN "descontoPercentual" SET DATA TYPE DECIMAL(7,4) USING round("descontoPercentual"::numeric, 4),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2) USING round("subtotal"::numeric, 2);

-- AlterTable
ALTER TABLE "RetornoGarantiaOS" ALTER COLUMN "valorAdicional" SET DATA TYPE DECIMAL(12,2) USING round("valorAdicional"::numeric, 2);

-- AlterTable
ALTER TABLE "TecnicoOS" ALTER COLUMN "participacaoPercentual" SET DATA TYPE DECIMAL(7,4) USING round("participacaoPercentual"::numeric, 4);

-- AlterTable
ALTER TABLE "Venda" ALTER COLUMN "valorTotal" SET DATA TYPE DECIMAL(12,2) USING round("valorTotal"::numeric, 2),
ALTER COLUMN "desconto" SET DATA TYPE DECIMAL(12,2) USING round("desconto"::numeric, 2);

-- AlterTable
ALTER TABLE "VendaPagamento" ALTER COLUMN "valorBruto" SET DATA TYPE DECIMAL(12,2) USING round("valorBruto"::numeric, 2),
ALTER COLUMN "percentualTaxa" SET DATA TYPE DECIMAL(7,4) USING round("percentualTaxa"::numeric, 4),
ALTER COLUMN "valorTaxa" SET DATA TYPE DECIMAL(12,2) USING round("valorTaxa"::numeric, 2),
ALTER COLUMN "valorLiquido" SET DATA TYPE DECIMAL(12,2) USING round("valorLiquido"::numeric, 2);
