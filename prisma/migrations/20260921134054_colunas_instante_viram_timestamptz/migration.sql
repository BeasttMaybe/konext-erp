-- Fase 2A-1: toda coluna classificada como INSTANTE (ver inventario da
-- Parte 1) vira timestamptz(3). Gerada por
--   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- contra o tenant de TESTE (ep-purple-field-aq2o0ful) e editada A MAO na
-- sequencia: toda clausula "ALTER COLUMN ... SET DATA TYPE TIMESTAMPTZ(3)"
-- gerada pelo Prisma ganhou "USING "coluna" AT TIME ZONE 'UTC'" logo depois
-- (o Prisma, sozinho, faz so um cast direto, sem essa clausula). O valor ja
-- gravado numa coluna "timestamp without time zone" sempre foi lido pelo
-- Prisma como se ja fosse UTC (nunca converteu fuso) — "AT TIME ZONE 'UTC'"
-- reproduz exatamente essa mesma suposicao ao marcar o fuso, entao NAO
-- desloca nenhum instante ja gravado, so anota o fuso que ja estava
-- implicito. Mesmo precedente documentado na secao 7 de
-- docs/operacao/migrations.md (migracao 20260918120000_adicionar_etapa_situacao_os).
--
-- Colunas de DATA DE CALENDARIO (dataVencimento, dataPrazo, dataInicio,
-- dataEmissao, validade, proximoContato, vencimento, Oportunidade.dataFechamento
-- por ser ambiguo) foram deixadas de fora de proposito — ver relatorio da
-- Fase 2A-1 pra cada uma.
--
-- AlterTable
ALTER TABLE "CaixaSession" ALTER COLUMN "dataAbertura" SET DATA TYPE TIMESTAMPTZ(3) USING "dataAbertura" AT TIME ZONE 'UTC',
ALTER COLUMN "dataFechamento" SET DATA TYPE TIMESTAMPTZ(3) USING "dataFechamento" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Cliente" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Conta" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ContaReceber" ALTER COLUMN "dataRecebimento" SET DATA TYPE TIMESTAMPTZ(3) USING "dataRecebimento" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "dataFinalizacao" SET DATA TYPE TIMESTAMPTZ(3) USING "dataFinalizacao" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Despesa" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "HistoricoMeta" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ItemChecklistMeta" ALTER COLUMN "concluidoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "concluidoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ItemOS" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "LogAuditoria" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Meta" ALTER COLUMN "ultimaSincronizacaoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "ultimaSincronizacaoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "excluidaEm" SET DATA TYPE TIMESTAMPTZ(3) USING "excluidaEm" AT TIME ZONE 'UTC',
ALTER COLUMN "concluidaEm" SET DATA TYPE TIMESTAMPTZ(3) USING "concluidaEm" AT TIME ZONE 'UTC',
ALTER COLUMN "canceladaEm" SET DATA TYPE TIMESTAMPTZ(3) USING "canceladaEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "NotaFiscal" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Notificacao" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Oportunidade" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "OrdemServico" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "archivedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "excluidaEm" SET DATA TYPE TIMESTAMPTZ(3) USING "excluidaEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ParcelaDespesa" ALTER COLUMN "dataPagamento" SET DATA TYPE TIMESTAMPTZ(3) USING "dataPagamento" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "PedidoVenda" ALTER COLUMN "dataCriacao" SET DATA TYPE TIMESTAMPTZ(3) USING "dataCriacao" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "PedidoVendaItem" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "PedidoVendaParcela" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Produto" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "PropostaComercial" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "PropostaItem" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "RetornoGarantiaOS" ALTER COLUMN "finalizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "finalizadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "TecnicoOS" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "TermoGarantiaOS" ALTER COLUMN "dataInicioGarantia" SET DATA TYPE TIMESTAMPTZ(3) USING "dataInicioGarantia" AT TIME ZONE 'UTC',
ALTER COLUMN "dataFimGarantia" SET DATA TYPE TIMESTAMPTZ(3) USING "dataFimGarantia" AT TIME ZONE 'UTC',
ALTER COLUMN "canceladaEm" SET DATA TYPE TIMESTAMPTZ(3) USING "canceladaEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Venda" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "VendaPagamento" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

