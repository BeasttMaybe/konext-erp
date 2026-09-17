-- Suporte a multipagamento no PDV com fallback legado por Venda.formaPagamento

-- 1) Remover restricao de 1:1 entre ContaReceber e Venda
DROP INDEX IF EXISTS "ContaReceber_vendaId_key";

-- 2) Criar tabela de pagamentos por venda
CREATE TABLE IF NOT EXISTS "VendaPagamento" (
  "id" TEXT NOT NULL,
  "vendaId" TEXT NOT NULL,
  "formaPagamento" "FormaPagamento" NOT NULL,
  "valorBruto" DOUBLE PRECISION NOT NULL,
  "percentualTaxa" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorTaxa" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorLiquido" DOUBLE PRECISION NOT NULL,
  "parcelas" INTEGER NOT NULL DEFAULT 1,
  "diasVencimento" INTEGER,
  "dataVencimento" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendaPagamento_pkey" PRIMARY KEY ("id")
);

-- 3) Adicionar vinculo opcional de ContaReceber para o pagamento especifico
ALTER TABLE "ContaReceber"
ADD COLUMN IF NOT EXISTS "vendaPagamentoId" TEXT;

-- 4) Indices
CREATE INDEX IF NOT EXISTS "ContaReceber_vendaId_idx" ON "ContaReceber"("vendaId");
CREATE UNIQUE INDEX IF NOT EXISTS "ContaReceber_vendaPagamentoId_key" ON "ContaReceber"("vendaPagamentoId");
CREATE INDEX IF NOT EXISTS "VendaPagamento_vendaId_idx" ON "VendaPagamento"("vendaId");
CREATE INDEX IF NOT EXISTS "VendaPagamento_formaPagamento_idx" ON "VendaPagamento"("formaPagamento");
CREATE INDEX IF NOT EXISTS "VendaPagamento_dataVencimento_idx" ON "VendaPagamento"("dataVencimento");
CREATE INDEX IF NOT EXISTS "VendaPagamento_criadoEm_idx" ON "VendaPagamento"("criadoEm");

-- 5) Chaves estrangeiras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VendaPagamento_vendaId_fkey'
  ) THEN
    ALTER TABLE "VendaPagamento"
    ADD CONSTRAINT "VendaPagamento_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "Venda"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ContaReceber_vendaPagamentoId_fkey'
  ) THEN
    ALTER TABLE "ContaReceber"
    ADD CONSTRAINT "ContaReceber_vendaPagamentoId_fkey"
    FOREIGN KEY ("vendaPagamentoId") REFERENCES "VendaPagamento"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
