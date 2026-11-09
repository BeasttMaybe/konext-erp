-- Nota fiscal de saida: campos para espelhar o que foi emitido no Bling.
--
-- `valorTotal` passa a aceitar NULO, e isso e a decisao mais importante
-- desta migration.
--
-- A listagem /nfe do Bling NAO traz o valor da nota — conferido num registro
-- real, nao suposto. O valor vem no detalhe, uma requisicao por nota, e o
-- Bling permite 3 requisicoes por segundo. Entao existe uma janela em que a
-- nota ja esta na tela e o valor ainda nao foi lido.
--
-- Gravar zero nessa janela seria mentir no campo onde mentir e mais caro: o
-- total da tela somaria errado e ninguem desconfiaria de um zero. Nulo e a
-- verdade — "ainda nao sei" — e a tela mostra tracinho em vez de R$ 0,00.
--
-- As linhas que ja existem tinham valor obrigatorio e continuam com o valor
-- que tinham: afrouxar a coluna nao mexe em nenhuma delas.
--
-- `blingId` unico e o que torna a sincronizacao idempotente: ela reconhece a
-- nota e atualiza, em vez de criar uma copia a cada leitura. Nota lancada a
-- mao tem blingId nulo, e varios nulos convivem num indice unico do Postgres
-- — que e exatamente o comportamento desejado aqui.

ALTER TABLE "NotaFiscal" ALTER COLUMN "valorTotal" DROP NOT NULL;

ALTER TABLE "NotaFiscal" ADD COLUMN "serie" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "blingId" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "situacaoBling" INTEGER;
ALTER TABLE "NotaFiscal" ADD COLUMN "dataEmissao" TIMESTAMPTZ(3);
ALTER TABLE "NotaFiscal" ADD COLUMN "clienteNome" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "clienteDocumento" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "atualizadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "NotaFiscal_blingId_key" ON "NotaFiscal"("blingId");
CREATE INDEX "NotaFiscal_dataEmissao_idx" ON "NotaFiscal"("dataEmissao");
