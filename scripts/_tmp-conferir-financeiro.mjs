import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const AGORA = new Date();
const INICIO = new Date(AGORA.getFullYear(), AGORA.getMonth() - 11, 1, 0, 0, 0, 0);
const SOMENTE_MARCADAS = process.argv.includes("--marcadas");
const LIKE = SOMENTE_MARCADAS ? "seed-demo-%" : "%";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  log: ["error"],
});

function rotulos() {
  const lista = [];
  for (let m = 0; m < 12; m += 1) {
    const d = new Date(AGORA.getFullYear(), AGORA.getMonth() - (11 - m), 1);
    lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return lista;
}

function paraMapa(linhas) {
  const mapa = new Map();
  for (const linha of linhas) {
    mapa.set(linha.mes, Number(linha.total ?? 0));
  }
  return mapa;
}

async function main() {
  // Receita: copia fiel de obterReceitaMensalPadrao (lib/dashboard/regras-financeiras.ts).
  const receita = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', base.mes), 'YYYY-MM') AS mes, SUM(base.valor) AS total
    FROM (
      SELECT v."criadoEm" AS mes, v."valorTotal"::double precision AS valor
      FROM "Venda" v
      LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
      LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
      LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
      WHERE v."criadoEm" >= ${INICIO} AND v."criadoEm" <= ${AGORA}
        AND v.id LIKE ${LIKE}
        AND (os.id IS NULL OR os."excluidaEm" IS NULL)
        AND (os.id IS NULL OR os."ehRetornoGarantia" = false
             OR COALESCE(rg."houveCobranca", false) = true OR COALESCE(rg."valorAdicional", 0) > 0)
      UNION ALL
      SELECT COALESCE(cr."dataRecebimento", cr."criadoEm") AS mes, cr.valor::double precision AS valor
      FROM "ContaReceber" cr
      LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
      LEFT JOIN "RetornoGarantiaOS" rg ON rg.id = os."retornoGarantiaId"
      WHERE cr.status::text = 'RECEBIDO' AND cr."vendaId" IS NULL
        AND cr.id LIKE ${LIKE}
        AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${INICIO}
        AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${AGORA}
        AND (os.id IS NULL OR os."excluidaEm" IS NULL)
        AND (os.id IS NULL OR os."ehRetornoGarantia" = false
             OR COALESCE(rg."houveCobranca", false) = true OR COALESCE(rg."valorAdicional", 0) > 0)
    ) base
    GROUP BY 1 ORDER BY 1
  `;

  // Despesa 1/3: parcelas de fornecedor (PAGO por dataPagamento, senao por dataVencimento).
  const parcelasDespesa = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month',
             CASE WHEN p.status::text = 'PAGO' AND p."dataPagamento" IS NOT NULL
                  THEN p."dataPagamento" ELSE p."dataVencimento" END), 'YYYY-MM') AS mes,
           SUM(p.valor::double precision) AS total
    FROM "ParcelaDespesa" p
    WHERE p.id LIKE ${LIKE}
      AND (CASE WHEN p.status::text = 'PAGO' AND p."dataPagamento" IS NOT NULL
                THEN p."dataPagamento" ELSE p."dataVencimento" END) BETWEEN ${INICIO} AND ${AGORA}
    GROUP BY 1 ORDER BY 1
  `;

  // Despesa 2/3: custo de peca das OS PRONTO/ENTREGUE, por atualizadoEm.
  const custoPeca = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', os."atualizadoEm"), 'YYYY-MM') AS mes,
           SUM(i."custoPeca"::double precision) AS total
    FROM "ItemOS" i
    JOIN "OrdemServico" os ON os.id = i."osId"
    WHERE os.status::text IN ('PRONTO', 'ENTREGUE')
      AND os."excluidaEm" IS NULL
      AND os.id LIKE ${LIKE}
      AND os."atualizadoEm" BETWEEN ${INICIO} AND ${AGORA}
    GROUP BY 1 ORDER BY 1
  `;

  // Despesa 3/3: custo das mercadorias vendidas no PDV, por Venda.criadoEm.
  const custoVenda = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', v."criadoEm"), 'YYYY-MM') AS mes,
           SUM((iv."custoUnitario" * iv.quantidade)::double precision) AS total
    FROM "ItemVenda" iv
    JOIN "Venda" v ON v.id = iv."vendaId"
    WHERE v.id LIKE ${LIKE} AND v."criadoEm" BETWEEN ${INICIO} AND ${AGORA}
    GROUP BY 1 ORDER BY 1
  `;

  // Caixa: pagamentos efetivamente liquidados.
  const pagamentos = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', p."dataPagamento"), 'YYYY-MM') AS mes,
           SUM(COALESCE(p."valorPago", p.valor)::double precision) AS total
    FROM "ParcelaDespesa" p
    WHERE p.status::text = 'PAGO' AND p."dataPagamento" IS NOT NULL
      AND p.id LIKE ${LIKE}
      AND p."dataPagamento" BETWEEN ${INICIO} AND ${AGORA}
    GROUP BY 1 ORDER BY 1
  `;

  const mReceita = paraMapa(receita);
  const mParcelas = paraMapa(parcelasDespesa);
  const mPeca = paraMapa(custoPeca);
  const mVenda = paraMapa(custoVenda);
  const mPagos = paraMapa(pagamentos);

  const tabela = [];
  let acumuladoCaixa = 0;
  const margens = [];

  for (const mes of rotulos()) {
    const r = mReceita.get(mes) ?? 0;
    const dParcelas = mParcelas.get(mes) ?? 0;
    const dPeca = mPeca.get(mes) ?? 0;
    const dVenda = mVenda.get(mes) ?? 0;
    const despesa = dParcelas + dPeca + dVenda;
    const lucro = r - despesa;
    const margem = r > 0 ? (lucro / r) * 100 : 0;
    acumuladoCaixa += r - (mPagos.get(mes) ?? 0);
    margens.push(margem);

    tabela.push({
      mes,
      receita: Math.round(r * 100) / 100,
      custoPecaOS: Math.round(dPeca * 100) / 100,
      custoMercadoriaPDV: Math.round(dVenda * 100) / 100,
      despesaFornecedores: Math.round(dParcelas * 100) / 100,
      despesaTotal: Math.round(despesa * 100) / 100,
      lucro: Math.round(lucro * 100) / 100,
      margemPct: Math.round(margem * 10) / 10,
      saldoAcumulado: Math.round(acumuladoCaixa * 100) / 100,
    });
  }

  console.log(SOMENTE_MARCADAS ? "ESCOPO: somente linhas do seed (id seed-demo-%)" : "ESCOPO: TODAS as linhas (o que o dashboard ve)");
  console.table(tabela);

  const receitaTotal = tabela.reduce((s, l) => s + l.receita, 0);
  const custoDireto = tabela.reduce((s, l) => s + l.custoPecaOS + l.custoMercadoriaPDV, 0);
  const despesaOp = tabela.reduce((s, l) => s + l.despesaFornecedores, 0);

  console.log(JSON.stringify({
    margemMinimaPct: Math.round(Math.min(...margens) * 10) / 10,
    margemMaximaPct: Math.round(Math.max(...margens) * 10) / 10,
    todosNaFaixa15a25: margens.every((m) => m >= 15 && m <= 25),
    receitaMinimaMes: Math.min(...tabela.map((l) => l.receita)),
    receitaMaximaMes: Math.max(...tabela.map((l) => l.receita)),
    custoDiretoSobreReceitaPct: Math.round((custoDireto / receitaTotal) * 1000) / 10,
    despesaOperacionalSobreReceitaPct: Math.round((despesaOp / receitaTotal) * 1000) / 10,
    saldoAcumuladoPrimeiroMes: tabela[0].saldoAcumulado,
    saldoAcumuladoUltimoMes: tabela[11].saldoAcumulado,
    saldoSempreCrescente: tabela.every((l, i) => i === 0 || l.saldoAcumulado > tabela[i - 1].saldoAcumulado),
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
