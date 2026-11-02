-- Fase 2A-3: as quatro ultimas colunas Float do schema viram DECIMAL(14,4).
--
-- Sao as colunas que a Fase 2A-2 (20260922120000_dinheiro_vira_decimal)
-- deixou DE FORA de proposito, e o comentario de la explica por que: elas
-- sao polimorficas — Meta.valorAlvo/valorAtual representam dinheiro,
-- quantidade OU percentual dependendo de Meta.tipoValor em tempo de
-- execucao, e HistoricoMeta.valorAnterior/valorNovo guardam os dois lados
-- da mudanca desses mesmos campos. Nao eram "dinheiro" no sentido daquela
-- fase, e a decisao de escala ficou pendente.
--
-- Escala 4 porque atende os tres usos sem precisar de coluna por tipo:
--   DINHEIRO   -> 2 casas bastam, e round(x, 4) nao muda nada que ja tem 2
--   PERCENTUAL -> 4 casas e a convencao do projeto (Decimal(7,4))
--   QUANTIDADE -> quase sempre inteira
-- Precisao 14 deixa 10 digitos inteiros: meta de ate dez bilhoes.
--
-- `USING round("coluna"::numeric, 4)` segue o mesmo precedente da Fase 2A-2
-- e da 20260921134054 (timestamptz): nunca deixar o Prisma fazer so um cast
-- cru quando o valor de origem pode ter ruido. Um double guardando
-- 1409.8899999999999 viraria um Decimal com o MESMO ruido, so que agora
-- fixo pra sempre no tipo; o round arredonda ANTES de converter.
-- Ver docs/operacao/migrations.md, secao 5.3.

-- AlterTable
ALTER TABLE "Meta" ALTER COLUMN "valorAlvo" SET DATA TYPE DECIMAL(14,4) USING round("valorAlvo"::numeric, 4),
ALTER COLUMN "valorAtual" SET DATA TYPE DECIMAL(14,4) USING round("valorAtual"::numeric, 4);

-- AlterTable
ALTER TABLE "HistoricoMeta" ALTER COLUMN "valorAnterior" SET DATA TYPE DECIMAL(14,4) USING round("valorAnterior"::numeric, 4),
ALTER COLUMN "valorNovo" SET DATA TYPE DECIMAL(14,4) USING round("valorNovo"::numeric, 4);
