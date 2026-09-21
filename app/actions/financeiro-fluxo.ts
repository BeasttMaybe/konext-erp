"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";
import { obterResumoReceber } from "@/app/actions/financeiro-receber";
import { obterSaldoEmCaixaHoje, type SaldoEmCaixaHoje } from "@/app/actions/financeiro-hub";
import {
  comoDataDeCalendario,
  fimDoMes,
  FUSO_HORARIO_PADRAO,
  inicioDoMes,
  somarDias,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

/** Chave "yyyy-MM-dd" de uma DATA DE CALENDÁRIO (meia-noite UTC) — sempre lida em UTC, nunca no fuso do processo. */
function chaveDiaCalendario(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * `Venda.criadoEm`/`ContaReceber.dataRecebimento`/`criadoEm` são INSTANTE —
 * o mês certo é o mês no fuso da LOJA. Delega pro único módulo autorizado
 * (lib/datas.ts).
 */
function inicioFimDoMes(referencia: Date = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO) {
  return { inicio: inicioDoMes(referencia, fusoHorario), fim: fimDoMes(referencia, fusoHorario) };
}

function mesAnterior(referencia: Date = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  const primeiroDiaMesAtual = inicioDoMes(referencia, fusoHorario);
  const ultimoDiaMesAnterior = somarDias(primeiroDiaMesAtual, -1, fusoHorario);
  return inicioDoMes(ultimoDiaMesAnterior, fusoHorario);
}

// ── Projeção diária de saldo (30 dias) ──────────────────────────────────────

export interface PontoProjecaoSaldo {
  data: Date;
  entradas: number;
  saidas: number;
  saldo: number;
}

/**
 * Projeção "se nada além do já agendado acontecer": parte do saldo em caixa
 * de VERDADE hoje (`obterSaldoEmCaixaHoje`, não faturamento do período — a
 * versão antiga em financeiro-inteligencia.ts partia do lucro do período
 * como se fosse saldo de caixa, o que misturava dois conceitos diferentes) e
 * soma/subtrai, dia a dia, os títulos e parcelas que ainda não foram
 * baixados/pagos e vencem dentro da janela. Não inclui nada que ainda não
 * foi lançado no sistema — é um piso, não uma previsão de vendas futuras.
 */
export interface ProjecaoSaldo {
  pontos: PontoProjecaoSaldo[];
  menorPonto: PontoProjecaoSaldo;
  temSaldoNegativo: boolean;
}

export async function obterProjecaoSaldo(dias = 30): Promise<ProjecaoSaldo> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  // `dataVencimento` é DATA DE CALENDÁRIO (meia-noite UTC) — "hoje" precisa
  // da mesma convenção, nunca meia-noite do fuso da loja como instante.
  const hoje = comoDataDeCalendario(new Date(), contexto.fusoHorario);
  const fimJanela = somarDiasEmDataDeCalendario(hoje, dias);

  const [saldoHoje, receber, pagar] = await Promise.all([
    obterSaldoEmCaixaHoje(),
    prisma.contaReceber.findMany({
      where: { status: { in: ["PENDENTE", "ATRASADO", "RENEGOCIADO"] }, dataVencimento: { gte: hoje, lte: fimJanela } },
      select: { valor: true, dataVencimento: true },
    }),
    prisma.parcelaDespesa.findMany({
      where: { status: { in: ["PENDENTE", "ATRASADO"] }, dataVencimento: { gte: hoje, lte: fimJanela } },
      select: { valor: true, dataVencimento: true },
    }),
  ]);

  const entradasPorDia = new Map<string, number>();
  for (const conta of receber) {
    const chave = chaveDiaCalendario(conta.dataVencimento);
    entradasPorDia.set(chave, (entradasPorDia.get(chave) ?? 0) + paraCentavos(conta.valor));
  }

  const saidasPorDia = new Map<string, number>();
  for (const parcela of pagar) {
    const chave = chaveDiaCalendario(parcela.dataVencimento);
    saidasPorDia.set(chave, (saidasPorDia.get(chave) ?? 0) + paraCentavos(parcela.valor));
  }

  let saldoCentavos = paraCentavos(saldoHoje.valor);
  const pontos: PontoProjecaoSaldo[] = [];

  for (let indice = 0; indice <= dias; indice += 1) {
    const data = somarDiasEmDataDeCalendario(hoje, indice);
    const chave = chaveDiaCalendario(data);
    const entradasCentavos = entradasPorDia.get(chave) ?? 0;
    const saidasCentavos = saidasPorDia.get(chave) ?? 0;
    saldoCentavos += entradasCentavos - saidasCentavos;

    pontos.push({
      data,
      entradas: paraMoeda(entradasCentavos),
      saidas: paraMoeda(saidasCentavos),
      saldo: paraMoeda(saldoCentavos),
    });
  }

  const menorPonto = pontos.reduce((menor, ponto) => (ponto.saldo < menor.saldo ? ponto : menor), pontos[0]!);

  return { pontos, menorPonto, temSaldoNegativo: menorPonto.saldo < 0 };
}

// ── Próximos lançamentos (7 dias) ────────────────────────────────────────────

export interface ProximoLancamento {
  id: string;
  tipo: "receber" | "pagar";
  titulo: string;
  valor: number;
  dataVencimento: Date;
}

export interface ProximosLancamentos {
  itens: ProximoLancamento[];
  resultadoSemana: number;
}

/** Só o que ainda vai vencer nos próximos N dias — o atrasado já mora em "Precisa de atenção" (Visão geral). */
export async function obterProximosLancamentos(dias = 7): Promise<ProximosLancamentos> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  // Mesma convenção de obterProjecaoSaldo acima: dataVencimento é DATA DE
  // CALENDÁRIO (meia-noite UTC).
  const hoje = comoDataDeCalendario(new Date(), contexto.fusoHorario);
  const fimJanela = somarDiasEmDataDeCalendario(hoje, dias);

  const [receber, pagar] = await Promise.all([
    prisma.contaReceber.findMany({
      where: { status: { in: ["PENDENTE", "RENEGOCIADO"] }, dataVencimento: { gte: hoje, lte: fimJanela } },
      select: { id: true, valor: true, dataVencimento: true, descricao: true, cliente: { select: { nomeRazaoSocial: true } } },
      orderBy: { dataVencimento: "asc" },
    }),
    prisma.parcelaDespesa.findMany({
      where: { status: "PENDENTE", dataVencimento: { gte: hoje, lte: fimJanela } },
      select: { id: true, valor: true, dataVencimento: true, despesa: { select: { fornecedor: true, descricao: true } } },
      orderBy: { dataVencimento: "asc" },
    }),
  ]);

  const itensReceber: ProximoLancamento[] = receber.map((conta) => ({
    id: conta.id,
    tipo: "receber",
    titulo: conta.cliente?.nomeRazaoSocial || conta.descricao || "Conta a receber",
    valor: conta.valor,
    dataVencimento: conta.dataVencimento,
  }));

  const itensPagar: ProximoLancamento[] = pagar.map((parcela) => ({
    id: parcela.id,
    tipo: "pagar",
    titulo: parcela.despesa?.fornecedor || parcela.despesa?.descricao || "Despesa",
    valor: parcela.valor,
    dataVencimento: parcela.dataVencimento,
  }));

  const itens = [...itensReceber, ...itensPagar].sort(
    (a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
  );

  const resultadoCentavos = itens.reduce((acc, item) => {
    const valorCentavos = paraCentavos(item.valor);
    return acc + (item.tipo === "receber" ? valorCentavos : -valorCentavos);
  }, 0);

  return { itens, resultadoSemana: paraMoeda(resultadoCentavos) };
}

// ── Previsto x recebido no mês ───────────────────────────────────────────────

export interface PrevistoXRecebido {
  percentual: number;
  naoRecebido: number;
}

/** Do que vencia este mês (recebido + pendente + atrasado), quanto já entrou de fato. */
export async function obterPrevistoXRecebido(): Promise<PrevistoXRecebido> {
  const resumo = await obterResumoReceber({});
  if (resumo.totalPeriodo <= 0) {
    return { percentual: 0, naoRecebido: 0 };
  }
  const percentual = Math.round((resumo.totalRecebido / resumo.totalPeriodo) * 100);
  const naoRecebidoCentavos = paraCentavos(resumo.totalPendente) + paraCentavos(resumo.totalAtrasado);
  return { percentual, naoRecebido: paraMoeda(naoRecebidoCentavos) };
}

// ── Resultado do período (com comparação ao período anterior) ───────────────

export interface ResultadoPeriodo {
  entradas: number;
  saidas: number;
  sobrou: number;
  margemPercentual: number;
  variacaoEntradasPercentual: number | null;
  variacaoSaidasPercentual: number | null;
}

type PrismaTenant = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

async function calcularEntradasSaidas(inicio: Date, fim: Date, prisma: PrismaTenant) {
  const [entradas, saidasBrutas] = await Promise.all([
    obterReceitaTotalPadrao(inicio, fim, prisma),
    prisma.parcelaDespesa.findMany({
      where: { status: "PAGO", dataPagamento: { gte: inicio, lte: fim } },
      select: { valorPago: true, valor: true },
    }),
  ]);
  const saidasCentavos = saidasBrutas.reduce((acc, p) => acc + paraCentavos(Number(p.valorPago ?? p.valor ?? 0)), 0);
  return { entradas, saidas: paraMoeda(saidasCentavos) };
}

function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export async function obterResultadoDoPeriodo(referencia: Date = new Date()): Promise<ResultadoPeriodo> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  const { inicio, fim } = inicioFimDoMes(referencia, contexto.fusoHorario);
  const { inicio: inicioAnterior, fim: fimAnterior } = inicioFimDoMes(
    mesAnterior(referencia, contexto.fusoHorario),
    contexto.fusoHorario
  );

  const [atual, anterior] = await Promise.all([
    calcularEntradasSaidas(inicio, fim, prisma),
    calcularEntradasSaidas(inicioAnterior, fimAnterior, prisma),
  ]);

  const entradasCentavos = paraCentavos(atual.entradas);
  const saidasCentavos = paraCentavos(atual.saidas);
  const sobrouCentavos = entradasCentavos - saidasCentavos;

  return {
    entradas: atual.entradas,
    saidas: atual.saidas,
    sobrou: paraMoeda(sobrouCentavos),
    margemPercentual: entradasCentavos > 0 ? Math.round((sobrouCentavos / entradasCentavos) * 100) : 0,
    variacaoEntradasPercentual: variacaoPercentual(atual.entradas, anterior.entradas),
    variacaoSaidasPercentual: variacaoPercentual(atual.saidas, anterior.saidas),
  };
}

