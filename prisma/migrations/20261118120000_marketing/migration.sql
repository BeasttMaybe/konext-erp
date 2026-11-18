-- Marketing: conexoes de plataforma e publicacoes (posts/anuncios).
-- So cria coisas novas; nenhuma versao em producao le/escreve nelas ainda,
-- entao pode rodar antes ou depois do deploy.

-- CreateEnum
CREATE TYPE "PlataformaMarketing" AS ENUM ('META', 'GOOGLE_ADS', 'TIKTOK_ADS', 'GOOGLE_PERFIL');
CREATE TYPE "CanalMarketing" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'GOOGLE_PERFIL');
CREATE TYPE "StatusConexaoMarketing" AS ENUM ('NAO_CONFIGURADA', 'DESCONECTADA', 'CONECTADA', 'EXPIRADA', 'ERRO');
CREATE TYPE "TipoPublicacaoMarketing" AS ENUM ('POST_ORGANICO', 'ANUNCIO_PAGO');
CREATE TYPE "StatusPublicacaoMarketing" AS ENUM ('RASCUNHO', 'AGENDADA', 'PUBLICANDO', 'PUBLICADA', 'FALHOU', 'CANCELADA');
CREATE TYPE "StatusDestinoPublicacao" AS ENUM ('PENDENTE', 'PUBLICADA', 'FALHOU');

-- CreateTable
CREATE TABLE "ConexaoMarketing" (
    "id" TEXT NOT NULL,
    "plataforma" "PlataformaMarketing" NOT NULL,
    "status" "StatusConexaoMarketing" NOT NULL DEFAULT 'NAO_CONFIGURADA',
    "contaNome" TEXT,
    "contaExternaId" TEXT,
    "tokenCifrado" TEXT,
    "renovacaoCifrada" TEXT,
    "expiraEm" TIMESTAMPTZ(3),
    "escopos" TEXT,
    "ultimoErro" TEXT,
    "conectadoPorId" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConexaoMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConexaoMarketing_plataforma_key" ON "ConexaoMarketing"("plataforma");

-- CreateTable
CREATE TABLE "PublicacaoMarketing" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPublicacaoMarketing" NOT NULL DEFAULT 'POST_ORGANICO',
    "texto" TEXT NOT NULL,
    "status" "StatusPublicacaoMarketing" NOT NULL DEFAULT 'RASCUNHO',
    "agendadoPara" TIMESTAMPTZ(3),
    "publicadoEm" TIMESTAMPTZ(3),
    "ultimoErro" TEXT,
    "orcamentoCentavos" INTEGER,
    "linkDestino" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PublicacaoMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicacaoMarketing_status_agendadoPara_idx" ON "PublicacaoMarketing"("status", "agendadoPara");
CREATE INDEX "PublicacaoMarketing_criadoEm_idx" ON "PublicacaoMarketing"("criadoEm");

-- CreateTable
CREATE TABLE "PublicacaoMidia" (
    "id" TEXT NOT NULL,
    "publicacaoId" TEXT NOT NULL,
    "chaveArmazenamento" TEXT NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "largura" INTEGER,
    "altura" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicacaoMidia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicacaoMidia_chaveArmazenamento_key" ON "PublicacaoMidia"("chaveArmazenamento");
CREATE INDEX "PublicacaoMidia_publicacaoId_ordem_idx" ON "PublicacaoMidia"("publicacaoId", "ordem");

-- CreateTable
CREATE TABLE "PublicacaoDestino" (
    "id" TEXT NOT NULL,
    "publicacaoId" TEXT NOT NULL,
    "canal" "CanalMarketing" NOT NULL,
    "status" "StatusDestinoPublicacao" NOT NULL DEFAULT 'PENDENTE',
    "idExternoPublicado" TEXT,
    "erro" TEXT,
    "publicadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "PublicacaoDestino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicacaoDestino_publicacaoId_canal_key" ON "PublicacaoDestino"("publicacaoId", "canal");

-- AddForeignKey
ALTER TABLE "ConexaoMarketing" ADD CONSTRAINT "ConexaoMarketing_conectadoPorId_fkey" FOREIGN KEY ("conectadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicacaoMarketing" ADD CONSTRAINT "PublicacaoMarketing_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicacaoMidia" ADD CONSTRAINT "PublicacaoMidia_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "PublicacaoMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicacaoDestino" ADD CONSTRAINT "PublicacaoDestino_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "PublicacaoMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
