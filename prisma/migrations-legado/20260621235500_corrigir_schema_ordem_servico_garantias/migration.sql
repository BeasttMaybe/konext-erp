-- Corrige divergencias de schema da tabela OrdemServico sem operacoes destrutivas.
-- Foco: campos usados nas features de garantia/retorno e exclusao logica.

ALTER TABLE "OrdemServico"
  ADD COLUMN IF NOT EXISTS "ehRetornoGarantia" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "osOrigemGarantiaId" TEXT,
  ADD COLUMN IF NOT EXISTS "retornoGarantiaId" TEXT,
  ADD COLUMN IF NOT EXISTS "excluidaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "excluidaPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoExclusao" TEXT,
  ADD COLUMN IF NOT EXISTS "statusAnterior" "StatusOS",
  ADD COLUMN IF NOT EXISTS "prazoGarantiaDias" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrdemServico_osOrigemGarantiaId_fkey'
  ) THEN
    ALTER TABLE "OrdemServico"
      ADD CONSTRAINT "OrdemServico_osOrigemGarantiaId_fkey"
      FOREIGN KEY ("osOrigemGarantiaId") REFERENCES "OrdemServico"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrdemServico_retornoGarantiaId_fkey'
  ) THEN
    ALTER TABLE "OrdemServico"
      ADD CONSTRAINT "OrdemServico_retornoGarantiaId_fkey"
      FOREIGN KEY ("retornoGarantiaId") REFERENCES "RetornoGarantiaOS"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrdemServico_excluidaPorId_fkey'
  ) THEN
    ALTER TABLE "OrdemServico"
      ADD CONSTRAINT "OrdemServico_excluidaPorId_fkey"
      FOREIGN KEY ("excluidaPorId") REFERENCES "Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "OrdemServico_retornoGarantiaId_key"
  ON "OrdemServico"("retornoGarantiaId");

CREATE INDEX IF NOT EXISTS "OrdemServico_ehRetornoGarantia_idx"
  ON "OrdemServico"("ehRetornoGarantia");

CREATE INDEX IF NOT EXISTS "OrdemServico_osOrigemGarantiaId_idx"
  ON "OrdemServico"("osOrigemGarantiaId");

CREATE INDEX IF NOT EXISTS "OrdemServico_excluidaEm_idx"
  ON "OrdemServico"("excluidaEm");

CREATE INDEX IF NOT EXISTS "OrdemServico_excluidaPorId_idx"
  ON "OrdemServico"("excluidaPorId");