// ── Serviço x produto ────────────────────────────────────────────────────────

export interface ServicoXProduto {
  servicoPercentual: number;
  produtoPercentual: number;
  temDados: boolean;
}

/**
 * Divide a mesma receita de `obterReceitaTotalPadrao` em duas fatias:
 * "serviço" é tudo ligado a uma OS (mão de obra + peça cobradas na ordem),
 * "produto" é venda de balcão sem OS. Reusa exatamente os mesmos filtros de
 * garantia da função original — não é uma segunda definição de faturamento.
 */
export async function obterServicoXProduto(referencia: Date = new Date()): Promise<ServicoXProduto> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes(referencia, contexto.fusoHorario);

  const linhas = await prisma.$queryRaw<Array<{ ehServico: boolean; total: number }>>`
    SELECT base."ehServico", COALESCE(SUM(base.valor), 0) AS total
    FROM (
      SELECT (os.id IS NOT NULL) AS "ehServico", v."valorTotal"::double precision AS valor
      FROM "Venda" v
      LEFT JOIN "ContaReceber" cr ON cr."vendaId" = v.id
      LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
      WHERE v."criadoEm" >= ${inicio}
        AND v."criadoEm" <= ${fim}
        AND (os.id IS NULL OR (os."excluidaEm" IS NULL AND os."entregueSemServico" = false))

      UNION ALL

      SELECT (os.id IS NOT NULL) AS "ehServico", cr.valor::double precision AS valor
      FROM "ContaReceber" cr
      LEFT JOIN "OrdemServico" os ON os.id = cr."ordemServicoId"
      WHERE cr.status::text = 'RECEBIDO'
        AND cr."vendaId" IS NULL
        AND COALESCE(cr."dataRecebimento", cr."criadoEm") >= ${inicio}
        AND COALESCE(cr."dataRecebimento", cr."criadoEm") <= ${fim}
        AND (os.id IS NULL OR (os."excluidaEm" IS NULL AND os."entregueSemServico" = false))
    ) base
    GROUP BY base."ehServico"
  `;

  const servicoCentavos = paraCentavos(Number(linhas.find((l) => l.ehServico)?.total ?? 0));
  const produtoCentavos = paraCentavos(Number(linhas.find((l) => !l.ehServico)?.total ?? 0));
  const totalCentavos = servicoCentavos + produtoCentavos;

  if (totalCentavos <= 0) {
    return { servicoPercentual: 0, produtoPercentual: 0, temDados: false };
  }

  const servicoPercentual = Math.round((servicoCentavos / totalCentavos) * 100);
  return { servicoPercentual, produtoPercentual: 100 - servicoPercentual, temDados: true };
}

