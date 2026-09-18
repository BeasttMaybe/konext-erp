-- 1. Coluna aditiva: a conta responsavel pela loja (Fase 1D-3, protecao do
--    dono). Nula ate o backfill abaixo (e continua nula pra uma empresa sem
--    nenhum ADMIN ativo, caso que nao deveria existir dada a invariante da
--    Fase 1D-1, mas o backfill nao inventa titular pra quem nao tem).
-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "proprietarioUsuarioEmpresaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_proprietarioUsuarioEmpresaId_key" ON "Empresa"("proprietarioUsuarioEmpresaId");

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_proprietarioUsuarioEmpresaId_fkey" FOREIGN KEY ("proprietarioUsuarioEmpresaId") REFERENCES "UsuarioEmpresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Backfill: o dono de cada empresa e o vinculo ADMIN ativo mais antigo —
--    a conta que criou a empresa. DISTINCT ON com ORDER BY "criadoEm" ASC
--    pega exatamente uma linha por empresa, a mais velha. Nunca inferir isso
--    por data em nenhum outro lugar do codigo — dali em diante, so este campo.
UPDATE "Empresa" e
SET "proprietarioUsuarioEmpresaId" = mais_antigo.id
FROM (
  SELECT DISTINCT ON (ue."empresaId") ue.id, ue."empresaId"
  FROM "UsuarioEmpresa" ue
  WHERE ue.role = 'ADMIN' AND ue.ativo = true
  ORDER BY ue."empresaId", ue."criadoEm" ASC
) AS mais_antigo
WHERE e.id = mais_antigo."empresaId";
