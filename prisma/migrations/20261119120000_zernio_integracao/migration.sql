-- Integracao de marketing via Zernio.
-- So cria coisas novas (uma tabela) e adiciona uma coluna opcional; nenhuma
-- versao em producao le/escreve nelas ainda, entao pode rodar antes ou depois
-- do deploy.

-- CreateTable
CREATE TABLE "IntegracaoZernio" (
    "id" TEXT NOT NULL,
    "chaveCifrada" TEXT NOT NULL,
    "conectadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conectadoPor" TEXT,
    "ultimoErro" TEXT,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IntegracaoZernio_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PublicacaoMarketing" ADD COLUMN "zernioPostId" TEXT;
