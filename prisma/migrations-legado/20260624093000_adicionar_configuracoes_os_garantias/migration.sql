ALTER TABLE "Configuracao"
ADD COLUMN "prazoGarantiaPadraoDias" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN "prazoMinimoGarantiaDias" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "prazoMaximoGarantiaDias" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN "exigirGarantiaAntesEntrega" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "exigirItemParaGarantia" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "exigirItemParaEnviarPDV" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "exigirDiagnosticoParaFinalizar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permitirFinalizarSemPagamento" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "permitirGarantiaPersonalizada" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "textoCoberturaGarantia" TEXT,
ADD COLUMN "textoExclusoesGarantia" TEXT,
ADD COLUMN "textoResponsabilidadeDados" TEXT;