-- Prefeitura: frete e aliquota de imposto por nota, para o lucro liquido.
-- So adiciona duas colunas opcionais na NotaFiscal; nao altera nem remove nada.

-- AlterTable
ALTER TABLE "NotaFiscal"
    ADD COLUMN "freteInformado" DECIMAL(12,2),
    ADD COLUMN "impostoPercentual" DECIMAL(5,2);