// ── Quanto sobrou por OS ─────────────────────────────────────────────────────

export interface LinhaSobraPorOS {
  osId: string;
  numeroOs: number;
  servico: string;
  tecnico: string | null;
  cobrado: number;
  peca: number;
  taxa: number;
  sobra: number;
}

export interface QuantoSobrouPorOS {
  linhas: LinhaSobraPorOS[];
  /** Comissão não existe como dado no sistema (nenhum campo/modelo em toda a schema) — por isso NÃO aparece
   * como coluna zerada aqui. "Sobra" abaixo é cobrado − peça − taxa do cartão, sem descontar comissão. */
  comissaoIndisponivel: true;
  sobraMediaPorOS: number;
  margemMediaPercentual: number;
}

/**
 * Uma linha por OS ENTREGUE com pelo menos um recebimento (RECEBIDO) no
 * período: Cobrado = soma do que foi de fato cobrado do cliente nessa OS
 * (ContaReceber.valor); Peça = soma de ItemOS.custoPeca; Taxa = soma da taxa
 * de cartão paga (VendaPagamento.valorTaxa) quando o recebimento passou por
 * uma venda com pagamento em cartão; Comissão não existe no sistema — ver
 * `comissaoIndisponivel`. Sobra = Cobrado − Peça − Taxa.
 */
