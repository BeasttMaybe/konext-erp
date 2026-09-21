-- Fase 2A-1: mesma conversao de prisma/migrations/20260921134054_colunas_instante_viram_timestamptz
-- (ver o cabecalho la pra explicacao completa), aplicada ao banco CENTRAL.
-- Toda coluna INSTANTE do inventario da Parte 1 vira timestamptz(3), com
-- "USING "coluna" AT TIME ZONE 'UTC'" adicionado A MAO em cada
-- ALTER COLUMN (o Prisma gera so o cast direto). Nao ha coluna de DATA DE
-- CALENDARIO no banco central — todo DateTime daqui e criadoEm/atualizadoEm/
-- expiraEm/revogadaEm/ultimoUsoEm/arquivadoEm, todos instantes.
--
-- AlterTable
ALTER TABLE "Cargo" ALTER COLUMN "arquivadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "arquivadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Empresa" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "LogAuditoria" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "SessaoCentral" ALTER COLUMN "expiraEm" SET DATA TYPE TIMESTAMPTZ(3) USING "expiraEm" AT TIME ZONE 'UTC',
ALTER COLUMN "revogadaEm" SET DATA TYPE TIMESTAMPTZ(3) USING "revogadaEm" AT TIME ZONE 'UTC',
ALTER COLUMN "ultimoUsoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "ultimoUsoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "UsuarioCentral" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "UsuarioEmpresa" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

