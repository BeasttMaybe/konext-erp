"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";
import { obterResumoReceber } from "@/app/actions/financeiro-receber";
import { obterResumoPagar } from "@/app/actions/financeiro-pagar";

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

/** Nome que `os-itens.ts` grava em `Despesa.fornecedor` pra custo de peça vindo de uma OS — não existe campo de origem no schema, então é este texto exato que distingue "peça de OS" de despesa de loja de verdade (Fase 3-2D). */
const FORNECEDOR_PECA_OS = "Custo de peça (OS)";

function inicioFimDoMes(referencia: Date = new Date()) {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

/**
 * "Saldo em caixa hoje" — dinheiro de verdade disponível AGORA, não uma
 * projeção. É só o caixa da loja (abertura + vendas em dinheiro da sessão
 * aberta); não existe conceito de "conta bancária" neste sistema hoje, então
 * a referência visual ("Caixa da loja + conta bancária") fica só com a
 * primeira metade — a segunda não tem de onde vir, e inventar seria mentir
 * um número. Sem caixa aberto, o saldo físico não é rastreado: mostra 0 com
 * um texto explícito, não um valor calculado como se fosse confiável.
 */
export interface SaldoEmCaixaHoje {
  valor: number;
  caixaAberto: boolean;
  valorAbertura: number;
}

export async function obterSaldoEmCaixaHoje(): Promise<SaldoEmCaixaHoje> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  const caixaAberto = await prisma.caixaSession.findFirst({
    where: { status: "ABERTO" },
    orderBy: { dataAbertura: "desc" },
    select: { id: true, valorAbertura: true },
  });

  if (!caixaAberto) {
    return { valor: 0, caixaAberto: false, valorAbertura: 0 };
  }

  const pagamentosDinheiro = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM(vp."valorBruto"), 0) AS total
    FROM "VendaPagamento" vp
    INNER JOIN "Venda" v ON v.id = vp."vendaId"
    WHERE v."caixaSessionId" = ${caixaAberto.id}
      AND vp."formaPagamento"::text = 'DINHEIRO'
  `;

  const valorAberturaCentavos = paraCentavos(Number(caixaAberto.valorAbertura ?? 0));
  const dinheiroVendasCentavos = paraCentavos(Number(pagamentosDinheiro[0]?.total ?? 0));

  return {
    valor: paraMoeda(valorAberturaCentavos + dinheiroVendasCentavos),
    caixaAberto: true,
    valorAbertura: Number(caixaAberto.valorAbertura ?? 0),
  };
}

/**
 * "A receber em aberto" / "A pagar em aberto" — todas as contas/parcelas
 * pendentes, de QUALQUER período (não só o mês atual — por isso
 * `todoPeriodo: true`), com a fatia vencida separada. Mesma fonte que as
 * telas A receber/A pagar usam (`obterResumoReceber`/`obterResumoPagar`),
 * então o número daqui sempre bate com o total "Em aberto" de lá.
 *
 * `totalPendente` e `totalAtrasado` são baldes DISJUNTOS lá (não vencido vs.
 * vencido) — "em aberto" aqui é a soma dos dois: tudo que ainda não foi
 * baixado, esteja vencido ou não. `atrasado` continua exposto à parte só
 * pra destacar a fatia preocupante dentro do total.
 */
export interface AbertoComAtraso {
  total: number;
  atrasado: number;
}

export async function obterReceberEmAberto(): Promise<AbertoComAtraso> {
  const resumo = await obterResumoReceber({ todoPeriodo: true });
  return { total: resumo.totalPendente + resumo.totalAtrasado, atrasado: resumo.totalAtrasado };
}

export async function obterPagarEmAberto(): Promise<AbertoComAtraso> {
  const resumo = await obterResumoPagar({ todoPeriodo: true });
  return { total: resumo.totalPendente + resumo.totalAtrasado, atrasado: resumo.totalAtrasado };
}

/**
 * "Resultado do mês" — Entradas menos Saídas, só o que JÁ aconteceu.
 * Entradas = `obterReceitaTotalPadrao`, a mesma função que o Dashboard usa
 * pra faturamento (exclui retorno de garantia) — reaproveitada aqui de
 * propósito pra o número do Financeiro sempre bater com o do Dashboard, não
 * ter duas contas "de faturamento" divergentes no sistema.
 * Saídas = parcelas de despesa já PAGAS com pagamento dentro do mês
 * (`dataPagamento`, não `dataVencimento` — o que ainda não foi pago não é
 * saída, é o "A pagar em aberto" de cima).
 */
export interface ResultadoDoMes {
  entradas: number;
  saidas: number;
  resultado: number;
}

export async function obterResultadoDoMes(): Promise<ResultadoDoMes> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes();

  const [entradas, saidasBrutas] = await Promise.all([
    obterReceitaTotalPadrao(inicio, fim, prisma),
    prisma.parcelaDespesa.findMany({
      where: { status: "PAGO", dataPagamento: { gte: inicio, lte: fim } },
      select: { valorPago: true, valor: true },
    }),
  ]);

  const saidasCentavos = saidasBrutas.reduce(
    (acc, parcela) => acc + paraCentavos(Number(parcela.valorPago ?? parcela.valor ?? 0)),
    0
  );
  const entradasCentavos = paraCentavos(entradas);

  return {
    entradas,
    saidas: paraMoeda(saidasCentavos),
    resultado: paraMoeda(entradasCentavos - saidasCentavos),
  };
}

/**
 * Fluxo de caixa semanal do mês corrente: semanas que já passaram (ou a
 * atual, até hoje) são "realizado" — Entradas de `Venda.criadoEm`, Saídas de
 * `ParcelaDespesa.dataPagamento`, ambos só o que de fato aconteceu. Semanas
 * que ainda não chegaram são "projeção" — Entradas de `ContaReceber`
 * pendente por `dataVencimento`, Saídas de `ParcelaDespesa` pendente por
 * `dataVencimento`: o que está AGENDADO pra acontecer, não uma garantia.
 */
export interface SemanaFluxoCaixa {
  rotulo: string;
  entradas: number;
  saidas: number;
  projetado: boolean;
}

export async function obterFluxoDeCaixaSemanal(): Promise<SemanaFluxoCaixa[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const hoje = new Date();
  const { inicio, fim } = inicioFimDoMes(hoje);

  const semanas: { inicio: Date; fim: Date; projetado: boolean }[] = [];
  let cursor = new Date(inicio);
  let numero = 1;
  while (cursor <= fim) {
    const fimSemana = new Date(cursor);
    fimSemana.setDate(fimSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    const fimReal = fimSemana > fim ? fim : fimSemana;
    semanas.push({ inicio: new Date(cursor), fim: fimReal, projetado: fimReal > hoje });
    cursor = new Date(fimReal);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
    numero += 1;
    if (numero > 6) break; // guarda-corpo — meses têm no máximo 5-6 semanas parciais
  }

  const resultados = await Promise.all(
    semanas.map(async (semana) => {
      if (!semana.projetado) {
        const [vendas, pagas] = await Promise.all([
          prisma.venda.findMany({
            where: { criadoEm: { gte: semana.inicio, lte: semana.fim } },
            select: { valorTotal: true },
          }),
          prisma.parcelaDespesa.findMany({
            where: { status: "PAGO", dataPagamento: { gte: semana.inicio, lte: semana.fim } },
            select: { valorPago: true, valor: true },
          }),
        ]);
        const entradasCentavos = vendas.reduce((acc, v) => acc + paraCentavos(Number(v.valorTotal ?? 0)), 0);
        const saidasCentavos = pagas.reduce(
          (acc, p) => acc + paraCentavos(Number(p.valorPago ?? p.valor ?? 0)),
          0
        );
        return { entradas: paraMoeda(entradasCentavos), saidas: paraMoeda(saidasCentavos) };
      }

      const [receber, pagar] = await Promise.all([
        prisma.contaReceber.findMany({
          where: { status: "PENDENTE", dataVencimento: { gte: semana.inicio, lte: semana.fim } },
          select: { valor: true },
        }),
        prisma.parcelaDespesa.findMany({
          where: { status: "PENDENTE", dataVencimento: { gte: semana.inicio, lte: semana.fim } },
          select: { valor: true },
        }),
      ]);
      const entradasCentavos = receber.reduce((acc, c) => acc + paraCentavos(Number(c.valor ?? 0)), 0);
      const saidasCentavos = pagar.reduce((acc, p) => acc + paraCentavos(Number(p.valor ?? 0)), 0);
      return { entradas: paraMoeda(entradasCentavos), saidas: paraMoeda(saidasCentavos) };
    })
  );

  return semanas.map((semana, indice) => ({
    rotulo: `Sem ${indice + 1}`,
    entradas: resultados[indice]!.entradas,
    saidas: resultados[indice]!.saidas,
    projetado: semana.projetado,
  }));
}

/**
 * "Saídas por categoria" — não existe taxonomia de categoria de despesa no
 * schema (só `fornecedor`/`descricao`, texto livre). A única distinção que
 * dá pra derivar sem inventar dado é a mesma usada pra marcar origem de OS:
 * `fornecedor === "Custo de peça (OS)"`. Por isso só duas categorias reais
 * aqui — "Peça de OS" e "Despesas da loja" — não uma lista rica que o
 * sistema não tem como saber.
 */
export interface FatiaCategoria {
  nome: string;
  valor: number;
}

export async function obterSaidasPorCategoria(): Promise<FatiaCategoria[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes();

  const pagas = await prisma.parcelaDespesa.findMany({
    where: { status: "PAGO", dataPagamento: { gte: inicio, lte: fim } },
    select: { valorPago: true, valor: true, despesa: { select: { fornecedor: true } } },
  });

  let pecaOsCentavos = 0;
  let lojaCentavos = 0;
  for (const parcela of pagas) {
    const valorCentavos = paraCentavos(Number(parcela.valorPago ?? parcela.valor ?? 0));
    if (parcela.despesa?.fornecedor === FORNECEDOR_PECA_OS) {
      pecaOsCentavos += valorCentavos;
    } else {
      lojaCentavos += valorCentavos;
    }
  }

  return [
    { nome: "Peça de OS", valor: paraMoeda(pecaOsCentavos) },
    { nome: "Despesas da loja", valor: paraMoeda(lojaCentavos) },
  ].filter((fatia) => fatia.valor > 0);
}

/** "Entradas por forma" — pagamentos de venda recebidos no mês, por forma. */
export async function obterEntradasPorForma(): Promise<FatiaCategoria[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes();

  const linhas = await prisma.$queryRaw<Array<{ formaPagamento: string; total: number }>>`
    SELECT vp."formaPagamento"::text AS "formaPagamento", COALESCE(SUM(vp."valorBruto"), 0) AS total
    FROM "VendaPagamento" vp
    INNER JOIN "Venda" v ON v.id = vp."vendaId"
    WHERE v."criadoEm" >= ${inicio} AND v."criadoEm" <= ${fim}
    GROUP BY vp."formaPagamento"
    ORDER BY total DESC
  `;

  const rotulos: Record<string, string> = {
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    CARTAO_DEBITO: "Cartão de Débito",
    CARTAO_CREDITO: "Cartão de Crédito",
    CARTAO_CREDITO_AVISTA: "Cartão de Crédito",
    CARTAO_CREDITO_PARCELADO: "Cartão de Crédito",
    BOLETO: "Boleto",
    CREDIARIO: "Crediário",
    TED: "TED",
    EMPENHO_PUBLICO: "Empenho público",
  };

  const porRotulo = new Map<string, number>();
  for (const linha of linhas) {
    const rotulo = rotulos[linha.formaPagamento] ?? linha.formaPagamento;
    porRotulo.set(rotulo, (porRotulo.get(rotulo) ?? 0) + paraCentavos(Number(linha.total ?? 0)));
  }

  return Array.from(porRotulo.entries())
    .map(([nome, centavos]) => ({ nome, valor: paraMoeda(centavos) }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * "Precisa de atenção" — contas a receber e parcelas a pagar vencidas (ou
 * vencendo nos próximos 7 dias), receber e pagar juntos numa lista só, mais
 * antiga primeiro. Cada item aponta pra onde se resolve (A receber/A pagar).
 */
export interface ItemAtencao {
  id: string;
  tipo: "receber" | "pagar";
  titulo: string;
  valor: number;
  dataVencimento: Date;
  diasAtraso: number;
}

export async function obterPrecisaDeAtencao(limite = 8): Promise<ItemAtencao[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  const em7Dias = new Date();
  em7Dias.setDate(em7Dias.getDate() + 7);
  em7Dias.setHours(23, 59, 59, 999);

  const [receber, pagar] = await Promise.all([
    prisma.contaReceber.findMany({
      where: { status: "PENDENTE", dataVencimento: { lte: em7Dias } },
      select: { id: true, valor: true, dataVencimento: true, descricao: true, cliente: { select: { nomeRazaoSocial: true } } },
      orderBy: { dataVencimento: "asc" },
      take: limite,
    }),
    prisma.parcelaDespesa.findMany({
      where: { status: "PENDENTE", dataVencimento: { lte: em7Dias } },
      select: { id: true, valor: true, dataVencimento: true, despesa: { select: { fornecedor: true, descricao: true } } },
      orderBy: { dataVencimento: "asc" },
      take: limite,
    }),
  ]);

  const diasDeAtraso = (vencimento: Date) =>
    Math.max(0, Math.floor((hoje.getTime() - new Date(vencimento).getTime()) / 86_400_000));

  const itensReceber: ItemAtencao[] = receber.map((conta) => ({
    id: conta.id,
    tipo: "receber",
    titulo: conta.cliente?.nomeRazaoSocial || conta.descricao || "Conta a receber",
    valor: conta.valor,
    dataVencimento: conta.dataVencimento,
    diasAtraso: diasDeAtraso(conta.dataVencimento),
  }));

  const itensPagar: ItemAtencao[] = pagar.map((parcela) => ({
    id: parcela.id,
    tipo: "pagar",
    titulo: parcela.despesa?.fornecedor || parcela.despesa?.descricao || "Despesa",
    valor: parcela.valor,
    dataVencimento: parcela.dataVencimento,
    diasAtraso: diasDeAtraso(parcela.dataVencimento),
  }));

  return [...itensReceber, ...itensPagar]
    .sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
    .slice(0, limite);
}

export interface VisaoGeralFinanceiro {
  saldoEmCaixa: SaldoEmCaixaHoje;
  receberEmAberto: AbertoComAtraso;
  pagarEmAberto: AbertoComAtraso;
  resultadoDoMes: ResultadoDoMes;
  fluxoSemanal: SemanaFluxoCaixa[];
  saidasPorCategoria: FatiaCategoria[];
  entradasPorForma: FatiaCategoria[];
  precisaDeAtencao: ItemAtencao[];
}

export async function obterVisaoGeralFinanceiro(): Promise<VisaoGeralFinanceiro> {
  const [
    saldoEmCaixa,
    receberEmAberto,
    pagarEmAberto,
    resultadoDoMes,
    fluxoSemanal,
    saidasPorCategoria,
    entradasPorForma,
    precisaDeAtencao,
  ] = await Promise.all([
    obterSaldoEmCaixaHoje(),
    obterReceberEmAberto(),
    obterPagarEmAberto(),
    obterResultadoDoMes(),
    obterFluxoDeCaixaSemanal(),
    obterSaidasPorCategoria(),
    obterEntradasPorForma(),
    obterPrecisaDeAtencao(),
  ]);

  return {
    saldoEmCaixa,
    receberEmAberto,
    pagarEmAberto,
    resultadoDoMes,
    fluxoSemanal,
    saidasPorCategoria,
    entradasPorForma,
    precisaDeAtencao,
  };
}
