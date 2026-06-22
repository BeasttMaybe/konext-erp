-- CreateEnum
CREATE TYPE "ResultadoRetornoGarantia" AS ENUM ('PROCEDENTE', 'IMPROCEDENTE', 'SEM_GARANTIA', 'RESOLVIDO_SEM_TROCA', 'TROCA_REALIZADA', 'COBRANCA_ADICIONAL', 'EM_ANALISE');

-- CreateEnum
CREATE TYPE "CategoriaMeta" AS ENUM ('FINANCEIRA', 'OPERACIONAL', 'COMERCIAL', 'ESTOQUE', 'ESTRUTURAL', 'EQUIPAMENTO', 'REFORMA', 'OUTRA');

-- CreateEnum
CREATE TYPE "TipoValorMeta" AS ENUM ('DINHEIRO', 'QUANTIDADE', 'PERCENTUAL', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "OrigemProgressoMeta" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "DirecaoMeta" AS ENUM ('MAIOR_MELHOR', 'MENOR_MELHOR');

-- CreateEnum
CREATE TYPE "FonteAutomaticaMeta" AS ENUM ('ORDENS_SERVICO', 'FINANCEIRO', 'PDV', 'VENDAS', 'ESTOQUE', 'GARANTIAS');

-- CreateEnum
CREATE TYPE "MetricaAutomaticaMeta" AS ENUM ('FATURAMENTO_OS', 'QUANTIDADE_OS_FINALIZADAS', 'QUANTIDADE_OS_CRIADAS', 'TICKET_MEDIO_OS', 'TAXA_RETORNO_GARANTIA', 'GARANTIAS_ATIVAS', 'RETORNOS_GARANTIA', 'FATURAMENTO_PDV', 'QUANTIDADE_VENDAS', 'RECEBIMENTOS_FINANCEIRO', 'DESPESAS_FINANCEIRO', 'QUANTIDADE_ITEM_ESTOQUE');

-- CreateEnum
CREATE TYPE "PrioridadeMeta" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "StatusMeta" AS ENUM ('EM_ANDAMENTO', 'ATENCAO', 'ATRASADA', 'CONCLUIDA', 'PAUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoHistoricoMeta" AS ENUM ('CRIACAO', 'ATUALIZACAO_PROGRESSO', 'ALTERACAO_STATUS', 'ALTERACAO_PRAZO', 'ALTERACAO_CHECKLIST', 'SINCRONIZACAO_AUTOMATICA', 'CONCLUSAO', 'PAUSA', 'CANCELAMENTO', 'OBSERVACAO');

-- AlterEnum
ALTER TYPE "StatusOS" ADD VALUE 'GARANTIA_RETORNO';

-- AlterTable
ALTER TABLE "OrdemServico" ADD COLUMN     "ehRetornoGarantia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "excluidaEm" TIMESTAMP(3),
ADD COLUMN     "excluidaPorId" TEXT,
ADD COLUMN     "motivoExclusao" TEXT,
ADD COLUMN     "osOrigemGarantiaId" TEXT,
ADD COLUMN     "prazoGarantiaDias" INTEGER,
ADD COLUMN     "retornoGarantiaId" TEXT,
ADD COLUMN     "statusAnterior" "StatusOS";

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "empresaId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "motivo" TEXT,
    "origem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermoGarantiaOS" (
    "id" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "prazoGarantiaDias" INTEGER NOT NULL DEFAULT 90,
    "dataInicioGarantia" TIMESTAMP(3) NOT NULL,
    "dataFimGarantia" TIMESTAMP(3) NOT NULL,
    "textoGarantia" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermoGarantiaOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetornoGarantiaOS" (
    "id" TEXT NOT NULL,
    "termoGarantiaId" TEXT NOT NULL,
    "osOrigemId" TEXT,
    "osRetornoId" TEXT,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "analiseTecnica" TEXT,
    "resultado" "ResultadoRetornoGarantia" NOT NULL DEFAULT 'EM_ANALISE',
    "descricaoServico" TEXT,
    "pecasAdicionais" TEXT,
    "houveTroca" BOOLEAN NOT NULL DEFAULT false,
    "houveCobranca" BOOLEAN NOT NULL DEFAULT false,
    "valorAdicional" DECIMAL(65,30),
    "observacoesTecnicas" TEXT,
    "finalizadoEm" TIMESTAMP(3),
    "finalizadoPorId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetornoGarantiaOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaMeta" NOT NULL,
    "tipoValor" "TipoValorMeta" NOT NULL,
    "origemProgresso" "OrigemProgressoMeta" NOT NULL DEFAULT 'MANUAL',
    "fonteAutomatica" "FonteAutomaticaMeta",
    "metricaAutomatica" "MetricaAutomaticaMeta",
    "configuracaoAutomatica" JSONB,
    "direcao" "DirecaoMeta" NOT NULL DEFAULT 'MAIOR_MELHOR',
    "valorAlvo" DOUBLE PRECISION,
    "valorAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidade" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataPrazo" TIMESTAMP(3),
    "ultimaSincronizacaoEm" TIMESTAMP(3),
    "erroSincronizacao" TEXT,
    "prioridade" "PrioridadeMeta" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusMeta" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "criadoPorId" TEXT,
    "excluidaEm" TIMESTAMP(3),
    "excluidaPorId" TEXT,
    "concluidaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemChecklistMeta" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemChecklistMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoMeta" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "tipo" "TipoHistoricoMeta" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorAnterior" DOUBLE PRECISION,
    "valorNovo" DOUBLE PRECISION,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_empresaId_idx" ON "LogAuditoria"("empresaId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_idx" ON "LogAuditoria"("entidade");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidadeId_idx" ON "LogAuditoria"("entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_acao_idx" ON "LogAuditoria"("acao");

-- CreateIndex
CREATE INDEX "LogAuditoria_criadoEm_idx" ON "LogAuditoria"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "TermoGarantiaOS_osId_key" ON "TermoGarantiaOS"("osId");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_dataFimGarantia_idx" ON "TermoGarantiaOS"("dataFimGarantia");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_dataInicioGarantia_idx" ON "TermoGarantiaOS"("dataInicioGarantia");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_criadoEm_idx" ON "TermoGarantiaOS"("criadoEm");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_canceladaEm_idx" ON "TermoGarantiaOS"("canceladaEm");

-- CreateIndex
CREATE UNIQUE INDEX "RetornoGarantiaOS_osRetornoId_key" ON "RetornoGarantiaOS"("osRetornoId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_termoGarantiaId_idx" ON "RetornoGarantiaOS"("termoGarantiaId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_osOrigemId_idx" ON "RetornoGarantiaOS"("osOrigemId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_osRetornoId_idx" ON "RetornoGarantiaOS"("osRetornoId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_criadoEm_idx" ON "RetornoGarantiaOS"("criadoEm");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_finalizadoEm_idx" ON "RetornoGarantiaOS"("finalizadoEm");

-- CreateIndex
CREATE INDEX "Meta_status_idx" ON "Meta"("status");

-- CreateIndex
CREATE INDEX "Meta_categoria_idx" ON "Meta"("categoria");

-- CreateIndex
CREATE INDEX "Meta_prioridade_idx" ON "Meta"("prioridade");

-- CreateIndex
CREATE INDEX "Meta_dataPrazo_idx" ON "Meta"("dataPrazo");

-- CreateIndex
CREATE INDEX "Meta_criadoEm_idx" ON "Meta"("criadoEm");

-- CreateIndex
CREATE INDEX "Meta_excluidaEm_idx" ON "Meta"("excluidaEm");

-- CreateIndex
CREATE INDEX "Meta_origemProgresso_idx" ON "Meta"("origemProgresso");

-- CreateIndex
CREATE INDEX "Meta_fonteAutomatica_idx" ON "Meta"("fonteAutomatica");

-- CreateIndex
CREATE INDEX "Meta_metricaAutomatica_idx" ON "Meta"("metricaAutomatica");

-- CreateIndex
CREATE INDEX "Meta_ultimaSincronizacaoEm_idx" ON "Meta"("ultimaSincronizacaoEm");

-- CreateIndex
CREATE INDEX "ItemChecklistMeta_metaId_idx" ON "ItemChecklistMeta"("metaId");

-- CreateIndex
CREATE INDEX "HistoricoMeta_metaId_idx" ON "HistoricoMeta"("metaId");

-- CreateIndex
CREATE INDEX "HistoricoMeta_tipo_idx" ON "HistoricoMeta"("tipo");

-- CreateIndex
CREATE INDEX "HistoricoMeta_criadoEm_idx" ON "HistoricoMeta"("criadoEm");

-- CreateIndex
CREATE INDEX "OrdemServico_retornoGarantiaId_idx" ON "OrdemServico"("retornoGarantiaId");

-- CreateIndex
CREATE INDEX "OrdemServico_excluidaEm_idx" ON "OrdemServico"("excluidaEm");

-- CreateIndex
CREATE INDEX "OrdemServico_excluidaPorId_idx" ON "OrdemServico"("excluidaPorId");

-- CreateIndex
CREATE INDEX "OrdemServico_ehRetornoGarantia_idx" ON "OrdemServico"("ehRetornoGarantia");

-- CreateIndex
CREATE INDEX "OrdemServico_osOrigemGarantiaId_idx" ON "OrdemServico"("osOrigemGarantiaId");

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_osOrigemGarantiaId_fkey" FOREIGN KEY ("osOrigemGarantiaId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_retornoGarantiaId_fkey" FOREIGN KEY ("retornoGarantiaId") REFERENCES "RetornoGarantiaOS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_excluidaPorId_fkey" FOREIGN KEY ("excluidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoGarantiaOS" ADD CONSTRAINT "TermoGarantiaOS_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoGarantiaOS" ADD CONSTRAINT "TermoGarantiaOS_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetornoGarantiaOS" ADD CONSTRAINT "RetornoGarantiaOS_termoGarantiaId_fkey" FOREIGN KEY ("termoGarantiaId") REFERENCES "TermoGarantiaOS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetornoGarantiaOS" ADD CONSTRAINT "RetornoGarantiaOS_osOrigemId_fkey" FOREIGN KEY ("osOrigemId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetornoGarantiaOS" ADD CONSTRAINT "RetornoGarantiaOS_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemChecklistMeta" ADD CONSTRAINT "ItemChecklistMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoMeta" ADD CONSTRAINT "HistoricoMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;


