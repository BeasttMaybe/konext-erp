-- Fase 4: livro de movimentacoes de estoque.
--
-- Migration ADITIVA: uma tabela nova, dois enums novos, nenhuma coluna
-- existente alterada. O codigo do build anterior nao conhece nada disto e nao
-- e afetado. Vale a ordem normal: banco primeiro, codigo depois.
--
-- Por que existe: `Produto.quantidadeEstoque` era um Int mutado em quatro
-- lugares (venda do PDV, aprovacao de pedido, estorno de venda e edicao
-- manual na tela) sem registrar nada em lugar nenhum. O sistema sabia quanto
-- tinha AGORA e nada sobre como chegou ali — nao havia como responder o que
-- entrou no mes, se um produto gira, ou quem mexeu num saldo. Os relatorios
-- de estoque pedidos pelo dono nao tinham de onde sair.
--
-- `saldoAnterior`/`saldoPosterior` sao anulaveis por causa do backfill: as
-- saidas historicas sao reconstruidas de `ItemVenda`, e o saldo daquele
-- momento nunca foi gravado. Inventar um numero ali seria pior do que deixar
-- nulo e dizer que nao se sabe.

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "OrigemMovimentacaoEstoque" AS ENUM ('VENDA_PDV', 'PEDIDO_VENDA', 'ESTORNO_VENDA', 'CADASTRO', 'AJUSTE_MANUAL', 'COMPRA_XML', 'INVENTARIO', 'HISTORICO_RECONSTRUIDO');

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "origem" "OrigemMovimentacaoEstoque" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "saldoAnterior" INTEGER,
    "saldoPosterior" INTEGER,
    "custoUnitario" DECIMAL(12,2),
    "vendaId" TEXT,
    "observacao" TEXT,
    "registradoPorId" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_produtoId_criadoEm_idx" ON "MovimentacaoEstoque"("produtoId", "criadoEm");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_criadoEm_idx" ON "MovimentacaoEstoque"("criadoEm");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_origem_idx" ON "MovimentacaoEstoque"("origem");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_vendaId_idx" ON "MovimentacaoEstoque"("vendaId");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
