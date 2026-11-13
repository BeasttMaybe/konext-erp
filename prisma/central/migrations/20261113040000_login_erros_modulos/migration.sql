-- Quatro tabelas novas, so aditivas:
-- TentativaLoginFalha (limite de tentativas de login), TokenRecuperacaoSenha
-- (esqueci minha senha), ErroDoSistema (aviso automatico de erros) e
-- ModuloEmpresa (modulos por loja; sem linha = ligado).

-- CreateTable
CREATE TABLE "TentativaLoginFalha" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaLoginFalha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRecuperacaoSenha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRecuperacaoSenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErroDoSistema" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "origem" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "digest" TEXT,
    "avisadoEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErroDoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuloEmpresa" (
    "empresaId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModuloEmpresa_pkey" PRIMARY KEY ("empresaId","modulo")
);

-- CreateIndex
CREATE INDEX "TentativaLoginFalha_emailHash_criadoEm_idx" ON "TentativaLoginFalha"("emailHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaLoginFalha_ipHash_criadoEm_idx" ON "TentativaLoginFalha"("ipHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaLoginFalha_criadoEm_idx" ON "TentativaLoginFalha"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacaoSenha_tokenHash_key" ON "TokenRecuperacaoSenha"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRecuperacaoSenha_usuarioId_criadoEm_idx" ON "TokenRecuperacaoSenha"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "ErroDoSistema_criadoEm_idx" ON "ErroDoSistema"("criadoEm");

-- CreateIndex
CREATE INDEX "ErroDoSistema_empresaId_criadoEm_idx" ON "ErroDoSistema"("empresaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "TokenRecuperacaoSenha" ADD CONSTRAINT "TokenRecuperacaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioCentral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloEmpresa" ADD CONSTRAINT "ModuloEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
