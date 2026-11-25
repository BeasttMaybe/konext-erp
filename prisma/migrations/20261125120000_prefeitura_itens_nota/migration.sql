-- Modulo Prefeitura: itens da nota com custo + segmento comercial.
-- So cria coisas novas (uma tabela, dois enums) e adiciona colunas opcionais
-- (ou com default) na NotaFiscal; nenhuma versao em producao le/escreve nelas
-- ainda, entao pode rodar antes ou depois do deploy.

-- CreateEnum
CREATE TYPE "SegmentoComercial" AS ENUM ('PREFEITURA');

-- CreateEnum
CREATE TYPE "ModoCustoNota" AS ENUM ('ITENS', 'TOTAL');

-- AlterTable
ALTER TABLE "NotaFiscal"
    ADD COLUMN "segmento" "SegmentoComercial",
    ADD COLUMN "segmentoManual" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "modoCusto" "ModoCustoNota" NOT NULL DEFAULT 'ITENS',
    ADD COLUMN "custoTotalInformado" DECIMAL(12,2),
    ADD COLUMN "impostosReais" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "NotaFiscalItem" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "valorUnitarioVenda" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotalVenda" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "custoTotal" DECIMAL(12,2),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotaFiscalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaFiscalItem_notaFiscalId_idx" ON "NotaFiscalItem"("notaFiscalId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalItem_notaFiscalId_ordem_key" ON "NotaFiscalItem"("notaFiscalId", "ordem");

-- CreateIndex
CREATE INDEX "NotaFiscal_segmento_idx" ON "NotaFiscal"("segmento");

-- AddForeignKey
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
