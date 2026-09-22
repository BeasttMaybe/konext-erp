-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "chaveIdempotencia" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Venda_chaveIdempotencia_key" ON "Venda"("chaveIdempotencia");