export async function obterQuantoSobrouPorOS(referencia: Date = new Date(), limite = 30): Promise<QuantoSobrouPorOS> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes(referencia, contexto.fusoHorario);

  const contasRecebidas = await prisma.contaReceber.findMany({
    where: {
      status: "RECEBIDO",
      ordemServicoId: { not: null },
      OR: [
        { dataRecebimento: { gte: inicio, lte: fim } },
        { AND: [{ dataRecebimento: null }, { criadoEm: { gte: inicio, lte: fim } }] },
      ],
    },
    select: { ordemServicoId: true },
  });

  const idsOs = Array.from(new Set(contasRecebidas.map((c) => c.ordemServicoId).filter((id): id is string => Boolean(id))));

  if (idsOs.length === 0) {
    return { linhas: [], comissaoIndisponivel: true, sobraMediaPorOS: 0, margemMediaPercentual: 0 };
  }

  const ordens = await prisma.ordemServico.findMany({
    where: { id: { in: idsOs }, etapa: "ENTREGUE", excluidaEm: null },
    select: {
      id: true,
      numeroOs: true,
      equipamento: true,
      modelo: true,
      itens: { select: { custoPeca: true } },
      tecnicos: { where: { principal: true }, select: { usuario: { select: { nome: true } } }, take: 1 },
      transacoes: {
        select: {
          valor: true,
          vendaPagamento: { select: { valorTaxa: true } },
        },
      },
    },
    take: limite,
  });

  const linhas: LinhaSobraPorOS[] = ordens
    .map((os) => {
      const cobradoCentavos = os.transacoes.reduce((acc, t) => acc + paraCentavos(t.valor), 0);
      const pecaCentavos = os.itens.reduce((acc, item) => acc + paraCentavos(item.custoPeca), 0);
      const taxaCentavos = os.transacoes.reduce((acc, t) => acc + paraCentavos(t.vendaPagamento?.valorTaxa ?? 0), 0);
      const sobraCentavos = cobradoCentavos - pecaCentavos - taxaCentavos;

      return {
        osId: os.id,
        numeroOs: os.numeroOs,
        servico: [os.equipamento, os.modelo].filter(Boolean).join(" "),
        tecnico: os.tecnicos[0]?.usuario.nome ?? null,
        cobrado: paraMoeda(cobradoCentavos),
        peca: paraMoeda(pecaCentavos),
        taxa: paraMoeda(taxaCentavos),
        sobra: paraMoeda(sobraCentavos),
      };
    })
    .sort((a, b) => b.cobrado - a.cobrado);

  const somaSobraCentavos = linhas.reduce((acc, l) => acc + paraCentavos(l.sobra), 0);
  const somaCobradoCentavos = linhas.reduce((acc, l) => acc + paraCentavos(l.cobrado), 0);

  return {
    linhas,
    comissaoIndisponivel: true,
    sobraMediaPorOS: linhas.length > 0 ? paraMoeda(Math.round(somaSobraCentavos / linhas.length)) : 0,
    margemMediaPercentual: somaCobradoCentavos > 0 ? Math.round((somaSobraCentavos / somaCobradoCentavos) * 100) : 0,
  };
}

