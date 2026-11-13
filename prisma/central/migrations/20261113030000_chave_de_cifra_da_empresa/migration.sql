-- Chave de cifra de cada loja (dados sensiveis do banco do tenant, como a
-- senha do aparelho). Tabela nova, so aditiva.
-- CreateTable
CREATE TABLE "ChaveDeCifraEmpresa" (
    "empresaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaveDeCifraEmpresa_pkey" PRIMARY KEY ("empresaId")
);

-- AddForeignKey
ALTER TABLE "ChaveDeCifraEmpresa" ADD CONSTRAINT "ChaveDeCifraEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
