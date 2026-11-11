-- Indices que faltavam.
--
-- O Postgres cria indice sozinho para chave primaria e para coluna UNIQUE,
-- mas NAO para chave estrangeira. Onze relacoes do sistema estavam sem: toda
-- busca "os itens DESTA ordem de servico", "as vendas DESTE caixa", "as
-- parcelas DESTA despesa" lia a tabela inteira para achar as linhas.
--
-- Hoje ninguem percebe: as tabelas tem centenas de linhas e uma leitura
-- inteira custa menos de um milissegundo. O custo cresce junto com o
-- historico, e a tela que mais sofre e a mais usada -- abrir uma OS le
-- ItemOS por "osId", e ItemOS so cresce.
--
-- Os dois indices compostos (status, dataVencimento) atendem as perguntas
-- que o Financeiro faz o tempo todo: "o que esta em aberto e vence ate tal
-- dia". Antes, os cartoes "A receber" e "A pagar" carregavam a tabela
-- inteira e filtravam na memoria do servidor.
--
-- Migration ADITIVA: so cria indice. Nenhuma coluna, nenhum dado. Funciona
-- com qualquer versao do codigo no ar, antes ou depois do deploy.

CREATE INDEX IF NOT EXISTS "OrdemServico_clienteId_idx" ON "OrdemServico"("clienteId");

CREATE INDEX IF NOT EXISTS "ItemOS_osId_idx" ON "ItemOS"("osId");

CREATE INDEX IF NOT EXISTS "ContaReceber_clienteId_idx" ON "ContaReceber"("clienteId");

CREATE INDEX IF NOT EXISTS "ContaReceber_ordemServicoId_idx" ON "ContaReceber"("ordemServicoId");

CREATE INDEX IF NOT EXISTS "ContaReceber_status_dataVencimento_idx" ON "ContaReceber"("status", "dataVencimento");

CREATE INDEX IF NOT EXISTS "Despesa_clienteId_idx" ON "Despesa"("clienteId");

CREATE INDEX IF NOT EXISTS "ParcelaDespesa_despesaId_idx" ON "ParcelaDespesa"("despesaId");

CREATE INDEX IF NOT EXISTS "ParcelaDespesa_status_dataVencimento_idx" ON "ParcelaDespesa"("status", "dataVencimento");

CREATE INDEX IF NOT EXISTS "NotaFiscal_clienteId_idx" ON "NotaFiscal"("clienteId");

CREATE INDEX IF NOT EXISTS "Venda_clienteId_idx" ON "Venda"("clienteId");

CREATE INDEX IF NOT EXISTS "Venda_caixaSessionId_idx" ON "Venda"("caixaSessionId");

CREATE INDEX IF NOT EXISTS "ItemVenda_vendaId_idx" ON "ItemVenda"("vendaId");

CREATE INDEX IF NOT EXISTS "ItemVenda_produtoId_idx" ON "ItemVenda"("produtoId");
