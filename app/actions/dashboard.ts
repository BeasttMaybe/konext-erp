"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { obterReceitaMensalPadrao, obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";
import { Prisma } from "@prisma/client";

export type TipoVariacao = "percentual" | "sem_base" | "sem_variacao";

export type VariacaoPercentual = {
  tipo: TipoVariacao;
  valor?: number;
  texto: string;
};

export type ValorComVariacao = {
  valor: number;
  variacao: VariacaoPercentual;
};

export type PeriodoDashboard = "hoje" | "7d" | "30d" | "mes";

export type BlocoCaixa = {
  entrou: number;
  saiu: number;
  receberAtrasado: number;
  pagarAtrasado: number;
};

export type AcaoDashboard = {
  chave: string;
  texto: string;
  valor: number | null;
  href: string;
  severidade: "CRITICO" | "ATENCAO";
};

export type LinhaFilaOS = {
  status: string;
  label: string;
  quantidade: number;
  href: string;
};

export type OsParada = {
  id: string;
  numeroOs: number;
  cliente: string;
  aparelho: string;
  status: string;
  diasParado: number;
};

export type OperacaoDashboard = {
  fila: LinhaFilaOS[];
  parados: {
    diasLimite: number;
    quantidade: number;
    lista: OsParada[];
  };
  prontasAguardandoRetirada: {
    quantidade: number;
    valor: number;
    diasLimite: number;
    quantidadeAcimaLimite: number;
  };
  valorEmAberto: number;
  tempoMedioReparoDias: number | null;
  ticketMedioOS: number | null;
  garantia: {
    ativas: number;
    vencem7Dias: number;
    janelaDias: number;
    entreguesJanela: number;
    retornosJanela: number;
    taxaRetorno: number | null;
  };
};

/** Para qual lado a variação é boa. Nunca inferido do sinal. */
export type DirecaoBoaKpi = "cima" | "baixo";

export type ComparativoKpi = {
  valor: number | null;
  anterior: number | null;
  variacaoPercentual: number | null;
  direcaoBoa: DirecaoBoaKpi;
};

export type MedidorMeta = {
  titulo: string;
  atual: number;
  alvo: number;
  percentual: number;
};

export type DemonstracaoResultados = {
  receitaBruta: number;
  /** Peças aplicadas em OS (ItemOS.custoPeca). */
  custoPecas: number;
  /** Mercadorias vendidas no PDV (ItemVenda.custoUnitario × quantidade). */
  custoMercadorias: number;
  lucroBruto: number;
  despesasOperacionais: number;
  despesasPorTipo: readonly { tipo: string; rotulo: string; valor: number }[];
  lucroLiquido: number;
};

export type PainelFinanceiro = {
  kpis: {
    faturamento: ComparativoKpi;
    despesas: ComparativoKpi;
    lucroLiquido: ComparativoKpi;
    saldoPeriodo: ComparativoKpi;
    aReceber: ComparativoKpi;
    aPagar: ComparativoKpi;
    valorEmAbertoOS: ComparativoKpi;
    ticketMedio: ComparativoKpi;
  };
  margemLiquidaPercentual: number | null;
  margemLiquidaAlvo: number | null;
  orcamentoReceita: MedidorMeta | null;
  orcamentoDespesa: MedidorMeta | null;
  orcamentoCustoPecas: MedidorMeta | null;
  serieMensal: readonly { mes: string; receita: number; despesas: number; lucro: number }[];
  saldoAcumuladoPorMes: readonly { mes: string; saldo: number }[];
  dre: DemonstracaoResultados;
};

export type DashboardExecutivo = {
  periodo: PeriodoDashboard;
  painel: PainelFinanceiro;
  caixa: BlocoCaixa;
  acoes: AcaoDashboard[];
  operacao: OperacaoDashboard;
  cardsPrincipais: {
    faturamentoMes: ValorComVariacao;
    lucroEstimado: ValorComVariacao;
    receberHojeAtrasado: {
      total: number;
      atrasado: number;
    };
    pagarHojeAtrasado: {
      total: number;
      atrasado: number;
    };
  };
  cardsOperacionais: {
    osAbertas: number;
    osConcluidasMes: number;
    garantiaRetorno: number;
    ticketMedioOS: number;
  };
  graficoResultado6Meses: Array<{
    mes: string;
    receita: number;
    despesas: number;
    lucro: number;
  }>;
  funilOS: Array<{
    status: string;
    label: string;
    quantidade: number;
  }>;
  atencaoHoje: Array<{
    tipo: string;
    titulo: string;
    descricao: string;
    valor?: number;
    href?: string;
    criticidade: "INFO" | "ATENCAO" | "CRITICO";
  }>;
  metasResumo?: {
    emAndamento: number;
    emAtencao: number;
    atrasadas: number;
    principais: Array<{
      id: string;
      titulo: string;
      progresso: number;
      status: string;
    }>;
  };
  garantiasResumo?: {
    ativas: number;
    vencem7Dias: number;
    retornosEmAndamento: number;
    retornosFinalizadosMes: number;
    taxaRetorno: number;
  };
  ultimasMovimentacoes: Array<{
    id: string;
    tipo: string;
    titulo: string;
    subtitulo?: string;
    valor?: number;
    data: string;
    status: string;
    href?: string;
  }>;
};

export type ResultadoDashboardExecutivo =
  | { sucesso: true; dados: DashboardExecutivo }
  | { sucesso: false; erro: string };

/**
 * Recorte operacional da home para quem nao tem `dashboard.financeiro`
 * (Fase 1B-FIX, Parte 1.3): fila de OS, paradas, retirada e garantia — o
 * mesmo shape de `DashboardExecutivo["operacao"]`, sem nenhum dado
 * financeiro (receita, despesas, DRE, orcamento, movimentacoes) na consulta.
 */
export type PainelOperacionalHome = {
  periodo: PeriodoDashboard;
  operacao: OperacaoDashboard;
  metasResumo?: DashboardExecutivo["metasResumo"];
};

export type ResultadoPainelOperacionalHome =
  | { sucesso: true; dados: PainelOperacionalHome }
  | { sucesso: false; erro: string };

type LinhaMesValor = {
  mes: Date;
  total: number | null;
};

type LinhaTicketMedio = {
  media: number | null;
};

type MovimentacaoInterna = {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo?: string;
  valor?: number;
  data: Date;
  status: string;
  href?: string;
};

type PrismaDashboardClient = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

const STATUS_OS_CONCLUIDA = ["PRONTO", "ENTREGUE"] as const;
const STATUS_OS_ABERTA_EXCLUIDOS = ["PRONTO", "ENTREGUE"] as const;
const STATUS_CONTA_PENDENTE = ["PENDENTE", "ATRASADO", "RENEGOCIADO"] as const;
const STATUS_PARCELA_PENDENTE = ["PENDENTE", "ATRASADO"] as const;

function serializarMetaErro(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") {
    return undefined;
  }

  return Object.fromEntries(Object.entries(meta as Record<string, unknown>));
}

function registrarErroDashboard(contexto: string, erro: unknown): void {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[dashboard] falha em consulta", {
      contexto,
      prismaCode: erro.code,
      message: erro.message,
      meta: serializarMetaErro(erro.meta),
    });
    return;
  }

  if (erro instanceof Error) {
    console.error("[dashboard] falha em consulta", {
      contexto,
      message: erro.message,
      stack: erro.stack,
    });
    return;
  }

  console.error("[dashboard] falha em consulta", {
    contexto,
    erro: String(erro),
  });
}

async function executarComFallback<T>(
  contexto: string,
  executar: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await executar();
  } catch (erro) {
    registrarErroDashboard(contexto, erro);
    return fallback;
  }
}

async function validarConectividadeBanco(prismaClient: PrismaDashboardClient): Promise<void> {
  try {
    await prismaClient.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
  } catch (erro) {
    registrarErroDashboard("validarConectividadeBanco", erro);
    throw new Error("Falha de conectividade com o banco para montar o dashboard.");
  }
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);
}

function fimDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);
}

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0);
}

function fimDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59, 999);
}

function adicionarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1, 0, 0, 0, 0);
}

function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function formatarMesPtBr(data: Date): string {
  const bruto = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(data).replace(".", "");
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

function calcularVariacaoPercentual(valorAtual: number, valorAnterior: number): VariacaoPercentual {
  if (valorAnterior === 0 && valorAtual > 0) {
    return {
      tipo: "sem_base",
      texto: "Sem base anterior",
    };
  }

  if (valorAnterior === 0 && valorAtual === 0) {
    return {
      tipo: "sem_variacao",
      texto: "Sem variação",
    };
  }

  const variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;
  return {
    tipo: "percentual",
    valor: variacao,
    texto: "vs. mês anterior",
  };
}

/**
 * Comparação com o período anterior. Sem base (zero, nula ou métrica indefinida)
 * a variação fica nula e a tela mostra "—" — nunca "−100,0%".
 */
function montarComparativo(
  valor: number | null,
  anterior: number | null,
  direcaoBoa: DirecaoBoaKpi
): ComparativoKpi {
  const temBase = valor !== null && anterior !== null && anterior !== 0;

  return {
    valor,
    anterior,
    variacaoPercentual: temBase ? ((valor - anterior) / Math.abs(anterior)) * 100 : null,
    direcaoBoa,
  };
}

function somarMapasMes(...mapas: Map<string, number>[]): Map<string, number> {
  const resultado = new Map<string, number>();

  for (const mapa of mapas) {
    for (const [mes, total] of mapa.entries()) {
      resultado.set(mes, (resultado.get(mes) ?? 0) + total);
    }
  }

  return resultado;
}

function mapearSerieMes(
  inicioJanela: Date,
  receitaPorMes: Map<string, number>,
  despesasPorMes: Map<string, number>
): DashboardExecutivo["graficoResultado6Meses"] {
  return Array.from({ length: 6 }).map((_, indice) => {
    const dataMes = adicionarMeses(inicioJanela, indice);
    const mes = chaveMes(dataMes);
    const receita = receitaPorMes.get(mes) ?? 0;
    const despesas = despesasPorMes.get(mes) ?? 0;

    return {
      mes: formatarMesPtBr(dataMes),
      receita,
      despesas,
      lucro: receita - despesas,
    };
  });
}

function transformarLinhasMes(linhas: LinhaMesValor[]): Map<string, number> {
  const mapa = new Map<string, number>();

  for (const linha of linhas) {
    const mes = chaveMes(new Date(linha.mes));
    mapa.set(mes, Number(linha.total ?? 0));
  }

  return mapa;
}

async function obterReceitaPdvPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', v."criadoEm") AS mes,
             COALESCE(SUM(v."valorTotal"), 0) AS total
      FROM "Venda" v
      WHERE v."criadoEm" >= ${inicio}
        AND v."criadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('month', v."criadoEm")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaPdvPorMes", erro);
    throw erro;
  }
}

async function obterReceitaVendasAprovadasPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', p."dataCriacao") AS mes,
             COALESCE(SUM(p."total"), 0) AS total
      FROM "PedidoVenda" p
      WHERE p."status"::text = 'APROVADO'
        AND p."origem"::text = 'VENDAS'
        AND p."dataCriacao" >= ${inicio}
        AND p."dataCriacao" <= ${fim}
      GROUP BY DATE_TRUNC('month', p."dataCriacao")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaVendasAprovadasPorMes", erro);
    throw erro;
  }
}

async function obterReceitaOSPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', base."referenciaMes") AS mes,
             COALESCE(SUM(base."valorReceita"), 0) AS total
      FROM (
        SELECT os.id,
               os."atualizadoEm" AS "referenciaMes",
               COALESCE(SUM(i."valorCobrado"), 0)::double precision AS "valorReceita",
               os."ehRetornoGarantia" AS "ehRetorno",
               COALESCE(r."valorAdicional", 0)::double precision AS "valorAdicional",
               COALESCE(r."houveCobranca", false) AS "houveCobranca"
        FROM "OrdemServico" os
        LEFT JOIN "ItemOS" i ON i."osId" = os.id
        LEFT JOIN "RetornoGarantiaOS" r ON r.id = os."retornoGarantiaId"
        WHERE os."excluidaEm" IS NULL
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicio}
          AND os."atualizadoEm" <= ${fim}
        GROUP BY os.id, os."atualizadoEm", os."ehRetornoGarantia", r."valorAdicional", r."houveCobranca"
      ) base
      WHERE base."ehRetorno" = false
         OR base."valorReceita" > 0
         OR base."valorAdicional" > 0
         OR base."houveCobranca" = true
      GROUP BY DATE_TRUNC('month', base."referenciaMes")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaOSPorMes", erro);
    throw erro;
  }
}

async function obterCustosPdvPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', v."criadoEm") AS mes,
             COALESCE(SUM(iv."custoUnitario" * iv."quantidade"), 0) AS total
      FROM "ItemVenda" iv
      INNER JOIN "Venda" v ON v.id = iv."vendaId"
      WHERE v."criadoEm" >= ${inicio}
        AND v."criadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('month', v."criadoEm")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterCustosPdvPorMes", erro);
    throw erro;
  }
}

async function obterCustosOSPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', os."atualizadoEm") AS mes,
             COALESCE(SUM(i."custoPeca"), 0) AS total
      FROM "OrdemServico" os
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NULL
        AND os."status"::text IN ('PRONTO', 'ENTREGUE')
        AND os."atualizadoEm" >= ${inicio}
        AND os."atualizadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('month', os."atualizadoEm")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterCustosOSPorMes", erro);
    throw erro;
  }
}

async function obterDespesasFinanceirasPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC(
               'month',
               CASE WHEN pd."status"::text = 'PAGO' THEN pd."dataPagamento" ELSE pd."dataVencimento" END
             ) AS mes,
             COALESCE(SUM(pd."valor"), 0) AS total
      FROM "ParcelaDespesa" pd
      INNER JOIN "Despesa" d ON d.id = pd."despesaId"
      LEFT JOIN "Cliente" c ON c.id = d."clienteId"
      WHERE (
          (pd."status"::text = 'PAGO' AND pd."dataPagamento" >= ${inicio} AND pd."dataPagamento" <= ${fim})
          OR
          (pd."status"::text = 'PENDENTE' AND pd."dataVencimento" >= ${inicio} AND pd."dataVencimento" <= ${fim})
        )
        AND (c.id IS NULL OR c."papel"::text = 'FORNECEDOR')
      GROUP BY DATE_TRUNC(
        'month',
        CASE WHEN pd."status"::text = 'PAGO' THEN pd."dataPagamento" ELSE pd."dataVencimento" END
      )
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterDespesasFinanceirasPorMes", erro);
    throw erro;
  }
}

async function obterTicketMedioOSMes(
  prismaClient: PrismaDashboardClient,
  inicioMesAtual: Date,
  fimMesAtual: Date
): Promise<number> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaTicketMedio[]>`
      SELECT COALESCE(AVG(base.total_os), 0) AS media
      FROM (
        SELECT os.id,
               COALESCE(SUM(i."valorCobrado"), 0)::double precision AS total_os
        FROM "OrdemServico" os
        LEFT JOIN "ItemOS" i ON i."osId" = os.id
        WHERE os."excluidaEm" IS NULL
          AND os."ehRetornoGarantia" = false
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicioMesAtual}
          AND os."atualizadoEm" <= ${fimMesAtual}
        GROUP BY os.id
      ) base
    `;

    return Number(linhas[0]?.media ?? 0);
  } catch (erro) {
    registrarErroDashboard("obterTicketMedioOSMes", erro);
    throw erro;
  }
}

type LinhaTicketPeriodo = {
  total: number | null;
  quantidade: number | null;
};

type LinhaTempoMedio = {
  media: number | null;
  quantidade: number | null;
};

type LinhaProntasRetirada = {
  quantidade: number | null;
  valor: number | null;
  acimaLimite: number | null;
};

type LinhaValorAberto = {
  total: number | null;
};

const DIAS_LIMITE_PARADO = 7;
const DIAS_LIMITE_RETIRADA = 2;
const JANELA_TAXA_RETORNO_DIAS = 90;

const ROTULO_STATUS_OS: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando orçamento",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando peça",
  EM_MANUTENCAO: "Em manutenção",
  GARANTIA_RETORNO: "Garantia / retorno",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

// Ordem da fila: do primeiro contato até o aparelho pronto na prateleira.
const SEQUENCIA_FILA_OS = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "GARANTIA_RETORNO",
  "PRONTO",
] as const;

const PADRAO_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// O PDV grava descricoes como "Venda PDV <uuid> - PIX". Nenhum id chega à tela.
function limparIdentificadores(texto: string | null | undefined): string {
  return String(texto ?? "")
    .replace(PADRAO_UUID, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s*$/g, "")
    .replace(/^\s*-\s+/g, "")
    .trim();
}

