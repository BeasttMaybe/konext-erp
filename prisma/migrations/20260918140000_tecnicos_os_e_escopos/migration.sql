-- AlterTable
ALTER TABLE "CaixaSession" ADD COLUMN     "abertoPorId" TEXT;

-- AlterTable
ALTER TABLE "ContaReceber" ADD COLUMN     "criadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Despesa" ADD COLUMN     "criadoPorId" TEXT;

-- AlterTable
ALTER TABLE "OrdemServico" ADD COLUMN     "criadoPorId" TEXT;

-- CreateTable
CREATE TABLE "TecnicoOS" (
    "id" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "participacaoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TecnicoOS_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TecnicoOS_usuarioId_idx" ON "TecnicoOS"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TecnicoOS_osId_usuarioId_key" ON "TecnicoOS"("osId", "usuarioId");

-- CreateIndex
CREATE INDEX "CaixaSession_abertoPorId_idx" ON "CaixaSession"("abertoPorId");

-- CreateIndex
CREATE INDEX "ContaReceber_criadoPorId_idx" ON "ContaReceber"("criadoPorId");

-- CreateIndex
CREATE INDEX "Despesa_criadoPorId_idx" ON "Despesa"("criadoPorId");

-- CreateIndex
CREATE INDEX "OrdemServico_criadoPorId_idx" ON "OrdemServico"("criadoPorId");

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TecnicoOS" ADD CONSTRAINT "TecnicoOS_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TecnicoOS" ADD CONSTRAINT "TecnicoOS_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaSession" ADD CONSTRAINT "CaixaSession_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

