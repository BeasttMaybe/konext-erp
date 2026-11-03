-- Registrar a resposta do cliente a uma proposta comercial.
--
-- Migration ADITIVA: tres colunas anulaveis e um indice. Nenhuma coluna
-- existente e alterada e nenhum dado precisa de backfill, entao o codigo do
-- build anterior nao e afetado e vale a ordem normal: banco primeiro, codigo
-- depois.
--
-- Por que existe: o enum `StatusPropostaComercial` tem quatro valores, mas a
-- unica acao do sistema (`createProposta`) grava RASCUNHO ou ENVIADA. APROVADA
-- e REJEITADA eram inalcancaveis — nenhuma linha de codigo escrevia esses dois
-- valores. Na pratica toda proposta ficava congelada em ENVIADA pra sempre, e
-- nao havia como saber quantos orcamentos a loja fecha nem por que perde os
-- outros.
--
-- `respondidaEm` e separado de `atualizadoEm` de proposito: `atualizadoEm`
-- muda a cada correcao de texto, entao nao mede nada. A data da resposta mede
-- quanto tempo o cliente leva pra decidir.
--
-- `enviadaEm` existe porque "ENVIADA" tambem nao tinha data: a validade conta
-- da emissao, mas o relogio do follow-up conta de quando a proposta saiu.

-- AlterTable
ALTER TABLE "PropostaComercial"
  ADD COLUMN "respondidaEm" TIMESTAMPTZ(3),
  ADD COLUMN "motivoResposta" TEXT,
  ADD COLUMN "enviadaEm" TIMESTAMPTZ(3);

-- CreateIndex
-- A lista passa a ordenar e filtrar por validade (vencendo/vencida), sempre
-- junto com o status.
CREATE INDEX "PropostaComercial_status_validade_idx" ON "PropostaComercial"("status", "validade");
