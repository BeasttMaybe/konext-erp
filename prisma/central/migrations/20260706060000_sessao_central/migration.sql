-- Sessao central opaca para autenticacao multiempresa em modo de transicao.
-- O cookie guarda apenas o token aleatorio; o banco central guarda somente o hash.

CREATE TABLE "SessaoCentral" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioCentralId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "RoleEmpresa" NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "ultimoUsoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessaoCentral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessaoCentral_tokenHash_key" ON "SessaoCentral"("tokenHash");
CREATE INDEX "SessaoCentral_usuarioCentralId_idx" ON "SessaoCentral"("usuarioCentralId");
CREATE INDEX "SessaoCentral_empresaId_idx" ON "SessaoCentral"("empresaId");
CREATE INDEX "SessaoCentral_tenantId_idx" ON "SessaoCentral"("tenantId");
CREATE INDEX "SessaoCentral_expiraEm_idx" ON "SessaoCentral"("expiraEm");
CREATE INDEX "SessaoCentral_revogadaEm_idx" ON "SessaoCentral"("revogadaEm");