// ── Agregadores por vista ────────────────────────────────────────────────────

export interface DadosFluxoDeCaixa {
  saldoHoje: SaldoEmCaixaHoje;
  aReceber7Dias: number;
  projecao: ProjecaoSaldo;
  proximosLancamentos: ProximosLancamentos;
  previstoXRecebido: PrevistoXRecebido;
}

export async function obterDadosFluxoDeCaixa(): Promise<DadosFluxoDeCaixa> {
  const [saldoHoje, projecao, proximosLancamentos, previstoXRecebido] = await Promise.all([
    obterSaldoEmCaixaHoje(),
    obterProjecaoSaldo(30),
    obterProximosLancamentos(7),
    obterPrevistoXRecebido(),
  ]);

  const aReceber7DiasCentavos = proximosLancamentos.itens
    .filter((item) => item.tipo === "receber")
    .reduce((acc, item) => acc + paraCentavos(item.valor), 0);

  return {
    saldoHoje,
    aReceber7Dias: paraMoeda(aReceber7DiasCentavos),
    projecao,
    proximosLancamentos,
    previstoXRecebido,
  };
}

export interface DadosResultadoPeriodo {
  resultado: ResultadoPeriodo;
  servicoXProduto: ServicoXProduto;
  sobraPorOS: QuantoSobrouPorOS;
}

/**
 * `referencia` (Fase 2A-1, `FiltroPeriodo`): qualquer dia dentro do mês que
 * as três sub-consultas devem resumir — `resultado`/`servicoXProduto`/
 * `sobraPorOS` são todas "resumo do MÊS que contém `referencia`"
 * (`inicioFimDoMes`, acima), nunca um intervalo arbitrário de dias. Quem
 * chama (a page de Fluxo e relatórios) usa o início do intervalo escolhido
 * no `FiltroPeriodo` como essa referência — o relatório sempre resume o mês
 * inteiro que contém o dia escolhido, não só os dias exatos do intervalo.
 */
export async function obterDadosResultadoPeriodo(
  referencia: Date = new Date()
): Promise<DadosResultadoPeriodo> {
  const [resultado, servicoXProduto, sobraPorOS] = await Promise.all([
    obterResultadoDoPeriodo(referencia),
    obterServicoXProduto(referencia),
    obterQuantoSobrouPorOS(referencia),
  ]);

  return { resultado, servicoXProduto, sobraPorOS };
}
