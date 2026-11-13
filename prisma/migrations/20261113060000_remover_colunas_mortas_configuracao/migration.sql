-- Segunda metade da remocao de chavePix e habilitarMargemAutomatica
-- (docs/operacao/migrations.md §5.4). Nenhum codigo as le desde #31, e o
-- deploy no ar e muito posterior (confirmado pelo status de producao da
-- Vercel no commit de main antes desta migration ser aplicada). O build que
-- tira as duas do schema vai ao ar ANTES do drop.
-- AlterTable
ALTER TABLE "Configuracao" DROP COLUMN "chavePix",
DROP COLUMN "habilitarMargemAutomatica";
