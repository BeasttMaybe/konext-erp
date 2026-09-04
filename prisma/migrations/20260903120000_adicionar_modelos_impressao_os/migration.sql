-- Adiciona selecao de modelo de impressao da OS (A4 / termica 80mm) em Configuracao.
-- Migracao nao destrutiva.

CREATE TYPE "ModeloImpressaoOS" AS ENUM ('A4', 'TERMICA_80MM');

ALTER TABLE "Configuracao"
  ADD COLUMN "modeloImpressaoOSPadrao" "ModeloImpressaoOS" NOT NULL DEFAULT 'A4',
  ADD COLUMN "imprimirLogoTermica" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "mensagemRodapeImpressaoOS" TEXT;
