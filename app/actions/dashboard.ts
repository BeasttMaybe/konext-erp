"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";
import { montarComparativo, type ComparativoKpi, type DirecaoBoaKpi } from "@/lib/dashboard/comparativo-kpi";
import { escopoOrdemServico } from "@/lib/auth/escopos";
import { deDecimal, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import { numeroDaMeta, numeroDaMetaOuNulo } from "@/lib/dominio/metas/valores";
import { paraEstagio, type EtapaOS } from "@/lib/dominio/os/etapas";
import { Prisma } from "@prisma/client";
import {
  agoraNaLoja,
  comoDataDeCalendario,
  fimDoDia as fimDoDiaNaLoja,
  FUSO_HORARIO_PADRAO,
  inicioDoDia as inicioDoDiaNaLoja,
  inicioDoMes as inicioDoMesNaLoja,
  somarDias,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";

/** "custom" (Fase 2A-1): período livre escolhido no `FiltroPeriodo` — só a pill "Personalizado" da home escreve isso na URL; exige `intervaloCustom` (ver `resolverIntervaloPeriodo`) pra ter efeito, senão cai no mesmo comportamento de "hoje". */
export type PeriodoDashboard = "hoje" | "7d" | "30d" | "mes" | "custom";

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

// Reexportados por compatibilidade — a definição real (tipos + regra de
// comparação) vive em lib/dashboard/comparativo-kpi.ts (módulo puro, sem
// Prisma, testado em lib/dashboard/comparativo-kpi.test.ts).
export type { ComparativoKpi, DirecaoBoaKpi };

export type MetasResumoDashboard = {
  emAndamento: number;
  emAtencao: number;
  atrasadas: number;
  principais: Array<{
    id: string;
    titulo: string;
    progresso: number;
    status: string;
    tipoValor: "DINHEIRO" | "QUANTIDADE" | "PERCENTUAL" | "CHECKLIST";
    valorAtual: number;
    valorAlvo: number | null;
    unidade: string | null;
  }>;
};

/** Uma linha do "Fluxo de OS" (Fase 3-2A) — contagem por EtapaOS, não pelo `status` legado de 7 valores. */
export type LinhaFluxoEtapaHome = {
  etapa: EtapaOS;
  label: string;
  quantidade: number;
  href: string;
};

export type VarianteStatusMovimentacaoHome = "orcamento" | "conserto" | "pronto" | "entregue" | "sucesso";

/** Uma linha de "Últimas movimentações" (Fase 3-2A) — OS ou Venda(PDV), nunca dado financeiro (recebimento/pagamento). */
export type LinhaMovimentacaoHome = {
  id: string;
  tipo: "os" | "pdv";
  referencia: string;
  cliente: string;
  descricao: string;
  status: string;
  variante: VarianteStatusMovimentacaoHome;
  valor: number;
  href: string;
  data: string;
};

export type LinhaPendenciaHome = {
  chave: string;
  texto: string;
  valor: number | null;
  href: string;
  severidade: "CRITICO" | "ATENCAO";
};

/**
 * Painel operacional da home (Fase 3-2A) — a base SEMPRE buscada por `/`,
 * com ou sem `dashboard.financeiro`. Estende o recorte da Fase 1B-FIX
 * (fila de OS, paradas, retirada, garantia, metas) com o "Fluxo de OS" por
 * etapa, "Últimas movimentações" (OS + PDV) e "Pendências" operacionais —
 * nenhum dado financeiro (receita, despesas, DRE, orçamento) é buscado aqui.
 */
export type PainelOperacionalHome = {
  periodo: PeriodoDashboard;
  operacao: OperacaoDashboard;
  metasResumo?: MetasResumoDashboard;
  fluxoEtapas: LinhaFluxoEtapaHome[];
  ultimasMovimentacoes: LinhaMovimentacaoHome[];
  pendencias: LinhaPendenciaHome[];
};

export type ResultadoPainelOperacionalHome =
  | { sucesso: true; dados: PainelOperacionalHome }
  | { sucesso: false; erro: string };

/**
 * Recorte financeiro da home (Fase 3-2A) — só buscado quando o contexto tem
 * `dashboard.financeiro`. Profundidade financeira completa (DRE, orçamento,
 * saldo, A receber/pagar) mora em `/financeiro`, com sua própria camada de
 * dados (`app/actions/financeiro-hub.ts`); aqui fica só o essencial pro
 * card de Faturamento e o gráfico de receita da home.
 */
export type FaturamentoHome = {
  comparativo: ComparativoKpi;
  margemLiquidaPercentual: number | null;
  serie: Array<{ dia: string; servicos: number; produtos: number }>;
  pendenciasFinanceiras: LinhaPendenciaHome[];
};

export type ResultadoFaturamentoHome =
  | { sucesso: true; dados: FaturamentoHome }
  | { sucesso: false; erro: string };

type LinhaDiaValor = {
  dia: Date;
  // `::text` no SQL (Fase 2A-3). Era `::double precision`, e cada SUM de
  // numeric virava float antes de sair do banco: o erro de arredondamento
  // nascia no Postgres e nenhuma conversao do lado do JS consertava depois.
  total: string | null;
};

type PrismaDashboardClient = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

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

/**
 * Fronteiras de dia/mês da home — delegam pro único módulo autorizado a
 * calcular isso (lib/datas.ts, Fase 2A-1). `fusoHorario` sempre vem de
 * `contexto.fusoHorario` nos call sites que têm um `ContextoTenantServidor`
 * por perto; sem ele, cai no default do schema (`FUSO_HORARIO_PADRAO`).
 */
function inicioDoDia(data: Date, fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return inicioDoDiaNaLoja(data, fusoHorario);
}

function fimDoDia(data: Date, fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return fimDoDiaNaLoja(data, fusoHorario);
}

function inicioDoMes(data: Date, fusoHorario: string = FUSO_HORARIO_PADRAO): Date {
  return inicioDoMesNaLoja(data, fusoHorario);
}

function chaveDia(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function formatarDiaPtBr(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(data);
}

/** Um ponto por dia, de `inicio` a `fim` inclusive — usado pra série do gráfico de receita da home. */
function construirDiasIntervalo(inicio: Date, fim: Date): Date[] {
  const dias: Date[] = [];
  let cursor = inicioDoDia(inicio);
  const limite = inicioDoDia(fim);

  while (cursor.getTime() <= limite.getTime()) {
    dias.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return dias;
}

/** Mapa dia -> CENTAVOS INTEIROS. Vira reais so em `paraMoeda`, na serie do grafico. */
function transformarLinhasDia(linhas: LinhaDiaValor[]): Map<string, number> {
  const mapa = new Map<string, number>();

  for (const linha of linhas) {
    mapa.set(chaveDia(new Date(linha.dia)), deDecimal(linha.total ?? 0));
  }

  return mapa;
}

function somarMapas(...mapas: Map<string, number>[]): Map<string, number> {
  const resultado = new Map<string, number>();

  for (const mapa of mapas) {
    for (const [chave, total] of mapa.entries()) {
      resultado.set(chave, somar(resultado.get(chave) ?? 0, total));
    }
  }

  return resultado;
}

/**
 * Receita de serviços (OS) por dia — mesma regra de negócio de
 * `obterReceitaOSPorMes` (Fase 1A/1B, hoje sem nenhum chamador), só trocando
 * `DATE_TRUNC('month', ...)` por `DATE_TRUNC('day', ...)` pra alimentar o
 * gráfico de receita da home (Fase 3-2A), que precisa de granularidade diária
 * mesmo no período "mes" (~31 pontos).
 */
async function obterReceitaServicosPorDia(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaDiaValor[]>`
      SELECT DATE_TRUNC('day', base."referenciaDia") AS dia,
             COALESCE(SUM(base."valorReceita"), 0)::text AS total
      FROM (
        SELECT os.id,
               os."atualizadoEm" AS "referenciaDia",
               COALESCE(SUM(i."valorCobrado"), 0) AS "valorReceita",
               os."ehRetornoGarantia" AS "ehRetorno",
               COALESCE(r."valorAdicional", 0) AS "valorAdicional",
               COALESCE(r."houveCobranca", false) AS "houveCobranca"
        FROM "OrdemServico" os
        LEFT JOIN "ItemOS" i ON i."osId" = os.id
        LEFT JOIN "RetornoGarantiaOS" r ON r.id = os."retornoGarantiaId"
        WHERE os."excluidaEm" IS NULL
          AND os."entregueSemServico" = false
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicio}
          AND os."atualizadoEm" <= ${fim}
        GROUP BY os.id, os."atualizadoEm", os."ehRetornoGarantia", r."valorAdicional", r."houveCobranca"
      ) base
      WHERE base."ehRetorno" = false
         OR base."valorReceita" > 0
         OR base."valorAdicional" > 0
         OR base."houveCobranca" = true
      GROUP BY DATE_TRUNC('day', base."referenciaDia")
    `;

    return transformarLinhasDia(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaServicosPorDia", erro);
    throw erro;
  }
}

/**
 * Receita de venda direta (PDV) por dia — mesma regra de
 * `obterReceitaPdvPorMes` (Fase 1A/1B, sem chamador), granularidade diária.
 */
async function obterReceitaVendaDiretaPorDia(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaDiaValor[]>`
      SELECT DATE_TRUNC('day', v."criadoEm") AS dia,
             COALESCE(SUM(v."valorTotal"), 0) AS total
      FROM "Venda" v
      WHERE v."criadoEm" >= ${inicio}
        AND v."criadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('day', v."criadoEm")
    `;

    return transformarLinhasDia(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaVendaDiretaPorDia", erro);
    throw erro;
  }
}

/**
 * Receita de pedido de venda aprovado por dia — mesma regra de
 * `obterReceitaVendasAprovadasPorMes` (Fase 1A/1B, sem chamador), granularidade
 * diária. Somada com `obterReceitaVendaDiretaPorDia` forma a série "produtos".
 */
async function obterReceitaVendasAprovadasPorDia(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<Map<string, number>> {
  try {
    const linhas = await prismaClient.$queryRaw<LinhaDiaValor[]>`
      SELECT DATE_TRUNC('day', p."dataCriacao") AS dia,
             COALESCE(SUM(p."total"), 0) AS total
      FROM "PedidoVenda" p
      WHERE p."status"::text = 'APROVADO'
        AND p."origem"::text = 'VENDAS'
        AND p."dataCriacao" >= ${inicio}
        AND p."dataCriacao" <= ${fim}
      GROUP BY DATE_TRUNC('day', p."dataCriacao")
    `;

    return transformarLinhasDia(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaVendasAprovadasPorDia", erro);
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
const DIAS_LIMITE_RETIRADA = 7;
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

const ROTULO_ETAPA: Record<EtapaOS, string> = {
  ORCAMENTO: "Orçamento",
  CONSERTO: "Conserto",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

const SEQUENCIA_ETAPAS_OS: readonly EtapaOS[] = ["ORCAMENTO", "CONSERTO", "PRONTO", "ENTREGUE"];

const VARIANTE_POR_ETAPA: Record<EtapaOS, VarianteStatusMovimentacaoHome> = {
  ORCAMENTO: "orcamento",
  CONSERTO: "conserto",
  PRONTO: "pronto",
  ENTREGUE: "entregue",
};

function rotularStatusOS(status: string): string {
  return ROTULO_STATUS_OS[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function diferencaEmDias(inicio: Date, fim: Date): number {
  return Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
}

/**
 * `intervaloCustom` (Fase 2A-1, pill "Personalizado" do `FiltroPeriodo"):
 * datas de CALENDÁRIO (meia-noite UTC — o que o `FiltroPeriodo` produz),
 * viram fronteira de INSTANTE no fuso da loja (`inicioDoDia`/`fimDoDia`)
 * antes de virar o intervalo desta função — mesma convenção dos outros
 * ramos abaixo (`fimDoDia`/`inicioDoDia` sobre `agora`). Sem `intervaloCustom`,
 * `periodo === "custom"` cai no mesmo intervalo de "hoje" — nunca fica sem
 * janela nenhuma.
 *
 * Devolve DOIS pares de fronteira (correção da Fase 2A-2 — Caso 2 do
 * relatório da Fase 2A-1): `inicio`/`fim` (INSTANTE, no fuso da loja — pra
 * colunas que são instante de verdade, ex. `criadoEm`/`dataPagamento`) e
 * `inicioCalendario`/`fimCalendario` (DATA DE CALENDÁRIO, meia-noite UTC —
 * pra colunas de calendário, ex. `dataVencimento`). Antes desta correção,
 * só o par de instante existia e era reaproveitado pros dois tipos de
 * coluna em `obterDespesasPeriodo` — deslocando por até 3h (UTC−3) uma
 * parcela pendente vencendo perto da virada do dia.
 *
 * `intervaloCustom.inicio`/`.fim` JÁ chegam como data de calendário — viram
 * `inicioCalendario`/`fimCalendario` direto, sem passar por
 * `comoDataDeCalendario` (que assumiria um INSTANTE e deslocaria o dia,
 * exatamente o erro que essa função existe pra evitar — ver o comentário
 * de `comoDataDeCalendario` em lib/datas.ts). Nos outros ramos, `agora` é
 * um instante de verdade, então `comoDataDeCalendario`/
 * `somarDiasEmDataDeCalendario` são a forma correta de derivar o par de
 * calendário a partir dele.
 */
function resolverIntervaloPeriodo(
  periodo: PeriodoDashboard,
  agora: Date,
  fusoHorario: string = FUSO_HORARIO_PADRAO,
  intervaloCustom?: { inicio: Date; fim: Date }
): { inicio: Date; fim: Date; inicioCalendario: Date; fimCalendario: Date } {
  if (periodo === "custom" && intervaloCustom) {
    return {
      inicio: inicioDoDia(intervaloCustom.inicio, fusoHorario),
      fim: fimDoDia(intervaloCustom.fim, fusoHorario),
      inicioCalendario: intervaloCustom.inicio,
      fimCalendario: intervaloCustom.fim,
    };
  }

  const fim = fimDoDia(agora, fusoHorario);
  const hojeCalendario = comoDataDeCalendario(agora, fusoHorario);

  if (periodo === "mes") {
    const inicioMes = inicioDoMes(agora, fusoHorario);
    return {
      inicio: inicioMes,
      fim,
      inicioCalendario: comoDataDeCalendario(inicioMes, fusoHorario),
      fimCalendario: hojeCalendario,
    };
  }

  const diasParaTras = periodo === "7d" ? 6 : periodo === "30d" ? 29 : 0;
  const inicio = inicioDoDia(somarDias(agora, -diasParaTras, fusoHorario), fusoHorario);

  return {
    inicio,
    fim,
    inicioCalendario: somarDiasEmDataDeCalendario(hojeCalendario, -diasParaTras),
    fimCalendario: hojeCalendario,
  };
}

async function obterTicketMedioEntreguesPeriodo(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date
): Promise<number | null> {
  const linhas = await prismaClient.$queryRaw<LinhaTicketPeriodo[]>`
    SELECT COALESCE(SUM(base.total_os), 0)::text AS total,
           COUNT(*)::int AS quantidade
    FROM (
      SELECT os.id,
             COALESCE(SUM(i."valorCobrado"), 0) AS total_os
      FROM "OrdemServico" os
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NULL
        AND os."entregueSemServico" = false
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

  // Divisao em centavos: o ticket medio e media, nao valor exigivel, entao
  // meio centavo arredondado aqui nao desencontra nada no financeiro.
  return paraMoeda(Math.round(deDecimal(linhas[0]?.total ?? 0) / quantidade));
}

async function obterTempoMedioReparoDias(
  prismaClient: PrismaDashboardClient,
  inicio: Date
): Promise<number | null> {
  const linhas = await prismaClient.$queryRaw<LinhaTempoMedio[]>`
    -- Float de proposito: isto e duracao em dias, nao dinheiro.
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
           COALESCE(SUM(base.valor), 0)::text AS valor,
           COUNT(*) FILTER (WHERE base."atualizadoEm" < ${limiteRetirada})::int AS "acimaLimite"
    FROM (
      SELECT os.id,
             os."atualizadoEm",
             COALESCE(SUM(i."valorCobrado"), 0) AS valor
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
    valor: paraMoeda(deDecimal(linhas[0]?.valor ?? 0)),
    acimaLimite: Number(linhas[0]?.acimaLimite ?? 0),
  };
}

async function obterValorEmAbertoOS(prismaClient: PrismaDashboardClient): Promise<number> {
  const linhas = await prismaClient.$queryRaw<LinhaValorAberto[]>`
    SELECT COALESCE(SUM(i."valorCobrado"), 0)::text AS total
    FROM "OrdemServico" os
    LEFT JOIN "ItemOS" i ON i."osId" = os.id
    WHERE os."excluidaEm" IS NULL
      AND os."archivedAt" IS NULL
      AND os."status"::text <> 'ENTREGUE'
  `;

  return paraMoeda(deDecimal(linhas[0]?.total ?? 0));
}

type LinhaDespesasPeriodo = {
  operacionais: string | null;
  custoPecas: string | null;
  custoPdv: string | null;
};

async function obterDespesasPeriodo(
  prismaClient: PrismaDashboardClient,
  inicio: Date,
  fim: Date,
  inicioCalendario: Date,
  fimCalendario: Date
): Promise<{ operacionaisCentavos: number; custoPecasCentavos: number; custoPdvCentavos: number }> {
  const linhas = await prismaClient.$queryRaw<LinhaDespesasPeriodo[]>`
    SELECT
      (
        SELECT COALESCE(SUM(pd."valor"), 0)::text
        FROM "ParcelaDespesa" pd
        INNER JOIN "Despesa" d ON d.id = pd."despesaId"
        LEFT JOIN "Cliente" c ON c.id = d."clienteId"
        WHERE (
            (pd."status"::text = 'PAGO' AND pd."dataPagamento" >= ${inicio} AND pd."dataPagamento" <= ${fim})
            OR (pd."status"::text = 'PENDENTE' AND pd."dataVencimento" >= ${inicioCalendario} AND pd."dataVencimento" <= ${fimCalendario})
          )
          AND (c.id IS NULL OR c."papel"::text = 'FORNECEDOR')
      ) AS "operacionais",
      (
        SELECT COALESCE(SUM(i."custoPeca"), 0)::text
        FROM "OrdemServico" os
        INNER JOIN "ItemOS" i ON i."osId" = os.id
        WHERE os."excluidaEm" IS NULL
          AND os."entregueSemServico" = false
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicio}
          AND os."atualizadoEm" <= ${fim}
      ) AS "custoPecas",
      (
        SELECT COALESCE(SUM(iv."custoUnitario" * iv."quantidade"), 0)::text
        FROM "ItemVenda" iv
        INNER JOIN "Venda" v ON v.id = iv."vendaId"
        WHERE v."criadoEm" >= ${inicio} AND v."criadoEm" <= ${fim}
      ) AS "custoPdv"
  `;

  return {
    operacionaisCentavos: deDecimal(linhas[0]?.operacionais ?? 0),
    custoPecasCentavos: deDecimal(linhas[0]?.custoPecas ?? 0),
    custoPdvCentavos: deDecimal(linhas[0]?.custoPdv ?? 0),
  };
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

/**
 * Painel operacional da home (Fase 3-2A) — SEMPRE buscado por `/`, com ou
 * sem `dashboard.financeiro` (antes da Fase 3-2A só rodava sem a permissão;
 * agora é a base única da home, complementada por `obterFaturamentoHome`
 * quando o contexto tem a permissão financeira). O bloco de metas só é
 * buscado quando o usuário tem `metas.ver`.
 */
export async function obterPainelOperacionalHome(
  periodo: PeriodoDashboard = "hoje",
  intervaloCustom?: { inicio: Date; fim: Date }
): Promise<PainelOperacionalHome> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  await validarConectividadeBanco(prisma);

  const podeVerMetas = temPermissao(contexto, "metas.ver");

  const agora = agoraNaLoja(contexto.fusoHorario);
  const inicioHoje = inicioDoDia(agora, contexto.fusoHorario);
  const intervaloPeriodo = resolverIntervaloPeriodo(periodo, agora, contexto.fusoHorario, intervaloCustom);
  const limiteParado = somarDias(inicioHoje, -DIAS_LIMITE_PARADO, contexto.fusoHorario);
  const limiteRetirada = somarDias(inicioHoje, -DIAS_LIMITE_RETIRADA, contexto.fusoHorario);
  const inicioJanelaRetorno = inicioDoDia(
    somarDias(agora, -JANELA_TAXA_RETORNO_DIAS, contexto.fusoHorario),
    contexto.fusoHorario
  );
  const inicio30Dias = inicioDoDia(somarDias(agora, -30, contexto.fusoHorario), contexto.fusoHorario);

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
    gruposEtapa,
    osRecentesHome,
    vendasRecentesHome,
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
              lte: fimDoDia(somarDias(inicioHoje, 7, contexto.fusoHorario), contexto.fusoHorario),
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
    executarComFallback(
      "home.operacao.fluxoEtapas",
      () =>
        prisma.ordemServico.groupBy({
          by: ["etapa"],
          where: { excluidaEm: null, archivedAt: null, ...escopoOrdemServico(contexto) },
          _count: { _all: true },
        }),
      []
    ),
    executarComFallback(
      "home.movimentacoes.osRecentes",
      () =>
        prisma.ordemServico.findMany({
          where: { excluidaEm: null, ...escopoOrdemServico(contexto) },
          orderBy: { atualizadoEm: "desc" },
          take: 8,
          select: {
            id: true,
            numeroOs: true,
            status: true,
            equipamento: true,
            ehRetornoGarantia: true,
            atualizadoEm: true,
            cliente: { select: { nomeRazaoSocial: true } },
            itens: { select: { valorCobrado: true } },
          },
        }),
      []
    ),
    // Venda/PDV nao e escopada por criador neste sistema (nao existe
    // escopoVenda em lib/auth/escopos.ts) — nenhum filtro de escopo aqui.
    executarComFallback(
      "home.movimentacoes.vendasRecentes",
      () =>
        prisma.venda.findMany({
          orderBy: { criadoEm: "desc" },
          take: 8,
          select: {
            id: true,
            valorTotal: true,
            criadoEm: true,
            cliente: { select: { nomeRazaoSocial: true } },
          },
        }),
      []
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

  const contagemEtapa = new Map<string, number>();
  for (const linha of gruposEtapa) {
    contagemEtapa.set(String(linha.etapa), Number(linha._count._all ?? 0));
  }

  // O Kanban (components/os/dashboard-os.tsx) hoje nao le nenhum filtro por
  // etapa/status da query string — so aceita `modo`. Ate ele ganhar esse
  // filtro, toda linha abre o Kanban sem recorte (ver relatorio da Fase 3-2A).
  const fluxoEtapas: LinhaFluxoEtapaHome[] = SEQUENCIA_ETAPAS_OS.map((etapa) => ({
    etapa,
    label: ROTULO_ETAPA[etapa],
    quantidade: contagemEtapa.get(etapa) ?? 0,
    href: "/os?modo=kanban",
  }));

  const movimentacoesOS: LinhaMovimentacaoHome[] = osRecentesHome.map((os) => {
    const etapa = paraEstagio(os.status).etapa;
    const valor = paraMoeda(
      os.itens.reduce((soma, item) => somar(soma, deDecimal(item.valorCobrado ?? 0)), 0)
    );

    return {
      id: `OS-${os.id}`,
      tipo: "os",
      referencia: `OS #${os.numeroOs}`,
      cliente: os.cliente?.nomeRazaoSocial ?? "Cliente não informado",
      descricao: os.equipamento,
      status: rotularStatusOS(String(os.status)),
      variante: VARIANTE_POR_ETAPA[etapa],
      valor,
      href: `/os/${os.id}`,
      data: os.atualizadoEm.toISOString(),
    };
  });

  const movimentacoesPdv: LinhaMovimentacaoHome[] = vendasRecentesHome.map((venda) => ({
    id: `PDV-${venda.id}`,
    tipo: "pdv",
    // Rota de detalhe de venda/PDV nao existe hoje — usa /pdv como destino razoavel.
    referencia: `Venda #${venda.id.slice(0, 8).toUpperCase()}`,
    cliente: venda.cliente?.nomeRazaoSocial ?? "Cliente não identificado",
    descricao: "Venda PDV",
    status: "Concluída",
    variante: "sucesso",
    valor: paraMoeda(deDecimal(venda.valorTotal ?? 0)),
    href: "/pdv",
    data: venda.criadoEm.toISOString(),
  }));

  const ultimasMovimentacoes = [...movimentacoesOS, ...movimentacoesPdv]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 8);

  const pendencias: LinhaPendenciaHome[] = [];

  if (osParadasTotal > 0) {
    pendencias.push({
      chave: "os-paradas",
      texto: `${osParadasTotal} OS sem atualização há mais de ${DIAS_LIMITE_PARADO}d`,
      valor: null,
      href: "/os?modo=kanban",
      severidade: "ATENCAO",
    });
  }

  if (garantiasVencem7Dias > 0) {
    pendencias.push({
      chave: "garantias-vencendo",
      texto: `${garantiasVencem7Dias} garantias vencem nos próximos 7 dias`,
      valor: null,
      href: "/os?modo=garantia",
      severidade: "ATENCAO",
    });
  }

  let metasResumo: MetasResumoDashboard | undefined;

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
              unidade: true,
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
        // `Meta.valorAtual/valorAlvo` sao Decimal(14,4) desde a Fase 2A-3.
        // `Number(Decimal)` funcionava por coercao; `valorAlvo` ia cru,
        // Decimal e tudo, direto pra tela.
        progresso: calcularProgressoMeta({
          tipoValor: meta.tipoValor,
          valorAtual: numeroDaMeta(meta.valorAtual),
          valorAlvo: numeroDaMetaOuNulo(meta.valorAlvo),
        }),
        status: mapearStatusMovimentacao(meta.status),
        tipoValor: meta.tipoValor,
        valorAtual: numeroDaMeta(meta.valorAtual),
        valorAlvo: numeroDaMetaOuNulo(meta.valorAlvo),
        unidade: meta.unidade,
      })),
    };
  }

  return {
    periodo,
    operacao,
    metasResumo,
    fluxoEtapas,
    ultimasMovimentacoes,
    pendencias,
  };
}

export async function obterPainelOperacionalHomeSeguro(
  periodo: PeriodoDashboard = "hoje",
  intervaloCustom?: { inicio: Date; fim: Date }
): Promise<ResultadoPainelOperacionalHome> {
  try {
    const dados = await obterPainelOperacionalHome(periodo, intervaloCustom);
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

/**
 * Recorte financeiro da home (Fase 3-2A) — exige `dashboard.financeiro`.
 * A checagem aqui e defesa em profundidade: a pagina so chama esta funcao
 * depois de `temPermissao` ja ter confirmado a permissao (mesmo padrao de
 * `obterDashboardExecutivo`, que sempre exigiu a permissao internamente).
 */
async function obterFaturamentoHome(
  periodo: PeriodoDashboard = "hoje",
  intervaloCustom?: { inicio: Date; fim: Date }
): Promise<FaturamentoHome> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "dashboard.financeiro");
  const prisma = contexto.prisma;
  await validarConectividadeBanco(prisma);

  const agora = agoraNaLoja(contexto.fusoHorario);
  // dataVencimento (ContaReceber/ParcelaDespesa) é DATA DE CALENDÁRIO —
  // "hoje" pra comparar com ela precisa da mesma convenção (meia-noite UTC),
  // não meia-noite do fuso da loja como instante. Ver lib/datas.ts.
  const hojeCalendario = comoDataDeCalendario(agora, contexto.fusoHorario);
  const intervaloPeriodo = resolverIntervaloPeriodo(periodo, agora, contexto.fusoHorario, intervaloCustom);
  const duracaoPeriodo = intervaloPeriodo.fim.getTime() - intervaloPeriodo.inicio.getTime();
  const intervaloAnterior = {
    inicio: new Date(intervaloPeriodo.inicio.getTime() - duracaoPeriodo - 1),
    fim: new Date(intervaloPeriodo.inicio.getTime() - 1),
  };

  const [
    receitaPeriodo,
    receitaPeriodoAnterior,
    despesasPeriodo,
    servicosPorDiaMap,
    vendaDiretaPorDiaMap,
    vendasAprovadasPorDiaMap,
    receberAtrasado,
    pagarAtrasado,
  ] = await Promise.all([
    executarComFallback(
      "faturamentoHome.receitaPeriodo",
      () => obterReceitaTotalPadrao(intervaloPeriodo.inicio, intervaloPeriodo.fim, prisma),
      0
    ),
    executarComFallback(
      "faturamentoHome.receitaPeriodoAnterior",
      () => obterReceitaTotalPadrao(intervaloAnterior.inicio, intervaloAnterior.fim, prisma),
      0
    ),
    executarComFallback(
      "faturamentoHome.despesasPeriodo",
      () =>
        obterDespesasPeriodo(
          prisma,
          intervaloPeriodo.inicio,
          intervaloPeriodo.fim,
          intervaloPeriodo.inicioCalendario,
          intervaloPeriodo.fimCalendario
        ),
      { operacionaisCentavos: 0, custoPecasCentavos: 0, custoPdvCentavos: 0 }
    ),
    executarComFallback(
      "faturamentoHome.servicosPorDia",
      () => obterReceitaServicosPorDia(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      new Map<string, number>()
    ),
    executarComFallback(
      "faturamentoHome.vendaDiretaPorDia",
      () => obterReceitaVendaDiretaPorDia(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      new Map<string, number>()
    ),
    executarComFallback(
      "faturamentoHome.vendasAprovadasPorDia",
      () => obterReceitaVendasAprovadasPorDia(prisma, intervaloPeriodo.inicio, intervaloPeriodo.fim),
      new Map<string, number>()
    ),
    executarComFallback(
      "faturamentoHome.receberAtrasado",
      () =>
        prisma.contaReceber.aggregate({
          where: {
            estornadaEm: null,
            status: { in: [...STATUS_CONTA_PENDENTE] },
            dataVencimento: { lt: hojeCalendario },
          },
          _sum: { valor: true },
        }),
      { _sum: { valor: null } }
    ),
    executarComFallback(
      "faturamentoHome.pagarAtrasado",
      () =>
        prisma.parcelaDespesa.aggregate({
          where: { status: { in: [...STATUS_PARCELA_PENDENTE] }, dataVencimento: { lt: hojeCalendario } },
          _sum: { valor: true },
        }),
      { _sum: { valor: null } }
    ),
  ]);

  const despesasTotaisCentavos = somar(
    despesasPeriodo.operacionaisCentavos,
    despesasPeriodo.custoPecasCentavos,
    despesasPeriodo.custoPdvCentavos
  );
  // Percentual de centavo sobre centavo: a razao e a mesma, e nenhum dos
  // dois lados passa por float antes de dividir.
  const receitaPeriodoCentavos = deDecimal(receitaPeriodo);
  const margemLiquidaPercentual =
    receitaPeriodoCentavos > 0
      ? (subtrair(receitaPeriodoCentavos, despesasTotaisCentavos) / receitaPeriodoCentavos) * 100
      : null;

  const produtosPorDiaMap = somarMapas(vendaDiretaPorDiaMap, vendasAprovadasPorDiaMap);
  const dias = construirDiasIntervalo(intervaloPeriodo.inicio, intervaloPeriodo.fim);
  const serie = dias.map((dia) => {
    const chave = chaveDia(dia);

    return {
      dia: formatarDiaPtBr(dia),
      servicos: paraMoeda(servicosPorDiaMap.get(chave) ?? 0),
      produtos: paraMoeda(produtosPorDiaMap.get(chave) ?? 0),
    };
  });

  const receberAtrasadoValor = paraMoeda(deDecimal(receberAtrasado._sum.valor ?? 0));
  const pagarAtrasadoValor = paraMoeda(deDecimal(pagarAtrasado._sum.valor ?? 0));

  const pendenciasFinanceiras: LinhaPendenciaHome[] = [];

  if (receberAtrasadoValor > 0) {
    pendenciasFinanceiras.push({
      chave: "receber-atrasado",
      texto: "Contas a receber em atraso",
      valor: receberAtrasadoValor,
      href: "/financeiro/receber",
      severidade: "ATENCAO",
    });
  }

  if (pagarAtrasadoValor > 0) {
    pendenciasFinanceiras.push({
      chave: "pagar-atrasado",
      texto: "Contas a pagar em atraso",
      valor: pagarAtrasadoValor,
      href: "/financeiro/pagar",
      severidade: "ATENCAO",
    });
  }

  return {
    comparativo: montarComparativo(receitaPeriodo, receitaPeriodoAnterior, "cima"),
    margemLiquidaPercentual,
    serie,
    pendenciasFinanceiras,
  };
}

export async function obterFaturamentoHomeSeguro(
  periodo: PeriodoDashboard = "hoje",
  intervaloCustom?: { inicio: Date; fim: Date }
): Promise<ResultadoFaturamentoHome> {
  try {
    const dados = await obterFaturamentoHome(periodo, intervaloCustom);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[dashboard] falha ao montar faturamento da home", {
        prismaCode: erro.code,
        message: erro.message,
        meta: serializarMetaErro(erro.meta),
      });

      return {
        sucesso: false,
        erro: "Não foi possível carregar os indicadores financeiros.",
      };
    }

    if (erro instanceof Error) {
      console.error("[dashboard] falha ao montar faturamento da home", {
        message: erro.message,
        stack: erro.stack,
      });
    } else {
      console.error("[dashboard] falha ao montar faturamento da home", {
        erro: String(erro),
      });
    }

    return {
      sucesso: false,
      erro: "Não foi possível carregar os indicadores financeiros.",
    };
  }
}
