-- Endereco cifrado do banco das lojas criadas pelo master. Tabela nova, so aditiva.

-- CreateTable
CREATE TABLE "ConexaoTenant" (
    "tenantId" TEXT NOT NULL,
    "conexaoCifrada" TEXT NOT NULL,
    "neonProjetoId" TEXT,
    "neonBancoNome" TEXT,
    "neonPapel" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConexaoTenant_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "ConexaoTenant" ADD CONSTRAINT "ConexaoTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
