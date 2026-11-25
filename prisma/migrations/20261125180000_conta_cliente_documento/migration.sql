-- Caixa da Prefeitura: guarda o CNPJ/CPF do cliente na conta a receber, para
-- agrupar as contas por documento (prefeitura) sem depender de cadastro.
-- So adiciona uma coluna opcional e um indice.

-- AlterTable
ALTER TABLE "ContaReceber" ADD COLUMN "clienteDocumento" TEXT;

-- CreateIndex
CREATE INDEX "ContaReceber_clienteDocumento_idx" ON "ContaReceber"("clienteDocumento");
