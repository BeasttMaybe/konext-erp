-- Historico das acoes feitas pelo sistema master. Tabela nova, so aditiva.

-- CreateTable
CREATE TABLE "RegistroMaster" (
    "id" TEXT NOT NULL,
    "administradorId" TEXT NOT NULL,
    "empresaId" TEXT,
    "acao" TEXT NOT NULL,
    "detalhes" JSONB,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroMaster_empresaId_criadoEm_idx" ON "RegistroMaster"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroMaster_criadoEm_idx" ON "RegistroMaster"("criadoEm");

-- AddForeignKey
ALTER TABLE "RegistroMaster" ADD CONSTRAINT "RegistroMaster_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "AdministradorMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
