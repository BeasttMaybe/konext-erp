-- CreateEnum
CREATE TYPE "EtapaOS" AS ENUM ('ORCAMENTO', 'CONSERTO', 'PRONTO', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "SituacaoOS" AS ENUM ('AGUARDANDO_APROVACAO', 'AGUARDANDO_PECA');

-- AlterTable
ALTER TABLE "OrdemServico" ADD COLUMN     "etapa" "EtapaOS" NOT NULL DEFAULT 'ORCAMENTO',
ADD COLUMN     "situacao" "SituacaoOS";

-- CreateIndex
CREATE INDEX "OrdemServico_etapa_idx" ON "OrdemServico"("etapa");

-- Backfill: preenche etapa/situacao a partir do status legado (mesma tabela de
-- mapeamento de lib/dominio/os/etapas.ts, coberta por
-- lib/dominio/os/etapas.test.ts). "status" nao e alterado nem lido daqui em
-- diante pela aplicacao -- ver docs/operacao/migrations.md.
UPDATE "OrdemServico" SET "etapa" = 'ORCAMENTO', "situacao" = NULL
  WHERE "status" = 'AGUARDANDO_ORCAMENTO';
UPDATE "OrdemServico" SET "etapa" = 'ORCAMENTO', "situacao" = 'AGUARDANDO_APROVACAO'
  WHERE "status" = 'AGUARDANDO_APROVACAO';
UPDATE "OrdemServico" SET "etapa" = 'CONSERTO', "situacao" = NULL
  WHERE "status" IN ('APROVADO', 'EM_MANUTENCAO', 'GARANTIA_RETORNO');
UPDATE "OrdemServico" SET "etapa" = 'CONSERTO', "situacao" = 'AGUARDANDO_PECA'
  WHERE "status" = 'AGUARDANDO_PECA';
UPDATE "OrdemServico" SET "etapa" = 'PRONTO', "situacao" = NULL
  WHERE "status" = 'PRONTO';
UPDATE "OrdemServico" SET "etapa" = 'ENTREGUE', "situacao" = NULL
  WHERE "status" = 'ENTREGUE';

