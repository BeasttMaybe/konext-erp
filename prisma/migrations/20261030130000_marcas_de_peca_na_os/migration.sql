-- CreateTable
CREATE TABLE "MarcaPeca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MarcaPeca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarcaPeca_nomeNormalizado_key" ON "MarcaPeca"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "MarcaPeca_ativa_idx" ON "MarcaPeca"("ativa");

-- AlterTable
ALTER TABLE "ItemOS" ADD COLUMN     "marcaPecaId" TEXT;

-- CreateIndex
CREATE INDEX "ItemOS_marcaPecaId_idx" ON "ItemOS"("marcaPecaId");

-- AddForeignKey
ALTER TABLE "ItemOS" ADD CONSTRAINT "ItemOS_marcaPecaId_fkey" FOREIGN KEY ("marcaPecaId") REFERENCES "MarcaPeca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
