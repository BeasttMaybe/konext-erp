import "server-only";

import type { PrismaClient } from "@prisma/client";

import { montarRelatorioDeTaxas, type LinhaDeTaxa, type RelatorioDeTaxas } from "@/lib/dominio/financeiro/taxas-de-cartao";

/**
 * Taxas de cartao das vendas feitas entre `inicio` e `fim` (instantes), sem
 * as vendas estornadas. Regras e motivo em lib/dominio/financeiro/taxas-de-cartao.ts.
 */
export async function taxasDoPeriodo(
  prisma: Pick<PrismaClient, "$queryRaw">,
  inicio: Date,
  fim: Date
): Promise<RelatorioDeTaxas> {
  const linhas = await prisma.$queryRaw<LinhaDeTaxa[]>`
    SELECT vp."formaPagamento"::text AS forma,
           vp.parcelas AS parcelas,
           COALESCE(SUM(vp."valorBruto"), 0) AS bruto,
           COALESCE(SUM(vp."valorTaxa"), 0) AS taxa,
           COUNT(*)::int AS quantidade
      FROM "VendaPagamento" vp
      JOIN "Venda" v ON v.id = vp."vendaId"
     WHERE v."criadoEm" >= ${inicio}
       AND v."criadoEm" <= ${fim}
       AND v."estornadaEm" IS NULL
       AND vp."valorTaxa" > 0
     GROUP BY vp."formaPagamento", vp.parcelas
  `;
  return montarRelatorioDeTaxas(linhas.map((l) => ({ ...l, bruto: String(l.bruto), taxa: String(l.taxa) })));
}
