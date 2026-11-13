-- Agenda: compromissos marcados pela equipe (lib/dominio/agenda/agenda.ts).
--
-- So cria tabela: nenhuma versao em producao le ou escreve nela, entao a
-- migration pode rodar antes ou depois do deploy sem quebrar nada.

-- CreateTable
CREATE TABLE "Compromisso" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3),
    "diaInteiro" BOOLEAN NOT NULL DEFAULT false,
    "avisarMinutosAntes" INTEGER,
    "avisadoEm" TIMESTAMPTZ(3),
    "concluidoEm" TIMESTAMPTZ(3),
    "canceladoEm" TIMESTAMPTZ(3),
    "clienteId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Compromisso_inicio_idx" ON "Compromisso"("inicio");

-- CreateIndex
CREATE INDEX "Compromisso_clienteId_idx" ON "Compromisso"("clienteId");

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