function rotularStatusOS(status: string): string {
  return ROTULO_STATUS_OS[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function diferencaEmDias(inicio: Date, fim: Date): number {
  return Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
}

function resolverIntervaloPeriodo(periodo: PeriodoDashboard, agora: Date): { inicio: Date; fim: Date } {
  const fim = fimDoDia(agora);

  if (periodo === "mes") {
    return { inicio: inicioDoMes(agora), fim };
  }

  const diasParaTras = periodo === "7d" ? 6 : periodo === "30d" ? 29 : 0;
  const inicio = inicioDoDia(new Date(agora.getTime() - diasParaTras * 24 * 60 * 60 * 1000));

  return { inicio, fim };
}

async function obterTicketMedioEntreguesPeriodo(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<number | null> {
  const linhas = await prismaClient.$queryRaw<LinhaTicketPeriodo[]>`
    SELECT COALESCE(SUM(base.total_os), 0)::double precision AS total,
           COUNT(*)::int AS quantidade
    FROM (
      SELECT os.id,
             COALESCE(SUM(i."valorCobrado"), 0)::double precision AS total_os
      FROM "OrdemServico" os
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NULL
        AND os."ehRetornoGarantia" = false
        AND os."status"::text = 'ENTREGUE'
        AND os."atualizadoEm" >= ${inicio}
        AND os."atualizadoEm" <= ${fim}
      GROUP BY os.id
    ) base
  `;

  const quantidade = Number(linhas[0]?.quantidade ?? 0);

  if (quantidade <= 0) {
    return null;
  }

  return Number(linhas[0]?.total ?? 0) / quantidade;
}

async function obterTempoMedioReparoDias(
  prismaClient: PrismaDashboardClient,
  inicio: Date
): Promise<number | null> {
  const linhas = await prismaClient.$queryRaw<LinhaTempoMedio[]>`
    SELECT AVG(EXTRACT(EPOCH FROM (os."atualizadoEm" - os."criadoEm")) / 86400.0)::double precision AS media,
           COUNT(*)::int AS quantidade
    FROM "OrdemServico" os
    WHERE os."excluidaEm" IS NULL
      AND os."status"::text = 'PRONTO'
      AND os."atualizadoEm" >= ${inicio}
  `;

  if (Number(linhas[0]?.quantidade ?? 0) <= 0) {
    return null;
  }

  return Number(linhas[0]?.media ?? 0);
}

async function obterProntasAguardandoRetirada(
  prismaClient: PrismaDashboardClient,
  limiteRetirada: Date
): Promise<{ quantidade: number; valor: number; acimaLimite: number }> {
  const linhas = await prismaClient.$queryRaw<LinhaProntasRetirada[]>`
    SELECT COUNT(*)::int AS quantidade,
           COALESCE(SUM(base.valor), 0)::double precision AS valor,
           COUNT(*) FILTER (WHERE base."atualizadoEm" < ${limiteRetirada})::int AS "acimaLimite"
    FROM (
      SELECT os.id,
             os."atualizadoEm",
             COALESCE(SUM(i."valorCobrado"), 0)::double precision AS valor
      FROM "OrdemServico" os
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NULL
        AND os."archivedAt" IS NULL
        AND os."status"::text = 'PRONTO'
      GROUP BY os.id, os."atualizadoEm"
    ) base
  `;

  return {
    quantidade: Number(linhas[0]?.quantidade ?? 0),
    valor: Number(linhas[0]?.valor ?? 0),
    acimaLimite: Number(linhas[0]?.acimaLimite ?? 0),
  };
}

async function obterValorEmAbertoOS(prismaClient: PrismaDashboardClient): Promise<number> {
  const linhas = await prismaClient.$queryRaw<LinhaValorAberto[]>`
    SELECT COALESCE(SUM(i."valorCobrado"), 0)::double precision AS total
    FROM "OrdemServico" os
    LEFT JOIN "ItemOS" i ON i."osId" = os.id
    WHERE os."excluidaEm" IS NULL
      AND os."archivedAt" IS NULL
      AND os."status"::text <> 'ENTREGUE'
  `;

  return Number(linhas[0]?.total ?? 0);
}

type LinhaDespesasPeriodo = {
  operacionais: number | null;
  custoPecas: number | null;
  custoPdv: number | null;
};

type LinhaFluxoPeriodo = {
  entrou: number | null;
  saiu: number | null;
};

type LinhaTotalSimples = {
  total: number | null;
};

type LinhaFluxoMes = {
  mes: Date;
  entrou: number | null;
  saiu: number | null;
};

type LinhaDespesaTipo = {
  tipo: string | null;
  total: number | null;
};

const ROTULO_TIPO_DESPESA: Record<string, string> = {
  UNICA: "Única",
  PARCELADA: "Parcelada",
  FIXA_MENSAL: "Fixa mensal",
};

async function obterDespesasPeriodo(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<{ operacionais: number; custoPecas: number; custoPdv: number }> {
  const linhas = await prismaClient.$queryRaw<LinhaDespesasPeriodo[]>`
    SELECT
      (
        SELECT COALESCE(SUM(pd."valor"), 0)::double precision
        FROM "ParcelaDespesa" pd
        INNER JOIN "Despesa" d ON d.id = pd."despesaId"
        LEFT JOIN "Cliente" c ON c.id = d."clienteId"
        WHERE (
            (pd."status"::text = 'PAGO' AND pd."dataPagamento" >= ${inicio} AND pd."dataPagamento" <= ${fim})
            OR (pd."status"::text = 'PENDENTE' AND pd."dataVencimento" >= ${inicio} AND pd."dataVencimento" <= ${fim})
          )
          AND (c.id IS NULL OR c."papel"::text = 'FORNECEDOR')
      ) AS "operacionais",
      (
        SELECT COALESCE(SUM(i."custoPeca"), 0)::double precision
        FROM "OrdemServico" os
        INNER JOIN "ItemOS" i ON i."osId" = os.id
        WHERE os."excluidaEm" IS NULL
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicio}
          AND os."atualizadoEm" <= ${fim}
      ) AS "custoPecas",
      (
        SELECT COALESCE(SUM(iv."custoUnitario" * iv."quantidade"), 0)::double precision
        FROM "ItemVenda" iv
        INNER JOIN "Venda" v ON v.id = iv."vendaId"
        WHERE v."criadoEm" >= ${inicio} AND v."criadoEm" <= ${fim}
      ) AS "custoPdv"
  `;

  return {
    operacionais: Number(linhas[0]?.operacionais ?? 0),
    custoPecas: Number(linhas[0]?.custoPecas ?? 0),
    custoPdv: Number(linhas[0]?.custoPdv ?? 0),
  };
}

async function obterFluxoCaixaPeriodo(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<{ entrou: number; saiu: number }> {
  const linhas = await prismaClient.$queryRaw<LinhaFluxoPeriodo[]>`
    SELECT
      (
        SELECT COALESCE(SUM(cr."valor"), 0)::double precision
        FROM "ContaReceber" cr
        WHERE cr."status"::text = 'RECEBIDO'
          AND cr."dataRecebimento" >= ${inicio}
          AND cr."dataRecebimento" <= ${fim}
      ) AS "entrou",
      (
        SELECT COALESCE(SUM(pd."valor"), 0)::double precision
        FROM "ParcelaDespesa" pd
        WHERE pd."status"::text = 'PAGO'
          AND pd."dataPagamento" >= ${inicio}
          AND pd."dataPagamento" <= ${fim}
      ) AS "saiu"
  `;

  return {
    entrou: Number(linhas[0]?.entrou ?? 0),
    saiu: Number(linhas[0]?.saiu ?? 0),
  };
}

/** Saldo em aberto a receber na data de corte (o que ainda nao tinha sido recebido ate ali). */
async function obterSaldoAbertoReceber(
  prismaClient: PrismaDashboardClient,
  corte: Date
): Promise<number> {
  const linhas = await prismaClient.$queryRaw<LinhaTotalSimples[]>`
    SELECT COALESCE(SUM(cr."valor"), 0)::double precision AS total
    FROM "ContaReceber" cr
    WHERE cr."criadoEm" <= ${corte}
      AND (cr."dataRecebimento" IS NULL OR cr."dataRecebimento" > ${corte})
  `;

  return Number(linhas[0]?.total ?? 0);
}

async function obterSaldoAbertoPagar(
  prismaClient: PrismaDashboardClient,
  corte: Date
): Promise<number> {
  const linhas = await prismaClient.$queryRaw<LinhaTotalSimples[]>`
    SELECT COALESCE(SUM(pd."valor"), 0)::double precision AS total
    FROM "ParcelaDespesa" pd
    WHERE pd."criadoEm" <= ${corte}
      AND (pd."dataPagamento" IS NULL OR pd."dataPagamento" > ${corte})
  `;

  return Number(linhas[0]?.total ?? 0);
}

async function obterFluxoCaixaPorMes(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, { entrou: number; saiu: number }>> {
  const linhas = await prismaClient.$queryRaw<LinhaFluxoMes[]>`
    SELECT base.mes AS mes,
           COALESCE(SUM(base.entrou), 0)::double precision AS entrou,
           COALESCE(SUM(base.saiu), 0)::double precision AS saiu
    FROM (
      SELECT DATE_TRUNC('month', cr."dataRecebimento") AS mes,
             cr."valor"::double precision AS entrou,
             0::double precision AS saiu
      FROM "ContaReceber" cr
      WHERE cr."status"::text = 'RECEBIDO'
        AND cr."dataRecebimento" >= ${inicio}
        AND cr."dataRecebimento" <= ${fim}

      UNION ALL

      SELECT DATE_TRUNC('month', pd."dataPagamento") AS mes,
             0::double precision AS entrou,
             pd."valor"::double precision AS saiu
      FROM "ParcelaDespesa" pd
      WHERE pd."status"::text = 'PAGO'
        AND pd."dataPagamento" >= ${inicio}
        AND pd."dataPagamento" <= ${fim}
    ) base
    GROUP BY base.mes
  `;

  const mapa = new Map<string, { entrou: number; saiu: number }>();

  for (const linha of linhas) {
    mapa.set(chaveMes(new Date(linha.mes)), {
      entrou: Number(linha.entrou ?? 0),
      saiu: Number(linha.saiu ?? 0),
    });
  }

  return mapa;
}

async function obterDespesasPorTipoPeriodo(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Array<{ tipo: string; rotulo: string; valor: number }>> {
  const linhas = await prismaClient.$queryRaw<LinhaDespesaTipo[]>`
    SELECT d."tipo"::text AS tipo,
           COALESCE(SUM(pd."valor"), 0)::double precision AS total
    FROM "ParcelaDespesa" pd
    INNER JOIN "Despesa" d ON d.id = pd."despesaId"
    LEFT JOIN "Cliente" c ON c.id = d."clienteId"
    WHERE (
        (pd."status"::text = 'PAGO' AND pd."dataPagamento" >= ${inicio} AND pd."dataPagamento" <= ${fim})
        OR (pd."status"::text = 'PENDENTE' AND pd."dataVencimento" >= ${inicio} AND pd."dataVencimento" <= ${fim})
      )
      AND (c.id IS NULL OR c."papel"::text = 'FORNECEDOR')
    GROUP BY d."tipo"
    ORDER BY 2 DESC
  `;

  return linhas.map((linha) => {
    const tipo = String(linha.tipo ?? "OUTRA");

    return {
      tipo,
      rotulo: ROTULO_TIPO_DESPESA[tipo] ?? tipo,
      valor: Number(linha.total ?? 0),
    };
  });
}

function mapearStatusMovimentacao(status: string): string {
  const statusUpper = status.toUpperCase();

  if (["PAGO", "RECEBIDO", "ENTREGUE", "PRONTO", "CONCLUIDA", "CONCLUIDO"].includes(statusUpper)) {
    return "Concluído";
  }

  if (["ATENCAO", "ATRASADA", "ATRASADO", "PENDENTE"].includes(statusUpper)) {
    return statusUpper === "ATRASADA" || statusUpper === "ATRASADO" ? "Atrasado" : "Pendente";
  }

  if (["GARANTIA_RETORNO", "EM_ANALISE"].includes(statusUpper)) {
    return "Em garantia";
  }

  if (statusUpper === "CANCELADO" || statusUpper === "CANCELADA") {
    return "Cancelado";
  }

  return "Pendente";
}

function calcularProgressoMeta(parametros: {
  tipoValor: "DINHEIRO" | "QUANTIDADE" | "PERCENTUAL" | "CHECKLIST";
  valorAtual: number;
  valorAlvo: number | null;
}): number {
  if (parametros.tipoValor === "CHECKLIST") {
    return Math.max(0, Math.min(100, Math.round(parametros.valorAtual)));
  }

  if (!parametros.valorAlvo || parametros.valorAlvo <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((parametros.valorAtual / parametros.valorAlvo) * 100)));
}

export async function obterDashboardExecutivo(
  periodo: PeriodoDashboard = "hoje"
): Promise<DashboardExecutivo> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "dashboard.financeiro");
  const prisma = contexto.prisma;
  await validarConectividadeBanco(prisma);

  const agora = new Date();
  const inicioHoje = inicioDoDia(agora);
  const fimHoje = fimDoDia(agora);
  const intervaloPeriodo = resolverIntervaloPeriodo(periodo, agora);
  const limiteParado = new Date(inicioHoje.getTime() - DIAS_LIMITE_PARADO * 24 * 60 * 60 * 1000);
  const limiteRetirada = new Date(inicioHoje.getTime() - DIAS_LIMITE_RETIRADA * 24 * 60 * 60 * 1000);
  const inicioJanelaRetorno = inicioDoDia(
    new Date(agora.getTime() - JANELA_TAXA_RETORNO_DIAS * 24 * 60 * 60 * 1000)
  );
  const inicio30Dias = inicioDoDia(new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000));
  const inicioMesAtual = inicioDoMes(agora);
  const fimMesAtual = fimDoMes(agora);

  const dataMesAnterior = adicionarMeses(inicioMesAtual, -1);
  const inicioMesAnterior = inicioDoMes(dataMesAnterior);

  const inicioJanela6Meses = adicionarMeses(inicioMesAtual, -5);
  const inicioJanela12Meses = adicionarMeses(inicioMesAtual, -11);

  const [
    receitaMensalPadrao,
    custosPdvMesMap,
    custosOSMesMap,
    despesasFinanceirasMesMap,
    receberHojeTotal,
    receberAtrasadoTotal,
    pagarHojeTotal,
    pagarAtrasadoTotal,
    osAbertas,
    osConcluidasMes,
    garantiaRetornoAbertas,
    ticketMedioOS,
    aguardandoOrcamento,
    aguardandoAprovacao,
    aprovadas,
    emExecucao,
    garantiaRetornoFunil,
    entreguesNoMes,
    contasReceberAtrasadas,
    contasPagarAtrasadas,
    osSemAtualizacao,
    garantiasVencem7Dias,
    retornosEmAndamento,
    metasAtrasadas,
    metasEmAtencao,
    estoqueBaixoTotal,
    metasPrincipais,
    totalMetasEmAndamento,
    totalMetasAtencao,
    totalMetasAtrasadas,
    garantiasAtivas,
    retornosFinalizadosMes,
    termosComRetorno,
    totalTermosGarantia,
    vendasRecentes,
    recebimentosRecentes,
    pagamentosRecentes,
    osRecentes,
    retornosRecentes,
    historicosMetasRecentes,
  ] = await Promise.all([
    executarComFallback(
      "cards.grafico.receitaMensalPadrao",
      () => obterReceitaMensalPadrao(inicioJanela12Meses, fimMesAtual, prisma),
      []
    ),
    executarComFallback(
      "cards.grafico.custosPdvMesMap",
      () => obterCustosPdvPorMes(prisma, inicioJanela12Meses, fimMesAtual),
      new Map<string, number>()
    ),
    executarComFallback(
      "cards.grafico.custosOSMesMap",
      () => obterCustosOSPorMes(prisma, inicioJanela12Meses, fimMesAtual),
      new Map<string, number>()
    ),
    executarComFallback(
      "cards.grafico.despesasFinanceirasMesMap",
      () => obterDespesasFinanceirasPorMes(prisma, inicioJanela12Meses, fimMesAtual),
      new Map<string, number>()
    ),
    prisma.contaReceber.aggregate({
      where: {
        status: { in: [...STATUS_CONTA_PENDENTE] },
        dataVencimento: { lte: fimHoje },
      },
      _sum: { valor: true },
    }),
    prisma.contaReceber.aggregate({
      where: {
        status: { in: [...STATUS_CONTA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
    }),
    prisma.parcelaDespesa.aggregate({
      where: {
        status: { in: [...STATUS_PARCELA_PENDENTE] },
        dataVencimento: { lte: fimHoje },
      },
      _sum: { valor: true },
    }),
    prisma.parcelaDespesa.aggregate({
      where: {
        status: { in: [...STATUS_PARCELA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        archivedAt: null,
        status: { notIn: [...STATUS_OS_ABERTA_EXCLUIDOS] },
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        ehRetornoGarantia: false,
        status: { in: [...STATUS_OS_CONCLUIDA] },
        atualizadoEm: { gte: inicioMesAtual, lte: fimMesAtual },
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        ehRetornoGarantia: true,
        archivedAt: null,
        status: { notIn: [...STATUS_OS_CONCLUIDA] },
      },
    }),
    executarComFallback(
      "cardsOperacionais.ticketMedioOS",
      () => obterTicketMedioOSMes(prisma, inicioMesAtual, fimMesAtual),
      0
    ),
    prisma.ordemServico.count({ where: { excluidaEm: null, status: "AGUARDANDO_ORCAMENTO" } }),
    prisma.ordemServico.count({ where: { excluidaEm: null, status: "AGUARDANDO_APROVACAO" } }),
    prisma.ordemServico.count({ where: { excluidaEm: null, status: "APROVADO" } }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        status: { in: ["AGUARDANDO_PECA", "EM_MANUTENCAO", "PRONTO"] },
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        ehRetornoGarantia: true,
        archivedAt: null,
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        status: "ENTREGUE",
        atualizadoEm: { gte: inicioMesAtual, lte: fimMesAtual },
      },
    }),
    prisma.contaReceber.aggregate({
      where: {
        status: { in: [...STATUS_CONTA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
      _count: { id: true },
    }),
    prisma.parcelaDespesa.aggregate({
      where: {
        status: { in: [...STATUS_PARCELA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
      _count: { id: true },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        archivedAt: null,
        status: { notIn: [...STATUS_OS_CONCLUIDA] },
        atualizadoEm: { lt: new Date(inicioHoje.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { gte: inicioHoje, lte: fimDoDia(new Date(inicioHoje.getTime() + 7 * 24 * 60 * 60 * 1000)) },
      },
    }),
    prisma.retornoGarantiaOS.count({
      where: {
        finalizadoEm: null,
        osRetorno: {
          is: {
            excluidaEm: null,
          },
        },
      },
    }),
    executarComFallback(
      "atencao.metasAtrasadas",
      () =>
        prisma.meta.count({
          where: { excluidaEm: null, status: "ATRASADA" },
        }),
      0
    ),
    executarComFallback(
      "atencao.metasEmAtencao",
      () =>
        prisma.meta.count({
          where: { excluidaEm: null, status: "ATENCAO" },
        }),
      0
    ),
    executarComFallback(
      "atencao.estoqueBaixoTotal",
      () =>
        prisma.produto
          .findMany({
            where: { ativo: true },
            select: {
              quantidadeEstoque: true,
              estoqueMinimo: true,
            },
          })
          .then(
            (produtos) =>
              produtos.filter(
                (produto) =>
                  Number(produto.quantidadeEstoque ?? 0) <= Number(produto.estoqueMinimo ?? 0)
              ).length
          ),
      0
    ),
    executarComFallback("metas.principais", () => prisma.meta.findMany({
      where: {
        excluidaEm: null,
        status: { in: ["EM_ANDAMENTO", "ATENCAO", "ATRASADA"] },
      },
      select: {
        id: true,
        titulo: true,
        status: true,
        tipoValor: true,
        valorAtual: true,
        valorAlvo: true,
      },
      orderBy: [
        { prioridade: "desc" },
        { dataPrazo: "asc" },
      ],
      take: 3,
    }), []),
    executarComFallback(
      "metas.totalEmAndamento",
      () => prisma.meta.count({ where: { excluidaEm: null, status: "EM_ANDAMENTO" } }),
      0
    ),
    executarComFallback(
      "metas.totalEmAtencao",
      () => prisma.meta.count({ where: { excluidaEm: null, status: "ATENCAO" } }),
      0
    ),
    executarComFallback(
      "metas.totalAtrasadas",
      () => prisma.meta.count({ where: { excluidaEm: null, status: "ATRASADA" } }),
      0
    ),
    executarComFallback("garantias.ativas", () => prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { gte: inicioHoje },
      },
    }), 0),
    executarComFallback("garantias.retornosFinalizadosMes", () => prisma.retornoGarantiaOS.count({
      where: {
        finalizadoEm: { gte: inicioMesAtual, lte: fimMesAtual },
      },
    }), 0),
    executarComFallback("garantias.termosComRetorno", () => prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        retornos: { some: {} },
      },
    }), 0),
    executarComFallback("garantias.totalTermosGarantia", () => prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
      },
    }), 0),
    executarComFallback("movimentacoes.vendasRecentes", () => prisma.venda.findMany({
      take: 4,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        valorTotal: true,
        criadoEm: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }), []),
    executarComFallback("movimentacoes.recebimentosRecentes", () => prisma.contaReceber.findMany({
      take: 4,
      where: { status: "RECEBIDO" },
      orderBy: { dataRecebimento: "desc" },
      select: {
        id: true,
        descricao: true,
        valor: true,
        dataRecebimento: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }), []),
    executarComFallback("movimentacoes.pagamentosRecentes", () => prisma.parcelaDespesa.findMany({
      take: 4,
      where: { status: "PAGO" },
      orderBy: { dataPagamento: "desc" },
      select: {
        id: true,
        valor: true,
        dataPagamento: true,
        despesa: { select: { descricao: true, fornecedor: true } },
      },
    }), []),
    executarComFallback("movimentacoes.osRecentes", () => prisma.ordemServico.findMany({
      take: 4,
      where: { excluidaEm: null },
      orderBy: { atualizadoEm: "desc" },
      select: {
        id: true,
        numeroOs: true,
        status: true,
        equipamento: true,
        ehRetornoGarantia: true,
        atualizadoEm: true,
      },
    }), []),
    executarComFallback("movimentacoes.retornosRecentes", () => prisma.retornoGarantiaOS.findMany({
      take: 3,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        motivo: true,
        resultado: true,
        criadoEm: true,
        finalizadoEm: true,
        osRetorno: { select: { id: true, numeroOs: true } },
      },
    }), []),
    executarComFallback("movimentacoes.historicosMetasRecentes", () => prisma.historicoMeta.findMany({
      take: 3,
      orderBy: { criadoEm: "desc" },
      where: {
        meta: {
          excluidaEm: null,
        },
      },
      select: {
        id: true,
        descricao: true,
        criadoEm: true,
        meta: {
          select: {
            id: true,
            titulo: true,
            status: true,
          },
        },
      },
    }), []),
  ]);

  const [
    entrouPeriodo,
    saiuPeriodo,
    filaPorStatus,
    osParadasLista,
    osParadasTotal,
    prontasRetirada,
    valorEmAberto,
    tempoMedioReparoDias,
    ticketMedioPeriodo,
    entreguesJanelaRetorno,
    retornosJanelaRetorno,
  ] = await Promise.all([
    executarComFallback(
      "caixa.entrouPeriodo",
      () =>
        prisma.contaReceber.aggregate({
          where: {
            status: "RECEBIDO",
            dataRecebimento: { gte: intervaloPeriodo.inicio, lte: intervaloPeriodo.fim },
          },
          _sum: { valor: true },
        }),
      { _sum: { valor: null } }
    ),
    executarComFallback(
      "caixa.saiuPeriodo",
      () =>
        prisma.parcelaDespesa.aggregate({
          where: {
            status: "PAGO",
            dataPagamento: { gte: intervaloPeriodo.inicio, lte: intervaloPeriodo.fim },
          },
          _sum: { valor: true },
        }),
      { _sum: { valor: null } }
    ),
    executarComFallback(
      "operacao.filaPorStatus",
      () =>
        prisma.ordemServico.groupBy({
          by: ["status"],
          where: {
            excluidaEm: null,
            archivedAt: null,
            status: { not: "ENTREGUE" },
          },
          _count: { _all: true },
        }),
      []
    ),
    executarComFallback(
      "operacao.osParadasLista",
      () =>
        prisma.ordemServico.findMany({
          where: {
            excluidaEm: null,
            archivedAt: null,
            status: { not: "ENTREGUE" },
            atualizadoEm: { lt: limiteParado },
          },
          select: {
            id: true,
            numeroOs: true,
            equipamento: true,
            status: true,
            atualizadoEm: true,
            cliente: { select: { nomeRazaoSocial: true } },
          },
          orderBy: { atualizadoEm: "asc" },
          take: 8,
        }),
      []
    ),
    executarComFallback(
      "operacao.osParadasTotal",
      () =>
        prisma.ordemServico.count({
          where: {
            excluidaEm: null,
            archivedAt: null,
            status: { not: "ENTREGUE" },
            atualizadoEm: { lt: limiteParado },
          },
        }),
      0
    ),
    executarComFallback(
      "operacao.prontasAguardandoRetirada",
      () => obterProntasAguardandoRetirada(prisma, limiteRetirada),
      { quantidade: 0, valor: 0, acimaLimite: 0 }
    ),
    executarComFallback("operacao.valorEmAberto", () => obterValorEmAbertoOS(prisma), 0),
    executarComFallback(
      "operacao.tempoMedioReparoDias",
      () => obterTempoMedioReparoDias(prisma, inicio30Dias),
      null
    ),
    executarComFallback(
      "operacao.ticketMedioOS",
      () => obterTicketMedioEntreguesPeriodo(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      null
    ),
    executarComFallback(
      "garantias.entreguesJanela",
      () =>
        prisma.ordemServico.count({
          where: {
            excluidaEm: null,
            status: "ENTREGUE",
            atualizadoEm: { gte: inicioJanelaRetorno },
          },
        }),
      0
    ),
    executarComFallback(
      "garantias.retornosJanela",
      () => prisma.retornoGarantiaOS.count({ where: { criadoEm: { gte: inicioJanelaRetorno } } }),
      0
    ),
  ]);

  const duracaoPeriodo = intervaloPeriodo.fim.getTime() - intervaloPeriodo.inicio.getTime();
  const intervaloAnterior = {
    inicio: new Date(intervaloPeriodo.inicio.getTime() - duracaoPeriodo - 1),
    fim: new Date(intervaloPeriodo.inicio.getTime() - 1),
  };

  const [
    receitaPeriodo,
    receitaPeriodoAnterior,
    despesasPeriodo,
    despesasPeriodoAnterior,
    fluxoPeriodo,
    fluxoPeriodoAnterior,
    receberEmAberto,
    receberEmAbertoAnterior,
    pagarEmAberto,
    pagarEmAbertoAnterior,
    ticketMedioAnterior,
    fluxoPorMes,
    despesasPorTipo,
    metasAtivas,
  ] = await Promise.all([
    executarComFallback(
      "painel.receitaPeriodo",
      () => obterReceitaTotalPadrao(intervaloPeriodo.inicio, intervaloPeriodo.fim, prisma),
      0
    ),
    executarComFallback(
      "painel.receitaPeriodoAnterior",
      () => obterReceitaTotalPadrao(intervaloAnterior.inicio, intervaloAnterior.fim, prisma),
      0
    ),
    executarComFallback(
      "painel.despesasPeriodo",
      () => obterDespesasPeriodo(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      { operacionais: 0, custoPecas: 0, custoPdv: 0 }
    ),
    executarComFallback(
      "painel.despesasPeriodoAnterior",
      () => obterDespesasPeriodo(prisma, intervaloAnterior.inicio, intervaloAnterior.fim),
      { operacionais: 0, custoPecas: 0, custoPdv: 0 }
    ),
    executarComFallback(
      "painel.fluxoPeriodo",
      () => obterFluxoCaixaPeriodo(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      { entrou: 0, saiu: 0 }
    ),
    executarComFallback(
      "painel.fluxoPeriodoAnterior",
      () => obterFluxoCaixaPeriodo(prisma, intervaloAnterior.inicio, intervaloAnterior.fim),
      { entrou: 0, saiu: 0 }
    ),
    executarComFallback(
      "painel.receberEmAberto",
      () => obterSaldoAbertoReceber(prisma, intervaloPeriodo.fim),
      0
    ),
    executarComFallback(
      "painel.receberEmAbertoAnterior",
      () => obterSaldoAbertoReceber(prisma, intervaloAnterior.fim),
      0
    ),
    executarComFallback(
      "painel.pagarEmAberto",
      () => obterSaldoAbertoPagar(prisma, intervaloPeriodo.fim),
      0
    ),
    executarComFallback(
      "painel.pagarEmAbertoAnterior",
      () => obterSaldoAbertoPagar(prisma, intervaloAnterior.fim),
      0
    ),
    executarComFallback(
      "painel.ticketMedioAnterior",
      () => obterTicketMedioEntreguesPeriodo(prisma, intervaloAnterior.inicio, intervaloAnterior.fim),
      null
    ),
    executarComFallback(
      "painel.fluxoPorMes",
      () => obterFluxoCaixaPorMes(prisma, inicioJanela12Meses, fimMesAtual),
      new Map<string, { entrou: number; saiu: number }>()
    ),
    executarComFallback(
      "painel.despesasPorTipo",
      () => obterDespesasPorTipoPeriodo(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      []
    ),
    executarComFallback(
      "painel.metasAtivas",
      () =>
        prisma.meta.findMany({
          where: {
            excluidaEm: null,
            status: { in: ["EM_ANDAMENTO", "ATENCAO", "ATRASADA"] },
            valorAlvo: { not: null },
          },
          select: {
            id: true,
            titulo: true,
            categoria: true,
            tipoValor: true,
            direcao: true,
            metricaAutomatica: true,
            valorAlvo: true,
          },
          orderBy: { prioridade: "desc" },
        }),
      []
    ),
  ]);

  const receitaPorMes = new Map<string, number>();
  for (const linha of receitaMensalPadrao) {
    receitaPorMes.set(chaveMes(new Date(linha.mes)), Number(linha.valor ?? 0));
  }
  const despesasPorMes = somarMapasMes(despesasFinanceirasMesMap, custosPdvMesMap, custosOSMesMap);

  const graficoResultado6Meses = mapearSerieMes(inicioJanela6Meses, receitaPorMes, despesasPorMes);

  // Série de até 12 meses. Meses iniciais sem nenhum dado são descartados em vez de virar zero.
  const serieMensalCompleta = Array.from({ length: 12 }).map((_, indice) => {
    const dataMes = adicionarMeses(inicioJanela12Meses, indice);
    const chave = chaveMes(dataMes);
    const receita = receitaPorMes.get(chave) ?? 0;
    const despesas = despesasPorMes.get(chave) ?? 0;

    return { chave, mes: formatarMesPtBr(dataMes), receita, despesas, lucro: receita - despesas };
  });

  const primeiroMesComDado = serieMensalCompleta.findIndex(
    (linha) => linha.receita !== 0 || linha.despesas !== 0
  );
  const serieMensal = (primeiroMesComDado < 0 ? serieMensalCompleta : serieMensalCompleta.slice(primeiroMesComDado)).map(
    ({ mes, receita, despesas, lucro }) => ({ mes, receita, despesas, lucro })
  );

  let saldoCorrente = 0;
  const saldoAcumuladoPorMes = (primeiroMesComDado < 0
    ? serieMensalCompleta
    : serieMensalCompleta.slice(primeiroMesComDado)
  ).map((linha) => {
    const fluxo = fluxoPorMes.get(linha.chave) ?? { entrou: 0, saiu: 0 };
    saldoCorrente += fluxo.entrou - fluxo.saiu;

    return { mes: linha.mes, saldo: saldoCorrente };
  });

  const despesasTotaisPeriodo =
    despesasPeriodo.operacionais + despesasPeriodo.custoPecas + despesasPeriodo.custoPdv;
  const despesasTotaisAnterior =
    despesasPeriodoAnterior.operacionais +
    despesasPeriodoAnterior.custoPecas +
    despesasPeriodoAnterior.custoPdv;

  const lucroLiquidoPeriodo = receitaPeriodo - despesasTotaisPeriodo;
  const lucroLiquidoAnterior = receitaPeriodoAnterior - despesasTotaisAnterior;

  const custoPecasTotal = despesasPeriodo.custoPecas + despesasPeriodo.custoPdv;
  const lucroBruto = receitaPeriodo - custoPecasTotal;

  const margemLiquidaPercentual =
    receitaPeriodo > 0 ? (lucroLiquidoPeriodo / receitaPeriodo) * 100 : null;

  const metasDisponiveis = metasAtivas.filter((meta) => typeof meta.valorAlvo === "number");

  const metaMargem = metasDisponiveis.find(
    (meta) => meta.tipoValor === "PERCENTUAL" && meta.categoria === "FINANCEIRA"
  );

  const metaReceita = metasDisponiveis.find(
    (meta) =>
      meta.tipoValor === "DINHEIRO" &&
      (meta.metricaAutomatica === "RECEBIMENTOS_FINANCEIRO" ||
        meta.metricaAutomatica === "FATURAMENTO_OS" ||
        meta.metricaAutomatica === "FATURAMENTO_PDV" ||
        (meta.categoria === "FINANCEIRA" && meta.direcao === "MAIOR_MELHOR"))
  );

  const metaDespesa = metasDisponiveis.find(
    (meta) =>
      meta.id !== metaReceita?.id &&
      meta.tipoValor === "DINHEIRO" &&
      (meta.metricaAutomatica === "DESPESAS_FINANCEIRO" ||
        (meta.categoria === "FINANCEIRA" && meta.direcao === "MENOR_MELHOR"))
  );

  // Não existe métrica de "custo de peças" em MetricaAutomaticaMeta; o vínculo possível
  // sem tocar no schema é uma meta de ESTOQUE em dinheiro. Sem ela, o medidor fica vazio.
  const metaCustoPecas = metasDisponiveis.find(
    (meta) =>
      meta.id !== metaReceita?.id &&
      meta.id !== metaDespesa?.id &&
      meta.tipoValor === "DINHEIRO" &&
      meta.categoria === "ESTOQUE"
  );

  const montarMedidor = (
    meta: { titulo: string; valorAlvo: number | null } | undefined,
    atual: number
  ): MedidorMeta | null => {
    if (!meta || typeof meta.valorAlvo !== "number" || meta.valorAlvo <= 0) {
      return null;
    }

    return {
      titulo: meta.titulo,
      atual,
      alvo: meta.valorAlvo,
      percentual: (atual / meta.valorAlvo) * 100,
    };
  };

  const painel: PainelFinanceiro = {
    kpis: {
      faturamento: montarComparativo(receitaPeriodo, receitaPeriodoAnterior, "cima"),
      despesas: montarComparativo(despesasTotaisPeriodo, despesasTotaisAnterior, "baixo"),
      lucroLiquido: montarComparativo(lucroLiquidoPeriodo, lucroLiquidoAnterior, "cima"),
      saldoPeriodo: montarComparativo(
        fluxoPeriodo.entrou - fluxoPeriodo.saiu,
        fluxoPeriodoAnterior.entrou - fluxoPeriodoAnterior.saiu,
        "cima"
      ),
      aReceber: montarComparativo(receberEmAberto, receberEmAbertoAnterior, "cima"),
      aPagar: montarComparativo(pagarEmAberto, pagarEmAbertoAnterior, "baixo"),
      // Sem histórico de status da OS, não existe base anterior honesta para este saldo.
      valorEmAbertoOS: montarComparativo(valorEmAberto, null, "cima"),
      ticketMedio: montarComparativo(ticketMedioPeriodo, ticketMedioAnterior, "cima"),
    },
    margemLiquidaPercentual,
    margemLiquidaAlvo: typeof metaMargem?.valorAlvo === "number" ? metaMargem.valorAlvo : null,
    orcamentoReceita: montarMedidor(metaReceita, receitaPeriodo),
    orcamentoDespesa: montarMedidor(metaDespesa, despesasTotaisPeriodo),
    orcamentoCustoPecas: montarMedidor(metaCustoPecas, custoPecasTotal),
    serieMensal,
    saldoAcumuladoPorMes,
    dre: {
      receitaBruta: receitaPeriodo,
      custoPecas: despesasPeriodo.custoPecas,
      custoMercadorias: despesasPeriodo.custoPdv,
      lucroBruto,
      despesasOperacionais: despesasPeriodo.operacionais,
      despesasPorTipo,
      lucroLiquido: lucroLiquidoPeriodo,
    },
  };
  const mesAtualKey = chaveMes(inicioMesAtual);
  const mesAnteriorKey = chaveMes(inicioMesAnterior);

  const faturamentoMesAtual = receitaPorMes.get(mesAtualKey) ?? 0;
  const faturamentoMesAnterior = receitaPorMes.get(mesAnteriorKey) ?? 0;
  const lucroMesAtual = faturamentoMesAtual - (despesasPorMes.get(mesAtualKey) ?? 0);
  const lucroMesAnterior = (receitaPorMes.get(mesAnteriorKey) ?? 0) - (despesasPorMes.get(mesAnteriorKey) ?? 0);

  const atencaoHoje: DashboardExecutivo["atencaoHoje"] = [];

  if ((contasPagarAtrasadas._count.id ?? 0) > 0) {
    atencaoHoje.push({
      tipo: "FINANCEIRO",
      titulo: "Contas a pagar vencidas",
      descricao: `${contasPagarAtrasadas._count.id} parcela(s) vencida(s).`,
      valor: Number(contasPagarAtrasadas._sum.valor ?? 0),
      href: "/financeiro/pagar",
      criticidade: "CRITICO",
    });
  }

  if ((contasReceberAtrasadas._count.id ?? 0) > 0) {
    atencaoHoje.push({
      tipo: "FINANCEIRO",
      titulo: "Contas a receber atrasadas",
      descricao: `${contasReceberAtrasadas._count.id} recebimento(s) em atraso.`,
      valor: Number(contasReceberAtrasadas._sum.valor ?? 0),
      href: "/financeiro/receber",
      criticidade: "ATENCAO",
    });
  }

  if (osSemAtualizacao > 0) {
    atencaoHoje.push({
      tipo: "OPERACAO_OS",
      titulo: "OS sem atualização recente",
      descricao: `${osSemAtualizacao} ordem(ns) aberta(s) sem atualização há mais de 7 dias.`,
      href: "/os",
      criticidade: "ATENCAO",
    });
  }

  if (garantiasVencem7Dias > 0) {
    atencaoHoje.push({
      tipo: "GARANTIAS",
      titulo: "Garantias vencendo em 7 dias",
      descricao: `${garantiasVencem7Dias} garantia(s) perto do vencimento.`,
      href: "/os/garantias",
      criticidade: "ATENCAO",
    });
  }

  if (retornosEmAndamento > 0) {
    atencaoHoje.push({
      tipo: "GARANTIAS",
      titulo: "Retornos de garantia em andamento",
      descricao: `${retornosEmAndamento} retorno(s) aguardando finalização.`,
      href: "/os/garantias",
      criticidade: "INFO",
    });
  }

  if (metasAtrasadas > 0 || metasEmAtencao > 0) {
    atencaoHoje.push({
      tipo: "METAS",
      titulo: "Metas em risco",
      descricao: `${metasAtrasadas} atrasada(s) e ${metasEmAtencao} em atenção.`,
      href: "/metas",
      criticidade: metasAtrasadas > 0 ? "CRITICO" : "ATENCAO",
    });
  }

  const estoqueBaixo = Number(estoqueBaixoTotal ?? 0);

  if (estoqueBaixo > 0) {
    atencaoHoje.push({
      tipo: "ESTOQUE",
      titulo: "Estoque baixo",
      descricao: `${estoqueBaixo} produto(s) no limite mínimo.`,
      href: "/estoque",
      criticidade: "ATENCAO",
    });
  }

  const receberAtrasadoQuantidade = Number(contasReceberAtrasadas._count.id ?? 0);
  const receberAtrasadoValor = Number(contasReceberAtrasadas._sum.valor ?? 0);
  const pagarAtrasadoQuantidade = Number(contasPagarAtrasadas._count.id ?? 0);
  const pagarAtrasadoValor = Number(contasPagarAtrasadas._sum.valor ?? 0);

  const caixa: BlocoCaixa = {
    entrou: Number(entrouPeriodo._sum.valor ?? 0),
    saiu: Number(saiuPeriodo._sum.valor ?? 0),
    receberAtrasado: receberAtrasadoValor,
    pagarAtrasado: pagarAtrasadoValor,
  };

  const acoes: AcaoDashboard[] = [];

  if (pagarAtrasadoQuantidade > 0) {
    acoes.push({
      chave: "pagar-vencidas",
      texto:
        pagarAtrasadoQuantidade === 1
          ? "1 parcela vencida"
          : `${pagarAtrasadoQuantidade} parcelas vencidas`,
      valor: pagarAtrasadoValor,
      href: "/financeiro/pagar",
      severidade: "CRITICO",
    });
  }

  if (receberAtrasadoQuantidade > 0) {
    acoes.push({
      chave: "receber-atrasados",
      texto:
        receberAtrasadoQuantidade === 1
          ? "1 recebimento em atraso"
          : `${receberAtrasadoQuantidade} recebimentos em atraso`,
      valor: receberAtrasadoValor,
      href: "/financeiro/receber",
      severidade: "ATENCAO",
    });
  }

  if (osParadasTotal > 0) {
    acoes.push({
      chave: "os-paradas",
      texto: `${osParadasTotal} OS sem atualização há mais de ${DIAS_LIMITE_PARADO} dias`,
      valor: null,
      href: "/os",
      severidade: "ATENCAO",
    });
  }

  if (prontasRetirada.acimaLimite > 0) {
    acoes.push({
      chave: "prontas-retirada",
      texto:
        prontasRetirada.acimaLimite === 1
          ? `1 aparelho pronto aguardando retirada há mais de ${DIAS_LIMITE_RETIRADA} dias`
          : `${prontasRetirada.acimaLimite} aparelhos prontos aguardando retirada há mais de ${DIAS_LIMITE_RETIRADA} dias`,
      valor: null,
      href: "/os",
      severidade: "ATENCAO",
    });
  }

  const pesoSeveridade: Record<AcaoDashboard["severidade"], number> = {
    CRITICO: 0,
    ATENCAO: 1,
  };

  acoes.sort((a, b) => {
    const diferencaSeveridade = pesoSeveridade[a.severidade] - pesoSeveridade[b.severidade];
    if (diferencaSeveridade !== 0) return diferencaSeveridade;
    return (b.valor ?? 0) - (a.valor ?? 0);
  });

  const contagemFila = new Map<string, number>();
  for (const linha of filaPorStatus) {
    contagemFila.set(String(linha.status), Number(linha._count._all ?? 0));
  }

  const operacao: OperacaoDashboard = {
    fila: SEQUENCIA_FILA_OS.map((status) => ({
      status,
      label: rotularStatusOS(status),
      quantidade: contagemFila.get(status) ?? 0,
      href: `/os?modo=kanban&status=${status}`,
    })),
    parados: {
      diasLimite: DIAS_LIMITE_PARADO,
      quantidade: osParadasTotal,
      lista: osParadasLista.map((os) => ({
        id: os.id,
        numeroOs: os.numeroOs,
        cliente: os.cliente?.nomeRazaoSocial ?? "Cliente não informado",
        aparelho: os.equipamento,
        status: rotularStatusOS(String(os.status)),
        diasParado: diferencaEmDias(os.atualizadoEm, agora),
      })),
    },
    prontasAguardandoRetirada: {
      quantidade: prontasRetirada.quantidade,
      valor: prontasRetirada.valor,
      diasLimite: DIAS_LIMITE_RETIRADA,
      quantidadeAcimaLimite: prontasRetirada.acimaLimite,
    },
    valorEmAberto,
    tempoMedioReparoDias,
    ticketMedioOS: ticketMedioPeriodo,
    garantia: {
      ativas: garantiasAtivas,
      vencem7Dias: garantiasVencem7Dias,
      janelaDias: JANELA_TAXA_RETORNO_DIAS,
      entreguesJanela: entreguesJanelaRetorno,
      retornosJanela: retornosJanelaRetorno,
      taxaRetorno:
        entreguesJanelaRetorno > 0
          ? (retornosJanelaRetorno / entreguesJanelaRetorno) * 100
          : null,
    },
  };

  const movimentacoes: MovimentacaoInterna[] = [
    ...vendasRecentes.map((venda) => ({
      id: `VENDA-${venda.id}`,
      tipo: "Venda",
      titulo: venda.cliente?.nomeRazaoSocial ?? "Venda no PDV",
      subtitulo: venda.cliente ? "Venda no PDV" : undefined,
      valor: Number(venda.valorTotal ?? 0),
      data: venda.criadoEm,
      status: "Concluído",
      href: "/pdv",
    })),
    ...recebimentosRecentes.map((conta) => ({
      id: `RECEBER-${conta.id}`,
      tipo: "Financeiro",
      titulo:
        conta.cliente?.nomeRazaoSocial ??
        (limparIdentificadores(conta.descricao) || "Recebimento registrado"),
      subtitulo: conta.cliente ? limparIdentificadores(conta.descricao) || undefined : undefined,
      valor: Number(conta.valor ?? 0),
      data: conta.dataRecebimento ?? inicioHoje,
      status: "Recebido",
      href: "/financeiro/receber",
    })),
    ...pagamentosRecentes.map((parcela) => ({
      id: `PAGAR-${parcela.id}`,
      tipo: "Financeiro",
      titulo: limparIdentificadores(parcela.despesa.descricao) || "Pagamento de despesa",
      subtitulo: parcela.despesa.fornecedor ?? undefined,
      valor: Number(parcela.valor ?? 0) * -1,
      data: parcela.dataPagamento ?? inicioHoje,
      status: "Pago",
      href: "/financeiro/pagar",
    })),
    ...osRecentes.map((os) => ({
      id: `OS-${os.id}`,
      tipo: "OS",
      titulo: `OS #${os.numeroOs} — ${os.equipamento}`,
      subtitulo: os.ehRetornoGarantia ? "Retorno de garantia" : undefined,
      data: os.atualizadoEm,
      status: mapearStatusMovimentacao(String(os.status)),
      href: "/os",
    })),
    ...retornosRecentes.map((retorno) => ({
      id: `RETORNO-${retorno.id}`,
      tipo: "Garantia",
      titulo: retorno.osRetorno?.numeroOs
        ? `Retorno de garantia — OS #${retorno.osRetorno.numeroOs}`
        : "Retorno de garantia",
      subtitulo: limparIdentificadores(retorno.motivo) || undefined,
      data: retorno.finalizadoEm ?? retorno.criadoEm,
      status: retorno.finalizadoEm ? "Concluído" : "Em garantia",
      href: "/os/garantias",
    })),
    ...historicosMetasRecentes.map((historico) => ({
      id: `META-${historico.id}`,
      tipo: "Meta",
      titulo: historico.meta.titulo,
      subtitulo: limparIdentificadores(historico.descricao) || undefined,
      data: historico.criadoEm,
      status: mapearStatusMovimentacao(historico.meta.status),
      href: "/metas",
    })),
  ];

  const chavesMovimentacao = new Set<string>();
  const ultimasMovimentacoes = movimentacoes
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .filter((item) => {
      const chave = `${item.tipo}-${item.titulo}-${item.data.toISOString().slice(0, 16)}`;
      if (chavesMovimentacao.has(chave)) {
        return false;
      }

      chavesMovimentacao.add(chave);
      return true;
    })
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      subtitulo: item.subtitulo,
      valor: item.valor,
      data: item.data.toISOString(),
      status: item.status,
      href: item.href,
    }));

  const funilOS: DashboardExecutivo["funilOS"] = [
    {
      status: "AGUARDANDO_ORCAMENTO",
      label: "Aguardando orçamento",
      quantidade: aguardandoOrcamento,
    },
    {
      status: "AGUARDANDO_APROVACAO",
      label: "Aguardando aprovação",
      quantidade: aguardandoAprovacao,
    },
    {
      status: "APROVADO",
      label: "Aprovadas",
      quantidade: aprovadas,
    },
    {
      status: "EM_EXECUCAO",
      label: "Em execução",
      quantidade: emExecucao,
    },
    {
      status: "GARANTIA_RETORNO",
      label: "Garantia/Retorno",
      quantidade: garantiaRetornoFunil,
    },
    {
      status: "ENTREGUES_MES",
      label: "Entregues no mês",
      quantidade: entreguesNoMes,
    },
  ];

  return {
    periodo,
    painel,
    caixa,
    acoes,
    operacao,
    cardsPrincipais: {
      faturamentoMes: {
        valor: faturamentoMesAtual,
        variacao: calcularVariacaoPercentual(faturamentoMesAtual, faturamentoMesAnterior),
      },
      lucroEstimado: {
        valor: lucroMesAtual,
        variacao: calcularVariacaoPercentual(lucroMesAtual, lucroMesAnterior),
      },
      receberHojeAtrasado: {
        total: Number(receberHojeTotal._sum.valor ?? 0),
        atrasado: Number(receberAtrasadoTotal._sum.valor ?? 0),
      },
      pagarHojeAtrasado: {
        total: Number(pagarHojeTotal._sum.valor ?? 0),
        atrasado: Number(pagarAtrasadoTotal._sum.valor ?? 0),
      },
    },
    cardsOperacionais: {
      osAbertas,
      osConcluidasMes,
      garantiaRetorno: garantiaRetornoAbertas,
      ticketMedioOS,
    },
    graficoResultado6Meses,
    funilOS,
    atencaoHoje,
    metasResumo: {
      emAndamento: totalMetasEmAndamento,
      emAtencao: totalMetasAtencao,
      atrasadas: totalMetasAtrasadas,
      principais: metasPrincipais.map((meta) => ({
        id: meta.id,
        titulo: meta.titulo,
        progresso: calcularProgressoMeta({
          tipoValor: meta.tipoValor,
          valorAtual: Number(meta.valorAtual ?? 0),
          valorAlvo: meta.valorAlvo,
        }),
        status: mapearStatusMovimentacao(meta.status),
      })),
    },
    garantiasResumo: {
      ativas: garantiasAtivas,
      vencem7Dias: garantiasVencem7Dias,
      retornosEmAndamento,
      retornosFinalizadosMes,
      taxaRetorno:
        totalTermosGarantia > 0
          ? Number(((termosComRetorno / totalTermosGarantia) * 100).toFixed(2))
          : 0,
    },
    ultimasMovimentacoes,
  };
}

export async function obterDashboardExecutivoSeguro(
  periodo: PeriodoDashboard = "hoje"
): Promise<ResultadoDashboardExecutivo> {
  try {
    const dados = await obterDashboardExecutivo(periodo);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[dashboard] falha ao montar dashboard executivo", {
        prismaCode: erro.code,
        message: erro.message,
        meta: serializarMetaErro(erro.meta),
      });

      return {
        sucesso: false,
        erro: "Não foi possível carregar os indicadores do dashboard.",
      };
    }

    if (erro instanceof Error) {
      console.error("[dashboard] falha ao montar dashboard executivo", {
        message: erro.message,
        stack: erro.stack,
      });
    } else {
      console.error("[dashboard] falha ao montar dashboard executivo", {
        erro: String(erro),
      });
    }

    return {
      sucesso: false,
      erro: "Nao foi possivel carregar os indicadores do dashboard.",
    };
  }
}

/**
 * Painel operacional da home para quem NAO tem `dashboard.financeiro`
 * (Fase 1B-FIX, Parte 1.3). Nao exige nenhuma permissao alem de sessao
 * valida — e a contraparte operacional de `obterDashboardExecutivo`, que
 * exige `dashboard.financeiro` e busca receita/despesas/DRE/orcamento
 * junto. Aqui nenhuma dessas consultas financeiras roda: só o necessario
 * para fila de OS, OS paradas, retirada e garantia. O bloco de metas so e
 * buscado quando o usuario tem `metas.ver`.
 */
export async function obterPainelOperacionalHome(
  periodo: PeriodoDashboard = "hoje"
): Promise<PainelOperacionalHome> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  await validarConectividadeBanco(prisma);

  // Esta funcao so roda quando `selecionarSecoesDashboardHome` ja decidiu que
  // a secao financeira esta fora (ver app/(dashboard)/page.tsx); aqui resta
  // decidir so a secao de metas, que e independente da financeira.
  const podeVerMetas = temPermissao(contexto, "metas.ver");

  const agora = new Date();
  const inicioHoje = inicioDoDia(agora);
  const intervaloPeriodo = resolverIntervaloPeriodo(periodo, agora);
  const limiteParado = new Date(inicioHoje.getTime() - DIAS_LIMITE_PARADO * 24 * 60 * 60 * 1000);
  const limiteRetirada = new Date(inicioHoje.getTime() - DIAS_LIMITE_RETIRADA * 24 * 60 * 60 * 1000);
  const inicioJanelaRetorno = inicioDoDia(
    new Date(agora.getTime() - JANELA_TAXA_RETORNO_DIAS * 24 * 60 * 60 * 1000)
  );
  const inicio30Dias = inicioDoDia(new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [
    filaPorStatus,
    osParadasLista,
    osParadasTotal,
    prontasRetirada,
    valorEmAberto,
    tempoMedioReparoDias,
    ticketMedioPeriodo,
    entreguesJanelaRetorno,
    retornosJanelaRetorno,
    garantiasVencem7Dias,
    garantiasAtivas,
  ] = await Promise.all([
    executarComFallback(
      "home.operacao.filaPorStatus",
      () =>
        prisma.ordemServico.groupBy({
          by: ["status"],
          where: { excluidaEm: null, archivedAt: null, status: { not: "ENTREGUE" } },
          _count: { _all: true },
        }),
      []
    ),
    executarComFallback(
      "home.operacao.osParadasLista",
      () =>
        prisma.ordemServico.findMany({
          where: {
            excluidaEm: null,
            archivedAt: null,
            status: { not: "ENTREGUE" },
            atualizadoEm: { lt: limiteParado },
          },
          select: {
            id: true,
            numeroOs: true,
            equipamento: true,
            status: true,
            atualizadoEm: true,
            cliente: { select: { nomeRazaoSocial: true } },
          },
          orderBy: { atualizadoEm: "asc" },
          take: 8,
        }),
      []
    ),
    executarComFallback(
      "home.operacao.osParadasTotal",
      () =>
        prisma.ordemServico.count({
          where: {
            excluidaEm: null,
            archivedAt: null,
            status: { not: "ENTREGUE" },
            atualizadoEm: { lt: limiteParado },
          },
        }),
      0
    ),
    executarComFallback(
      "home.operacao.prontasAguardandoRetirada",
      () => obterProntasAguardandoRetirada(prisma, limiteRetirada),
      { quantidade: 0, valor: 0, acimaLimite: 0 }
    ),
    executarComFallback("home.operacao.valorEmAberto", () => obterValorEmAbertoOS(prisma), 0),
    executarComFallback(
      "home.operacao.tempoMedioReparoDias",
      () => obterTempoMedioReparoDias(prisma, inicio30Dias),
      null
    ),
    executarComFallback(
      "home.operacao.ticketMedioOS",
      () => obterTicketMedioEntreguesPeriodo(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      null
    ),
    executarComFallback(
      "home.garantias.entreguesJanela",
      () =>
        prisma.ordemServico.count({
          where: { excluidaEm: null, status: "ENTREGUE", atualizadoEm: { gte: inicioJanelaRetorno } },
        }),
      0
    ),
    executarComFallback(
      "home.garantias.retornosJanela",
      () => prisma.retornoGarantiaOS.count({ where: { criadoEm: { gte: inicioJanelaRetorno } } }),
      0
    ),
    executarComFallback(
      "home.garantias.vencem7Dias",
      () =>
        prisma.termoGarantiaOS.count({
          where: {
            canceladaEm: null,
            os: { excluidaEm: null },
            dataFimGarantia: {
              gte: inicioHoje,
              lte: fimDoDia(new Date(inicioHoje.getTime() + 7 * 24 * 60 * 60 * 1000)),
            },
          },
        }),
      0
    ),
    executarComFallback(
      "home.garantias.ativas",
      () =>
        prisma.termoGarantiaOS.count({
          where: { canceladaEm: null, os: { excluidaEm: null }, dataFimGarantia: { gte: inicioHoje } },
        }),
      0
    ),
  ]);

  const contagemFila = new Map<string, number>();
  for (const linha of filaPorStatus) {
    contagemFila.set(String(linha.status), Number(linha._count._all ?? 0));
  }

  const operacao: OperacaoDashboard = {
    fila: SEQUENCIA_FILA_OS.map((status) => ({
      status,
      label: rotularStatusOS(status),
      quantidade: contagemFila.get(status) ?? 0,
      href: `/os?modo=kanban&status=${status}`,
    })),
    parados: {
      diasLimite: DIAS_LIMITE_PARADO,
      quantidade: osParadasTotal,
      lista: osParadasLista.map((os) => ({
        id: os.id,
        numeroOs: os.numeroOs,
        cliente: os.cliente?.nomeRazaoSocial ?? "Cliente não informado",
        aparelho: os.equipamento,
        status: rotularStatusOS(String(os.status)),
        diasParado: diferencaEmDias(os.atualizadoEm, agora),
      })),
    },
    prontasAguardandoRetirada: {
      quantidade: prontasRetirada.quantidade,
      valor: prontasRetirada.valor,
      diasLimite: DIAS_LIMITE_RETIRADA,
      quantidadeAcimaLimite: prontasRetirada.acimaLimite,
    },
    valorEmAberto,
    tempoMedioReparoDias,
    ticketMedioOS: ticketMedioPeriodo,
    garantia: {
      ativas: garantiasAtivas,
      vencem7Dias: garantiasVencem7Dias,
      janelaDias: JANELA_TAXA_RETORNO_DIAS,
      entreguesJanela: entreguesJanelaRetorno,
      retornosJanela: retornosJanelaRetorno,
      taxaRetorno:
        entreguesJanelaRetorno > 0 ? (retornosJanelaRetorno / entreguesJanelaRetorno) * 100 : null,
    },
  };

  let metasResumo: DashboardExecutivo["metasResumo"];

  if (podeVerMetas) {
    const [metasPrincipais, totalMetasEmAndamento, totalMetasAtencao, totalMetasAtrasadas] = await Promise.all([
      executarComFallback(
        "home.metas.principais",
        () =>
          prisma.meta.findMany({
            where: { excluidaEm: null, status: { in: ["EM_ANDAMENTO", "ATENCAO", "ATRASADA"] } },
            select: {
              id: true,
              titulo: true,
              status: true,
              tipoValor: true,
              valorAtual: true,
              valorAlvo: true,
            },
            orderBy: [{ prioridade: "desc" }, { dataPrazo: "asc" }],
            take: 3,
          }),
        []
      ),
      executarComFallback(
        "home.metas.totalEmAndamento",
        () => prisma.meta.count({ where: { excluidaEm: null, status: "EM_ANDAMENTO" } }),
        0
      ),
      executarComFallback(
        "home.metas.totalEmAtencao",
        () => prisma.meta.count({ where: { excluidaEm: null, status: "ATENCAO" } }),
        0
      ),
      executarComFallback(
        "home.metas.totalAtrasadas",
        () => prisma.meta.count({ where: { excluidaEm: null, status: "ATRASADA" } }),
        0
      ),
    ]);

    metasResumo = {
      emAndamento: totalMetasEmAndamento,
      emAtencao: totalMetasAtencao,
      atrasadas: totalMetasAtrasadas,
      principais: metasPrincipais.map((meta) => ({
        id: meta.id,
        titulo: meta.titulo,
        progresso: calcularProgressoMeta({
          tipoValor: meta.tipoValor,
          valorAtual: Number(meta.valorAtual ?? 0),
          valorAlvo: meta.valorAlvo,
        }),
        status: mapearStatusMovimentacao(meta.status),
      })),
    };
  }

  return {
    periodo,
    operacao,
    metasResumo,
  };
}

export async function obterPainelOperacionalHomeSeguro(
  periodo: PeriodoDashboard = "hoje"
): Promise<ResultadoPainelOperacionalHome> {
  try {
    const dados = await obterPainelOperacionalHome(periodo);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    console.error("[dashboard] falha ao montar painel operacional da home", {
      message: erro instanceof Error ? erro.message : String(erro),
    });

    return {
      sucesso: false,
      erro: "Não foi possível carregar o painel operacional.",
    };
  }
}
