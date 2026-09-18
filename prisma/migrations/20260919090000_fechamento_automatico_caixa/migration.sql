-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "fechamentoAutomaticoCaixaAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechamentoAutomaticoCaixaHorario" TEXT NOT NULL DEFAULT '23:59';
