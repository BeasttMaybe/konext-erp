-- Acesso ao sistema master (pasta master/). Tabelas novas, so aditivas.

-- CreateTable
CREATE TABLE "AdministradorMaster" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdministradorMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoMaster" (
    "id" TEXT NOT NULL,
    "administradorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "revogadaEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdministradorMaster_email_key" ON "AdministradorMaster"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoMaster_tokenHash_key" ON "SessaoMaster"("tokenHash");

-- CreateIndex
CREATE INDEX "SessaoMaster_administradorId_idx" ON "SessaoMaster"("administradorId");

-- AddForeignKey
ALTER TABLE "SessaoMaster" ADD CONSTRAINT "SessaoMaster_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "AdministradorMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
