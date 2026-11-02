-- Fase 2A-3 (regra de estorno de venda).
--
-- Migration ADITIVA: um valor novo de enum e tres colunas anulaveis. O
-- codigo do build anterior nao conhece nenhum dos quatro e nao e afetado —
-- nenhuma linha usa ESTORNADO antes do codigo novo subir. Entao vale a
-- ordem normal do projeto: banco primeiro, codigo depois.
--
-- O que ela destrava:
--
-- 1. `ContaReceber.estornadaEm` + `StatusPagamento.ESTORNADO`. O
--    `cancelarPedido` fazia `deleteMany` nas contas a receber da venda: nao
--    sobrava rastro de que a venda existiu e foi cancelada, e nenhum log de
--    auditoria era gravado. Agora a conta e MARCADA.
--
-- 2. `Venda.estornadaEm` + `Venda.estornoCaixaSessionId`. O esperado de
--    fechamento de uma sessao de caixa e recalculado AO VIVO somando as
--    vendas dela (ver obterResumoCaixaDiario). Se o estorno tirasse a venda
--    da sessao, a diferenca de fechamento de uma sessao JA CONFERIDA mudaria
--    dias depois, sem nada explicando. Entao a venda nunca sai da sessao
--    dela, e o estorno e um movimento separado, atribuido a sessao aberta no
--    momento do estorno — que e de onde o dinheiro sai da gaveta.
--
-- `estornadaEm` na venda tambem e o filtro que tira venda cancelada da
-- apuracao de receita, que hoje NAO filtra nada: uma venda cancelada conta
-- como receita pra sempre nas queries de regras-financeiras.ts,
-- financeiro-fluxo.ts e dashboard.ts.
--
-- Ver lib/dominio/financeiro/estorno.ts para a regra e seus testes.

-- AlterEnum
ALTER TYPE "StatusPagamento" ADD VALUE 'ESTORNADO';

-- AlterTable
ALTER TABLE "ContaReceber" ADD COLUMN     "estornadaEm" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "estornadaEm" TIMESTAMPTZ(3),
ADD COLUMN     "estornoCaixaSessionId" TEXT;

-- CreateIndex
CREATE INDEX "Venda_estornadaEm_idx" ON "Venda"("estornadaEm");

-- CreateIndex
CREATE INDEX "Venda_estornoCaixaSessionId_idx" ON "Venda"("estornoCaixaSessionId");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_estornoCaixaSessionId_fkey" FOREIGN KEY ("estornoCaixaSessionId") REFERENCES "CaixaSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
