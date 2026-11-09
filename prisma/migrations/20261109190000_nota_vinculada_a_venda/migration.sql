-- Vinculo da nota do Bling com a venda, e a conta a receber que nasce da
-- parcela da nota.
--
-- O dono descreveu a regra: "caso ja exista a venda no erp da konext, sistema
-- identifica duplicidade e vincula a nota a venda dentro do erp. os que nao
-- existem, inserir no contas a receber normalmente com a data de vencimento e
-- descrito no nome da conta (Bling)".
--
-- POR QUE `pedidoId` PODE SER NULO, E ISSO NAO E DEFEITO
--
-- O detalhe da nota no Bling NAO traz referencia nenhuma ao Konext:
-- `numeroPedidoLoja` vem vazio e nao existe campo de pedido externo. Entao
-- nao ha chave — o reconhecimento e por semelhanca (mesmo CPF/CNPJ, mesmo
-- valor ao centavo, data proxima) e RECUSA O AMBIGUO.
--
-- Duas vendas iguais do mesmo cliente na mesma semana nao casam nenhuma: nao
-- existe informacao para escolher, e escolher gravaria um palpite como fato,
-- num vinculo que aparece no historico de dois clientes e no financeiro.
-- `motivoSemVinculo` guarda o porque, pra tela explicar em vez de so omitir.
--
-- A IDEMPOTENCIA DA CONTA A RECEBER
--
-- `blingParcelaRef` unico e o que impede a conta de nascer de novo a cada
-- sincronizacao. Sem ele, cada leitura da mesma nota criaria outra conta, e o
-- total a receber cresceria sozinho — o pior defeito possivel numa tela de
-- dinheiro, porque ninguem desconfia de um numero que so aumenta.

ALTER TYPE "OrigemReceita" ADD VALUE IF NOT EXISTS 'BLING';

ALTER TABLE "NotaFiscal" ADD COLUMN "pedidoId" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "motivoSemVinculo" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "linkXml" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "linkDanfe" TEXT;
ALTER TABLE "NotaFiscal" ADD COLUMN "descricaoItens" TEXT;

CREATE INDEX "NotaFiscal_pedidoId_idx" ON "NotaFiscal"("pedidoId");

ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContaReceber" ADD COLUMN "blingParcelaRef" TEXT;
CREATE UNIQUE INDEX "ContaReceber_blingParcelaRef_key" ON "ContaReceber"("blingParcelaRef");
