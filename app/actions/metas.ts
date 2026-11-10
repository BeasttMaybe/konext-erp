"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { obterIdUsuarioOperacionalOuNulo } from "@/lib/tenant/usuario-operacional";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";
import {
  filtroPrismaDePeriodoDeReceita,
  filtroPrismaDeReceitaRealizada,
} from "@/lib/dominio/financeiro/receita-realizada";
import { numeroDaMeta, numeroDaMetaOuNulo } from "@/lib/dominio/metas/valores";
import {
  agoraNaLoja,
  FUSO_HORARIO_PADRAO,
  hojeComoDataDeCalendario,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";
import { Prisma } from "@prisma/client";
import type {
  CategoriaMeta,
  TipoValorMeta,
  PrioridadeMeta,
  StatusMeta,
  TipoHistoricoMeta,
  OrigemProgressoMeta,
  FonteAutomaticaMeta,
  MetricaAutomaticaMeta,
  DirecaoMeta,
  ResultadoRetornoGarantia,
  StatusOS,
  OrigemReceita,
} from "@prisma/client";

export type ResultadoAcao =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; erro: string };

export type ResultadoAcaoComId =
  | { sucesso: true; mensagem: string; id: string }
  | { sucesso: false; erro: string };

export type ResultadoCalculoMetaAutomatica =
  | { sucesso: true; valorAtual: number; detalhes?: string }
  | { sucesso: false; erro: string };

export type ConfiguracaoAutomaticaMeta = {
  dataInicio?: string;
  dataFim?: string;
  statusOS?: StatusOS[];
  produtoId?: string;
  clienteId?: string;
  incluirExcluidas?: boolean;
  incluirCanceladas?: boolean;
  origensReceita?: OrigemReceita[];
};

export type CriarMetaInput = {
  titulo: string;
  descricao?: string;
  categoria: CategoriaMeta;
  tipoValor: TipoValorMeta;
  origemProgresso?: OrigemProgressoMeta;
  fonteAutomatica?: FonteAutomaticaMeta;
  metricaAutomatica?: MetricaAutomaticaMeta;
  configuracaoAutomatica?: ConfiguracaoAutomaticaMeta;
  direcao?: DirecaoMeta;
  valorAlvo?: number;
  valorAtual?: number;
  unidade?: string;
  dataInicio?: string;
  dataPrazo?: string;
  prioridade?: PrioridadeMeta;
};

export type AtualizarMetaInput = CriarMetaInput & { id: string };

export type AtualizarProgressoInput = {
  id: string;
  valorNovo: number;
  observacao?: string;
};

export type AlterarStatusInput = {
  id: string;
  status: StatusMeta;
  observacao?: string;
};

export type ItemChecklistInput = {
  metaId: string;
  titulo: string;
  ordem?: number;
};

export type FiltrosMetasInput = {
  busca?: string;
  categoria?: CategoriaMeta | "TODAS";
  status?: StatusMeta | "TODAS";
  prioridade?: PrioridadeMeta | "TODAS";
  origemProgresso?: OrigemProgressoMeta | "TODAS";
  apenasAtrasadas?: boolean;
  apenasProximasVencer?: boolean;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
  tamanhoPagina?: number;
};

export type LinhaMetaLista = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaMeta;
  tipoValor: TipoValorMeta;
  origemProgresso: OrigemProgressoMeta;
  fonteAutomatica: FonteAutomaticaMeta | null;
  metricaAutomatica: MetricaAutomaticaMeta | null;
  direcao: DirecaoMeta;
  valorAlvo: number | null;
  valorAtual: number;
  unidade: string | null;
  /** Necessária para o ritmo: o esperado de hoje depende do intervalo todo. */
  dataInicio: string | null;
  dataPrazo: string | null;
  prioridade: PrioridadeMeta;
  status: StatusMeta;
  progresso: number;
  estaDentroMeta: boolean | null;
  diferencaMeta: number | null;
  totalItensChecklist: number;
  itensConcluidos: number;
  ultimaSincronizacaoEm: string | null;
  erroSincronizacao: string | null;
  criadoEm: string;
  /**
   * A configuracao da meta automatica (periodo proprio, produto do estoque).
   *
   * Vem na LISTA, e nao so no detalhe, porque a tela de editar abre a partir
   * da lista e precisa preencher esses campos. Sem isso, editar uma meta
   * automatica apagaria silenciosamente o periodo configurado nela.
   */
  configuracaoAutomatica: ConfiguracaoAutomaticaMeta | null;
};

export type DetalhesMeta = LinhaMetaLista & {
  concluidaEm: string | null;
  canceladaEm: string | null;
  itensChecklist: {
    id: string;
    titulo: string;
    concluido: boolean;
    ordem: number;
    concluidoEm: string | null;
  }[];
  historicos: {
    id: string;
    tipo: TipoHistoricoMeta;
    descricao: string;
    valorAnterior: number | null;
    valorNovo: number | null;
    criadoEm: string;
  }[];
};

export type DashboardMetasResult = {
  totalMetas: number;
  metasManuais: number;
  metasAutomaticas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
  emAtencao: number;
  pausadas: number;
  canceladas: number;
  automaticasComErroSincronizacao: number;
  valorTotalPlanejado: number;
  valorAlcancado: number;
  proximasVencer: number;
};

type MetaCalculoAutomatico = {
  id: string;
  criadoPorId: string | null;
  origemProgresso: OrigemProgressoMeta;
  fonteAutomatica: FonteAutomaticaMeta | null;
  metricaAutomatica: MetricaAutomaticaMeta | null;
  configuracaoAutomatica: Prisma.JsonValue | null;
  dataInicio: Date | null;
  dataPrazo: Date | null;
};

type PrismaMetasClient = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

// Normalizacao compartilhada (lib/tenant/usuario-operacional.ts).
const obterUsuarioOperacionalId = obterIdUsuarioOperacionalOuNulo;

function contextoAuditoriaMetas(usuarioOperacionalId: string | null, origem: string) {
  return contextoAuditoriaDoUsuario(usuarioOperacionalId ? { id: usuarioOperacionalId } : null, origem);
}

function normalizarTexto(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.trim();
}

function parseDataIso(valor?: string): Date | null {
  if (!valor) return null;

  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yyyy, mm, dd] = match;
  const ano = Number(yyyy);
  const mes = Number(mm);
  const dia = Number(dd);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  const validaDataReal =
    dataUtc.getUTCFullYear() === ano &&
    dataUtc.getUTCMonth() === mes - 1 &&
    dataUtc.getUTCDate() === dia;

  return validaDataReal ? dataUtc : null;
}

function dataParaIsoDia(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function serializarData(data: Date | null): string | null {
  return data ? data.toISOString() : null;
}

function eObjeto(valor: Prisma.JsonValue | null): valor is Prisma.JsonObject {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function eArrayString(valor: Prisma.JsonValue | undefined): valor is Prisma.JsonArray {
  return Array.isArray(valor) && valor.every((item) => typeof item === "string");
}

function parseConfiguracaoAutomatica(
  valor: Prisma.JsonValue | null | undefined
): ConfiguracaoAutomaticaMeta | null {
  if (valor === undefined) return null;
  if (!eObjeto(valor)) return null;

  const dataInicio = typeof valor.dataInicio === "string" ? valor.dataInicio : undefined;
  const dataFim = typeof valor.dataFim === "string" ? valor.dataFim : undefined;
  const produtoId = typeof valor.produtoId === "string" ? valor.produtoId : undefined;
  const clienteId = typeof valor.clienteId === "string" ? valor.clienteId : undefined;
  const incluirExcluidas = typeof valor.incluirExcluidas === "boolean" ? valor.incluirExcluidas : undefined;
  const incluirCanceladas = typeof valor.incluirCanceladas === "boolean" ? valor.incluirCanceladas : undefined;

  const statusOS = eArrayString(valor.statusOS)
    ? valor.statusOS.filter((item): item is StatusOS => typeof item === "string")
    : undefined;

  const origensReceita = eArrayString(valor.origensReceita)
    ? valor.origensReceita.filter((item): item is OrigemReceita => typeof item === "string")
    : undefined;

  return {
    dataInicio,
    dataFim,
    statusOS,
    produtoId,
    clienteId,
    incluirExcluidas,
    incluirCanceladas,
    origensReceita,
  };
}

function paraJsonConfiguracao(config?: ConfiguracaoAutomaticaMeta): Prisma.InputJsonValue | undefined {
  if (!config) return undefined;

  return {
    dataInicio: config.dataInicio,
    dataFim: config.dataFim,
    statusOS: config.statusOS,
    produtoId: config.produtoId,
    clienteId: config.clienteId,
    incluirExcluidas: config.incluirExcluidas,
    incluirCanceladas: config.incluirCanceladas,
    origensReceita: config.origensReceita,
  };
}

function montarFiltroData(inicio?: Date, fim?: Date): Prisma.DateTimeFilter | undefined {
  if (!inicio && !fim) return undefined;
  return {
    ...(inicio ? { gte: inicio } : {}),
    ...(fim ? { lte: fim } : {}),
  };
}

function obterPeriodoMeta(meta: MetaCalculoAutomatico): { inicio?: Date; fim?: Date } {
  const config = parseConfiguracaoAutomatica(meta.configuracaoAutomatica);
  const inicioConfig = parseDataIso(config?.dataInicio);
  const fimConfig = parseDataIso(config?.dataFim);

  return {
    inicio: inicioConfig ?? meta.dataInicio ?? undefined,
    fim: fimConfig ?? meta.dataPrazo ?? undefined,
  };
}

function calcularProgresso(
  tipoValor: TipoValorMeta,
  direcao: DirecaoMeta,
  valorAtual: number,
  valorAlvo: number | null,
  totalItens: number,
  itensConcluidos: number
): { progresso: number; estaDentroMeta: boolean | null; diferencaMeta: number | null } {
  if (tipoValor === "CHECKLIST") {
    if (totalItens === 0) {
      return { progresso: 0, estaDentroMeta: null, diferencaMeta: null };
    }
    return {
      progresso: Math.min(100, Math.round((itensConcluidos / totalItens) * 100)),
      estaDentroMeta: null,
      diferencaMeta: null,
    };
  }

  if (!valorAlvo || valorAlvo <= 0) {
    return { progresso: 0, estaDentroMeta: null, diferencaMeta: null };
  }

  if (direcao === "MENOR_MELHOR") {
    const diferenca = valorAlvo - valorAtual;
    if (valorAtual <= valorAlvo) {
      return { progresso: 100, estaDentroMeta: true, diferencaMeta: diferenca };
    }

    const excessoPercentual = ((valorAtual - valorAlvo) / valorAlvo) * 100;
    const progresso = Math.max(0, Math.round(100 - excessoPercentual));
    return { progresso, estaDentroMeta: false, diferencaMeta: diferenca };
  }

  const percentual = (valorAtual / valorAlvo) * 100;
  return {
    progresso: Math.min(100, Math.max(0, Math.round(percentual))),
    estaDentroMeta: null,
    diferencaMeta: valorAtual - valorAlvo,
  };
}

const categoriasValidas: CategoriaMeta[] = [
  "FINANCEIRA",
  "OPERACIONAL",
  "COMERCIAL",
  "ESTOQUE",
  "ESTRUTURAL",
  "EQUIPAMENTO",
  "REFORMA",
  "OUTRA",
];

const tiposValorValidos: TipoValorMeta[] = [
  "DINHEIRO",
  "QUANTIDADE",
  "PERCENTUAL",
  "CHECKLIST",
];

const prioridadesValidas: PrioridadeMeta[] = [
  "BAIXA",
  "MEDIA",
  "ALTA",
  "CRITICA",
];

const statusValidos: StatusMeta[] = [
  "EM_ANDAMENTO",
  "ATENCAO",
  "ATRASADA",
  "CONCLUIDA",
  "PAUSADA",
  "CANCELADA",
];

const fontesValidas: FonteAutomaticaMeta[] = [
  "ORDENS_SERVICO",
  "FINANCEIRO",
  "PDV",
  "VENDAS",
  "ESTOQUE",
  "GARANTIAS",
];

const metricasImplementadas: Record<FonteAutomaticaMeta, MetricaAutomaticaMeta[]> = {
  ORDENS_SERVICO: [
    "FATURAMENTO_OS",
    "QUANTIDADE_OS_FINALIZADAS",
    "QUANTIDADE_OS_CRIADAS",
    "TICKET_MEDIO_OS",
  ],
  GARANTIAS: [
    "RETORNOS_GARANTIA",
    "TAXA_RETORNO_GARANTIA",
    "GARANTIAS_ATIVAS",
  ],
  FINANCEIRO: [
    "RECEBIMENTOS_FINANCEIRO",
    "DESPESAS_FINANCEIRO",
  ],
  PDV: ["FATURAMENTO_PDV"],
  VENDAS: ["QUANTIDADE_VENDAS"],
  ESTOQUE: ["QUANTIDADE_ITEM_ESTOQUE"],
};

function validarConfiguracaoAutomatica(input: CriarMetaInput): string | null {
  if (input.origemProgresso !== "AUTOMATICA") return null;

  if (!input.fonteAutomatica || !fontesValidas.includes(input.fonteAutomatica)) {
    return "Fonte automática inválida.";
  }

  if (!input.metricaAutomatica || !metricasImplementadas[input.fonteAutomatica].includes(input.metricaAutomatica)) {
    return "Métrica automática inválida para a fonte selecionada.";
  }

  const config = input.configuracaoAutomatica;

  const dataInicio = parseDataIso(config?.dataInicio);
  const dataFim = parseDataIso(config?.dataFim);

  if (config?.dataInicio && !dataInicio) {
    return "Data inicial da configuração automática inválida.";
  }

  if (config?.dataFim && !dataFim) {
    return "Data final da configuração automática inválida.";
  }

  if (dataInicio && dataFim && dataFim < dataInicio) {
    return "Período da configuração automática inválido.";
  }

  if (input.metricaAutomatica === "QUANTIDADE_ITEM_ESTOQUE" && !normalizarTexto(config?.produtoId).length) {
    return "Selecione um produto para a métrica de quantidade em estoque.";
  }

  return null;
}

function validarEntradaMeta(input: CriarMetaInput): string | null {
  const titulo = normalizarTexto(input.titulo);
  if (titulo.length < 3 || titulo.length > 120) {
    return "Título deve ter entre 3 e 120 caracteres.";
  }

  const descricao = normalizarTexto(input.descricao);
  if (descricao.length > 1000) {
    return "Descrição não pode exceder 1000 caracteres.";
  }

  if (!categoriasValidas.includes(input.categoria)) {
    return "Categoria inválida.";
  }

  if (!tiposValorValidos.includes(input.tipoValor)) {
    return "Tipo de valor inválido.";
  }

  if (input.prioridade && !prioridadesValidas.includes(input.prioridade)) {
    return "Prioridade inválida.";
  }

  const origemProgresso = input.origemProgresso ?? "MANUAL";

  if (origemProgresso === "MANUAL") {
    if (input.tipoValor !== "CHECKLIST") {
      if (input.valorAlvo === undefined || input.valorAlvo === null) {
        return "Valor alvo é obrigatório para este tipo de meta.";
      }
      if (!Number.isFinite(input.valorAlvo)) {
        return "Valor alvo inválido.";
      }
      if (input.valorAlvo <= 0) {
        return "Valor alvo deve ser maior que zero.";
      }
    }
  } else {
    if (input.valorAlvo === undefined || input.valorAlvo === null || !Number.isFinite(input.valorAlvo) || input.valorAlvo <= 0) {
      return "Metas automáticas exigem valor alvo válido.";
    }

    const erroAutomatica = validarConfiguracaoAutomatica(input);
    if (erroAutomatica) return erroAutomatica;
  }

  const valorAtual = input.valorAtual ?? 0;
  if (!Number.isFinite(valorAtual)) {
    return "Valor atual inválido.";
  }
  if (valorAtual < 0) {
    return "Valor atual não pode ser negativo.";
  }

  if (input.unidade && normalizarTexto(input.unidade).length > 30) {
    return "Unidade não pode exceder 30 caracteres.";
  }

  const dataInicio = parseDataIso(input.dataInicio);
  const dataPrazo = parseDataIso(input.dataPrazo);

  if (input.dataInicio && !dataInicio) {
    return "Data de início inválida.";
  }

  if (input.dataPrazo && !dataPrazo) {
    return "Prazo inválido.";
  }

  if (input.dataInicio && input.dataPrazo && dataPrazo && dataInicio && dataPrazo < dataInicio) {
    return "Prazo deve ser igual ou posterior à data de início.";
  }

  return null;
}

async function registrarHistorico(prismaClient: PrismaMetasClient, params: {
  metaId: string;
  tipo: TipoHistoricoMeta;
  descricao: string;
  valorAnterior?: number | null;
  valorNovo?: number | null;
  criadoPorId?: string | null;
}) {
  await prismaClient.historicoMeta.create({
    data: {
      metaId: params.metaId,
      tipo: params.tipo,
      descricao: params.descricao,
      valorAnterior: params.valorAnterior ?? null,
      valorNovo: params.valorNovo ?? null,
      criadoPorId: params.criadoPorId ?? null,
    },
  });
}

function montarFiltroPeriodoContaReceber(
  periodo: { inicio?: Date; fim?: Date }
): Prisma.ContaReceberWhereInput | undefined {
  const filtroRecebimento = montarFiltroData(periodo.inicio, periodo.fim);
  if (!filtroRecebimento) return undefined;

  // A reserva e `criadoEm`, nao `dataVencimento`. Vencimento e quando o
  // dinheiro DEVERIA entrar; a meta mede o que entrou. Ver
  // lib/dominio/financeiro/receita-realizada.ts.
  return filtroPrismaDePeriodoDeReceita(filtroRecebimento);
}

async function executarCalculoMetaAutomatica(
  prismaClient: PrismaMetasClient,
  meta: MetaCalculoAutomatico,
  fusoHorario: string
): Promise<ResultadoCalculoMetaAutomatica> {
  if (meta.origemProgresso !== "AUTOMATICA") {
    return { sucesso: false, erro: "Meta não é automática." };
  }

  if (!meta.fonteAutomatica || !meta.metricaAutomatica) {
    return { sucesso: false, erro: "Configuração automática incompleta." };
  }

  const config = parseConfiguracaoAutomatica(meta.configuracaoAutomatica);
  const periodo = obterPeriodoMeta(meta);

  try {
    if (meta.metricaAutomatica === "FATURAMENTO_OS") {
      const where: Prisma.ContaReceberWhereInput = {
        origem: "ORDEM_SERVICO",
        ordemServicoId: { not: null },
        ...filtroPrismaDeReceitaRealizada(),
        ordemServico: { entregueSemServico: false },
      };

      const filtroPeriodo = montarFiltroPeriodoContaReceber(periodo);
      if (filtroPeriodo) {
        where.AND = [filtroPeriodo];
      }

      const agregado = await prismaClient.contaReceber.aggregate({
        where,
        _sum: { valor: true },
      });

      return { sucesso: true, valorAtual: agregado._sum.valor !== null ? paraMoeda(deDecimal(agregado._sum.valor)) : 0 };
    }

    if (meta.metricaAutomatica === "QUANTIDADE_OS_FINALIZADAS") {
      const filtroAtualizacao = montarFiltroData(periodo.inicio, periodo.fim);
      const where: Prisma.OrdemServicoWhereInput = {
        excluidaEm: null,
        entregueSemServico: false,
        status: { in: config?.statusOS?.length ? config.statusOS : ["PRONTO", "ENTREGUE"] },
        ...(filtroAtualizacao ? { atualizadoEm: filtroAtualizacao } : {}),
      };

      const total = await prismaClient.ordemServico.count({ where });
      return { sucesso: true, valorAtual: total };
    }

    if (meta.metricaAutomatica === "QUANTIDADE_OS_CRIADAS") {
      const filtroCriacao = montarFiltroData(periodo.inicio, periodo.fim);
      const where: Prisma.OrdemServicoWhereInput = {
        excluidaEm: null,
        ...(filtroCriacao ? { criadoEm: filtroCriacao } : {}),
      };
      const total = await prismaClient.ordemServico.count({ where });
      return { sucesso: true, valorAtual: total };
    }

    if (meta.metricaAutomatica === "TICKET_MEDIO_OS") {
      const where: Prisma.ContaReceberWhereInput = {
        origem: "ORDEM_SERVICO",
        ordemServicoId: { not: null },
        ...filtroPrismaDeReceitaRealizada(),
        ordemServico: { entregueSemServico: false },
      };

      const filtroPeriodo = montarFiltroPeriodoContaReceber(periodo);
      if (filtroPeriodo) {
        where.AND = [filtroPeriodo];
      }

      // `_avg` dava a média POR CONTA, não por OS. Uma OS de R$ 900 paga em
      // 3 parcelas de R$ 300 entrava como três tickets de R$ 300 e DERRUBAVA
      // a média — quanto mais o cliente parcela, menor o "ticket médio"
      // aparecia. Ticket médio da OS é total dividido pelo número de OS.
      const [agregado, osDistintas] = await Promise.all([
        prismaClient.contaReceber.aggregate({ where, _sum: { valor: true } }),
        prismaClient.contaReceber.findMany({
          where,
          select: { ordemServicoId: true },
          distinct: ["ordemServicoId"],
        }),
      ]);

      const quantidadeDeOS = osDistintas.length;
      if (quantidadeDeOS === 0) {
        return { sucesso: true, valorAtual: 0, detalhes: "Sem OS recebidas no período." };
      }

      const totalEmCentavos = agregado._sum.valor !== null ? deDecimal(agregado._sum.valor) : 0;

      // Divide em centavos e só então vira reais: dividir reais em ponto
      // flutuante devolve dízima e o ticket aparece com casas que não existem.
      return {
        sucesso: true,
        valorAtual: paraMoeda(Math.round(totalEmCentavos / quantidadeDeOS)),
      };
    }

    if (meta.metricaAutomatica === "RETORNOS_GARANTIA") {
      const filtroCriacao = montarFiltroData(periodo.inicio, periodo.fim);
      const total = await prismaClient.retornoGarantiaOS.count({
        where: filtroCriacao ? { criadoEm: filtroCriacao } : {},
      });
      return { sucesso: true, valorAtual: total };
    }

    if (meta.metricaAutomatica === "GARANTIAS_ATIVAS") {
      // TermoGarantiaOS.dataFimGarantia é INSTANTE (ancorado na entrega) —
      // "agora" precisa ser o instante certo no fuso da loja.
      const hoje = agoraNaLoja(fusoHorario);
      const total = await prismaClient.termoGarantiaOS.count({
        where: {
          canceladaEm: null,
          dataFimGarantia: { gte: hoje },
        },
      });
      return { sucesso: true, valorAtual: total };
    }

    if (meta.metricaAutomatica === "TAXA_RETORNO_GARANTIA") {
      const filtroPeriodo = montarFiltroData(periodo.inicio, periodo.fim);
      const [retornos, garantias] = await prismaClient.$transaction([
        prismaClient.retornoGarantiaOS.count({
          where: filtroPeriodo ? { criadoEm: filtroPeriodo } : {},
        }),
        prismaClient.termoGarantiaOS.count({
          where: filtroPeriodo ? { criadoEm: filtroPeriodo } : {},
        }),
      ]);

      if (garantias === 0) {
        return { sucesso: true, valorAtual: 0, detalhes: "Sem garantias no período." };
      }

      return {
        sucesso: true,
        valorAtual: Number(((retornos / garantias) * 100).toFixed(2)),
      };
    }

    if (meta.metricaAutomatica === "RECEBIMENTOS_FINANCEIRO") {
      const where: Prisma.ContaReceberWhereInput = {
        ...filtroPrismaDeReceitaRealizada(),
        ...(config?.origensReceita?.length
          ? { origem: { in: config.origensReceita } }
          : {}),
      };

      const filtroPeriodo = montarFiltroPeriodoContaReceber(periodo);
      if (filtroPeriodo) {
        where.AND = [filtroPeriodo];
      }

      const agregado = await prismaClient.contaReceber.aggregate({ where, _sum: { valor: true } });
      return { sucesso: true, valorAtual: agregado._sum.valor !== null ? paraMoeda(deDecimal(agregado._sum.valor)) : 0 };
    }

    if (meta.metricaAutomatica === "DESPESAS_FINANCEIRO") {
      const filtroPagamento = montarFiltroData(periodo.inicio, periodo.fim);
      const where: Prisma.ParcelaDespesaWhereInput = {
        status: "PAGO",
        ...(filtroPagamento ? { dataPagamento: filtroPagamento } : {}),
      };
      const agregado = await prismaClient.parcelaDespesa.aggregate({
        where,
        _sum: { valorPago: true },
      });

      return {
        sucesso: true,
        valorAtual: agregado._sum.valorPago !== null ? paraMoeda(deDecimal(agregado._sum.valorPago)) : 0,
      };
    }

    if (meta.metricaAutomatica === "FATURAMENTO_PDV") {
      const where: Prisma.ContaReceberWhereInput = {
        origem: "VENDA_PDV",
        ...filtroPrismaDeReceitaRealizada(),
      };
      const filtroPeriodo = montarFiltroPeriodoContaReceber(periodo);
      if (filtroPeriodo) {
        where.AND = [filtroPeriodo];
      }

      const agregado = await prismaClient.contaReceber.aggregate({ where, _sum: { valor: true } });
      return { sucesso: true, valorAtual: agregado._sum.valor !== null ? paraMoeda(deDecimal(agregado._sum.valor)) : 0 };
    }

    if (meta.metricaAutomatica === "QUANTIDADE_VENDAS") {
      const filtroCriacao = montarFiltroData(periodo.inicio, periodo.fim);
      const total = await prismaClient.venda.count({
        where: {
          // Venda estornada nao conta, igual no painel financeiro. Contar o
          // estorno faz a meta premiar a venda que foi desfeita -- e o
          // proprio schema diz que `estornadaEm` e "o que tira a venda da
          // apuracao de receita".
          estornadaEm: null,
          ...(filtroCriacao ? { criadoEm: filtroCriacao } : {}),
        },
      });
      return { sucesso: true, valorAtual: total };
    }

    if (meta.metricaAutomatica === "QUANTIDADE_ITEM_ESTOQUE") {
      const produtoId = normalizarTexto(config?.produtoId);
      if (!produtoId) {
        return { sucesso: false, erro: "Produto não configurado para a meta automática de estoque." };
      }

      const produto = await prismaClient.produto.findFirst({
        where: { id: produtoId, ativo: true },
        select: { quantidadeEstoque: true },
      });

      if (!produto) {
        return { sucesso: false, erro: "Produto da meta automática não encontrado." };
      }

      return { sucesso: true, valorAtual: produto.quantidadeEstoque };
    }

    return { sucesso: false, erro: "Métrica automática não suportada no momento." };
  } catch (erro) {
    // `unstable_rethrow` primeiro: redirect e notFound do Next viajam COMO
    // EXCEÇÃO, e um `catch` que os engole transforma "sua sessão expirou" em
    // "falha ao calcular a métrica" — a pessoa fica olhando uma meta zerada
    // em vez de ir para o login.
    unstable_rethrow(erro);

    // E o motivo vai para o log do servidor em vez de desaparecer. O
    // `erroSincronizacao` da meta guarda o texto genérico; quem for descobrir
    // POR QUE uma meta parou de sincronizar precisa do erro de verdade.
    console.error(
      `Falha ao calcular meta automática ${meta.metricaAutomatica} (meta ${meta.id}):`,
      erro
    );

    return { sucesso: false, erro: "Falha ao calcular a métrica automática." };
  }
}

function mensagemSincronizacao(
  valorAnterior: number,
  valorNovo: number,
  unidade: string | null,
  tipoValor: TipoValorMeta
): string {
  const fmtMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

  const sufixo = unidade ?? (tipoValor === "PERCENTUAL" ? "%" : "");

  if (tipoValor === "DINHEIRO") {
    return `Meta automática sincronizada. Valor anterior: ${fmtMoeda(valorAnterior)}. Novo valor: ${fmtMoeda(valorNovo)}.`;
  }

  return `Meta automática sincronizada. Valor anterior: ${valorAnterior}${sufixo}. Novo valor: ${valorNovo}${sufixo}.`;
}

export async function criarMeta(input: CriarMetaInput): Promise<ResultadoAcaoComId> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const erroValidacao = validarEntradaMeta(input);
    if (erroValidacao) {
      return { sucesso: false, erro: erroValidacao };
    }

    const origemProgresso = input.origemProgresso ?? "MANUAL";
    const direcao = input.direcao ?? "MAIOR_MELHOR";
    const titulo = normalizarTexto(input.titulo);
    const descricao = normalizarTexto(input.descricao) || null;
    const unidade = normalizarTexto(input.unidade) || null;
    const dataInicio = parseDataIso(input.dataInicio);
    const dataPrazo = parseDataIso(input.dataPrazo);

    const meta = await prisma.$transaction(async (tx) => {
      const criada = await tx.meta.create({
        data: {
          titulo,
          descricao,
          categoria: input.categoria,
          tipoValor: input.tipoValor,
          origemProgresso,
          fonteAutomatica: origemProgresso === "AUTOMATICA" ? (input.fonteAutomatica ?? null) : null,
          metricaAutomatica: origemProgresso === "AUTOMATICA" ? (input.metricaAutomatica ?? null) : null,
          configuracaoAutomatica:
            origemProgresso === "AUTOMATICA"
              ? paraJsonConfiguracao(input.configuracaoAutomatica)
              : undefined,
          direcao,
          valorAlvo: input.tipoValor === "CHECKLIST" ? null : (input.valorAlvo ?? null),
          valorAtual: origemProgresso === "AUTOMATICA" ? 0 : (input.valorAtual ?? 0),
          unidade,
          dataInicio,
          dataPrazo,
          prioridade: input.prioridade ?? "MEDIA",
          status: "EM_ANDAMENTO",
          criadoPorId: usuario.id,
        },
        select: {
          id: true,
          origemProgresso: true,
          fonteAutomatica: true,
          metricaAutomatica: true,
          configuracaoAutomatica: true,
          dataInicio: true,
          dataPrazo: true,
        },
      });

      await tx.historicoMeta.create({
        data: {
          metaId: criada.id,
          tipo: "CRIACAO",
          descricao:
            origemProgresso === "AUTOMATICA"
              ? `Meta automática "${titulo}" criada.`
              : `Meta "${titulo}" criada.`,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:criarMeta"),
        {
          acao: ACOES_AUDITORIA.CRIAR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: criada.id,
          dadosDepois: {
            titulo,
            categoria: input.categoria,
            tipoValor: input.tipoValor,
            origemProgresso,
            fonteAutomatica: origemProgresso === "AUTOMATICA" ? (input.fonteAutomatica ?? null) : null,
            metricaAutomatica: origemProgresso === "AUTOMATICA" ? (input.metricaAutomatica ?? null) : null,
            valorAlvo: input.tipoValor === "CHECKLIST" ? null : (input.valorAlvo ?? null),
            valorAtual: origemProgresso === "AUTOMATICA" ? 0 : (input.valorAtual ?? 0),
            dataInicio,
            dataPrazo,
            prioridade: input.prioridade ?? "MEDIA",
          },
        }
      );

      return criada;
    });

    if (meta.origemProgresso === "AUTOMATICA") {
      await sincronizarMetaAutomatica(meta.id);
    }

    revalidatePath("/metas");
    revalidatePath("/");

    return { sucesso: true, mensagem: "Meta criada com sucesso.", id: meta.id };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao criar meta:", erro);
    return { sucesso: false, erro: "Não foi possível criar a meta. Tente novamente." };
  }
}

export async function listarMetas(
  filtros: FiltrosMetasInput = {}
): Promise<{ sucesso: true; dados: LinhaMetaLista[]; total: number } | { sucesso: false; erro: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.ver");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const pagina = Math.max(1, filtros.pagina ?? 1);
    const tamanhoPagina = Math.min(100, Math.max(1, filtros.tamanhoPagina ?? 20));
    const skip = (pagina - 1) * tamanhoPagina;

    // Meta.dataPrazo é DATA DE CALENDÁRIO (meia-noite UTC) — "hoje"/"daqui a
    // 7 dias" precisam da mesma convenção, nunca meia-noite do fuso da loja
    // como instante. Ver lib/datas.ts.
    const hojeCalendario = hojeComoDataDeCalendario(contexto.fusoHorario);

    const where: Prisma.MetaWhereInput = {
      excluidaEm: null,
      criadoPorId: usuario.id,
    };

    if (filtros.busca) {
      const busca = normalizarTexto(filtros.busca);
      if (busca) {
        where.titulo = { contains: busca, mode: "insensitive" };
      }
    }

    if (filtros.categoria && filtros.categoria !== "TODAS") {
      where.categoria = filtros.categoria;
    }

    if (filtros.status && filtros.status !== "TODAS") {
      where.status = filtros.status;
    }

    if (filtros.prioridade && filtros.prioridade !== "TODAS") {
      where.prioridade = filtros.prioridade;
    }

    if (filtros.origemProgresso && filtros.origemProgresso !== "TODAS") {
      where.origemProgresso = filtros.origemProgresso;
    }

    if (filtros.apenasAtrasadas) {
      where.dataPrazo = { lt: hojeCalendario };
      where.status = { in: ["EM_ANDAMENTO", "ATENCAO", "ATRASADA"] };
    }

    if (filtros.apenasProximasVencer) {
      const em7dias = somarDiasEmDataDeCalendario(hojeCalendario, 7);
      where.dataPrazo = { gte: hojeCalendario, lte: em7dias };
    }

    const [metas, total] = await prisma.$transaction([
      prisma.meta.findMany({
        where,
        skip,
        take: tamanhoPagina,
        orderBy: [{ dataPrazo: "asc" }, { criadoEm: "desc" }],
        select: {
          id: true,
          titulo: true,
          descricao: true,
          categoria: true,
          tipoValor: true,
          origemProgresso: true,
          fonteAutomatica: true,
          metricaAutomatica: true,
          direcao: true,
          valorAlvo: true,
          valorAtual: true,
          unidade: true,
          dataInicio: true,
          dataPrazo: true,
          prioridade: true,
          status: true,
          ultimaSincronizacaoEm: true,
          erroSincronizacao: true,
          criadoEm: true,
          // A tela de editar abre a partir da lista e precisa deste campo;
          // sem ele, salvar uma meta automática apagaria em silêncio o
          // período e o produto configurados nela.
          configuracaoAutomatica: true,
          itensChecklist: {
            select: { concluido: true },
          },
        },
      }),
      prisma.meta.count({ where }),
    ]);

    const dados: LinhaMetaLista[] = metas.map((m) => {
      const totalItens = m.itensChecklist.length;
      const itensConcluidos = m.itensChecklist.filter((i) => i.concluido).length;
      const indicador = calcularProgresso(
        m.tipoValor,
        m.direcao,
        numeroDaMeta(m.valorAtual),
        numeroDaMetaOuNulo(m.valorAlvo),
        totalItens,
        itensConcluidos
      );

      return {
        id: m.id,
        titulo: m.titulo,
        descricao: m.descricao,
        categoria: m.categoria,
        tipoValor: m.tipoValor,
        origemProgresso: m.origemProgresso,
        fonteAutomatica: m.fonteAutomatica,
        metricaAutomatica: m.metricaAutomatica,
        direcao: m.direcao,
        valorAlvo: numeroDaMetaOuNulo(m.valorAlvo),
        valorAtual: numeroDaMeta(m.valorAtual),
        unidade: m.unidade,
        dataInicio: serializarData(m.dataInicio),
        dataPrazo: serializarData(m.dataPrazo),
        prioridade: m.prioridade,
        status: m.status,
        progresso: indicador.progresso,
        estaDentroMeta: indicador.estaDentroMeta,
        diferencaMeta: indicador.diferencaMeta,
        totalItensChecklist: totalItens,
        itensConcluidos,
        ultimaSincronizacaoEm: serializarData(m.ultimaSincronizacaoEm),
        erroSincronizacao: m.erroSincronizacao,
        criadoEm: m.criadoEm.toISOString(),
        configuracaoAutomatica: parseConfiguracaoAutomatica(m.configuracaoAutomatica),
      };
    });

    return { sucesso: true, dados, total };
  } catch (erro) {
    console.error("Erro ao listar metas:", erro);
    return { sucesso: false, erro: "Não foi possível carregar as metas." };
  }
}

export async function obterMetaPorId(id: string): Promise<DetalhesMeta | null> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.ver");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const meta = await prisma.meta.findFirst({
      where: { id, excluidaEm: null },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        categoria: true,
        tipoValor: true,
        origemProgresso: true,
        fonteAutomatica: true,
        metricaAutomatica: true,
        configuracaoAutomatica: true,
        direcao: true,
        valorAlvo: true,
        valorAtual: true,
        unidade: true,
        dataInicio: true,
        dataPrazo: true,
        prioridade: true,
        status: true,
        ultimaSincronizacaoEm: true,
        erroSincronizacao: true,
        criadoEm: true,
        concluidaEm: true,
        canceladaEm: true,
        itensChecklist: {
          orderBy: { ordem: "asc" },
          select: {
            id: true,
            titulo: true,
            concluido: true,
            ordem: true,
            concluidoEm: true,
          },
        },
        historicos: {
          orderBy: { criadoEm: "desc" },
          take: 50,
          select: {
            id: true,
            tipo: true,
            descricao: true,
            valorAnterior: true,
            valorNovo: true,
            criadoEm: true,
          },
        },
      },
    });

    if (!meta) return null;

    const totalItens = meta.itensChecklist.length;
    const itensConcluidos = meta.itensChecklist.filter((i) => i.concluido).length;
    const indicador = calcularProgresso(
      meta.tipoValor,
      meta.direcao,
      numeroDaMeta(meta.valorAtual),
      numeroDaMetaOuNulo(meta.valorAlvo),
      totalItens,
      itensConcluidos
    );

    return {
      id: meta.id,
      titulo: meta.titulo,
      descricao: meta.descricao,
      categoria: meta.categoria,
      tipoValor: meta.tipoValor,
      origemProgresso: meta.origemProgresso,
      fonteAutomatica: meta.fonteAutomatica,
      metricaAutomatica: meta.metricaAutomatica,
      direcao: meta.direcao,
      valorAlvo: numeroDaMetaOuNulo(meta.valorAlvo),
      valorAtual: numeroDaMeta(meta.valorAtual),
      unidade: meta.unidade,
      dataInicio: serializarData(meta.dataInicio),
      dataPrazo: serializarData(meta.dataPrazo),
      prioridade: meta.prioridade,
      status: meta.status,
      progresso: indicador.progresso,
      estaDentroMeta: indicador.estaDentroMeta,
      diferencaMeta: indicador.diferencaMeta,
      totalItensChecklist: totalItens,
      itensConcluidos,
      ultimaSincronizacaoEm: serializarData(meta.ultimaSincronizacaoEm),
      erroSincronizacao: meta.erroSincronizacao,
      criadoEm: meta.criadoEm.toISOString(),
      concluidaEm: serializarData(meta.concluidaEm),
      canceladaEm: serializarData(meta.canceladaEm),
      configuracaoAutomatica: parseConfiguracaoAutomatica(meta.configuracaoAutomatica),
      itensChecklist: meta.itensChecklist.map((i) => ({
        id: i.id,
        titulo: i.titulo,
        concluido: i.concluido,
        ordem: i.ordem,
        concluidoEm: serializarData(i.concluidoEm),
      })),
      historicos: meta.historicos.map((h) => ({
        id: h.id,
        tipo: h.tipo,
        descricao: h.descricao,
        valorAnterior: numeroDaMetaOuNulo(h.valorAnterior),
        valorNovo: numeroDaMetaOuNulo(h.valorNovo),
        criadoEm: h.criadoEm.toISOString(),
      })),
    };
  } catch (erro) {
    console.error("Erro ao obter meta:", erro);
    return null;
  }
}

export async function obterDashboardMetas(): Promise<DashboardMetasResult> {
  const vazio: DashboardMetasResult = {
    totalMetas: 0,
    metasManuais: 0,
    metasAutomaticas: 0,
    emAndamento: 0,
    concluidas: 0,
    atrasadas: 0,
    emAtencao: 0,
    pausadas: 0,
    canceladas: 0,
    automaticasComErroSincronizacao: 0,
    valorTotalPlanejado: 0,
    valorAlcancado: 0,
    proximasVencer: 0,
  };

  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.ver");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    // Meta.dataPrazo é DATA DE CALENDÁRIO — mesma convenção do bloco acima.
    const agora = hojeComoDataDeCalendario(contexto.fusoHorario);
    const em7dias = somarDiasEmDataDeCalendario(agora, 7);

    const [contagens, metasManuais, metasAutomaticas, automaticasComErroSincronizacao, somasDinheiro, proximasVencer] =
      await prisma.$transaction([
        prisma.$queryRaw<Array<{ status: string; total: bigint }>>`
          SELECT status, COUNT(*) AS total
          FROM "Meta"
          WHERE "excluidaEm" IS NULL
            AND "criadoPorId" = ${usuario.id}
          GROUP BY status
        `,
        prisma.meta.count({
          where: { excluidaEm: null, origemProgresso: "MANUAL" },
        }),
        prisma.meta.count({
          where: { excluidaEm: null, origemProgresso: "AUTOMATICA" },
        }),
        prisma.meta.count({
          where: {
            excluidaEm: null,
            origemProgresso: "AUTOMATICA",
            erroSincronizacao: { not: null },
          },
        }),
        prisma.meta.aggregate({
          where: { excluidaEm: null, tipoValor: "DINHEIRO" },
          _sum: { valorAlvo: true, valorAtual: true },
        }),
        prisma.meta.count({
          where: {
            excluidaEm: null,
            status: { in: ["EM_ANDAMENTO", "ATENCAO"] },
            dataPrazo: { gte: agora, lte: em7dias },
          },
        }),
      ]);

    const mapa: Record<string, number> = {};
    for (const c of contagens) {
      mapa[c.status] = Number(c.total);
    }

    const total = Object.values(mapa).reduce((a, b) => a + b, 0);

    return {
      totalMetas: total,
      metasManuais,
      metasAutomaticas,
      emAndamento: mapa.EM_ANDAMENTO ?? 0,
      concluidas: mapa.CONCLUIDA ?? 0,
      atrasadas: mapa.ATRASADA ?? 0,
      emAtencao: mapa.ATENCAO ?? 0,
      pausadas: mapa.PAUSADA ?? 0,
      canceladas: mapa.CANCELADA ?? 0,
      automaticasComErroSincronizacao,
      // A soma e exata porque acontece no Postgres sobre numeric; aqui e so
      // a conversao da borda. Antes `?? 0` podia devolver um Decimal cru
      // direto pra tela.
      valorTotalPlanejado: numeroDaMeta(somasDinheiro._sum.valorAlvo),
      valorAlcancado: numeroDaMeta(somasDinheiro._sum.valorAtual),
      proximasVencer,
    };
  } catch (erro) {
    console.error("Erro ao obter dashboard de metas:", erro);
    return vazio;
  }
}

export async function atualizarMeta(input: AtualizarMetaInput): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const erroValidacao = validarEntradaMeta(input);
    if (erroValidacao) {
      return { sucesso: false, erro: erroValidacao };
    }

    const metaExistente = await prisma.meta.findFirst({
      where: { id: input.id, excluidaEm: null },
      select: { id: true, titulo: true, dataPrazo: true },
    });

    if (!metaExistente) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    const origemProgresso = input.origemProgresso ?? "MANUAL";
    const titulo = normalizarTexto(input.titulo);
    const prazoAnterior = metaExistente.dataPrazo;
    const novoPrazo = parseDataIso(input.dataPrazo);
    const prazoAlterado = prazoAnterior?.toISOString() !== novoPrazo?.toISOString();

    await prisma.$transaction(async (tx) => {
      await tx.meta.update({
        where: { id: input.id },
        data: {
          titulo,
          descricao: normalizarTexto(input.descricao) || null,
          categoria: input.categoria,
          tipoValor: input.tipoValor,
          origemProgresso,
          fonteAutomatica: origemProgresso === "AUTOMATICA" ? (input.fonteAutomatica ?? null) : null,
          metricaAutomatica: origemProgresso === "AUTOMATICA" ? (input.metricaAutomatica ?? null) : null,
          configuracaoAutomatica:
            origemProgresso === "AUTOMATICA"
              ? paraJsonConfiguracao(input.configuracaoAutomatica)
              : Prisma.JsonNull,
          direcao: input.direcao ?? "MAIOR_MELHOR",
          valorAlvo: input.tipoValor === "CHECKLIST" ? null : (input.valorAlvo ?? null),
          valorAtual: origemProgresso === "AUTOMATICA" ? undefined : (input.valorAtual ?? 0),
          unidade: normalizarTexto(input.unidade) || null,
          dataInicio: parseDataIso(input.dataInicio),
          dataPrazo: novoPrazo,
          prioridade: input.prioridade ?? "MEDIA",
        },
      });

      await tx.historicoMeta.create({
        data: {
          metaId: input.id,
          tipo: prazoAlterado ? "ALTERACAO_PRAZO" : "OBSERVACAO",
          descricao: prazoAlterado
            ? `Prazo atualizado para ${novoPrazo ? dataParaIsoDia(novoPrazo) : "sem prazo"}.`
            : `Meta "${titulo}" atualizada.`,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:atualizarMeta"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: input.id,
          dadosAntes: {
            titulo: metaExistente.titulo,
            dataPrazo: metaExistente.dataPrazo,
          },
          dadosDepois: {
            titulo,
            dataPrazo: novoPrazo,
            categoria: input.categoria,
            tipoValor: input.tipoValor,
            origemProgresso,
          },
        }
      );
    });

    if (origemProgresso === "AUTOMATICA") {
      await sincronizarMetaAutomatica(input.id);
    }

    revalidatePath("/metas");
    revalidatePath(`/metas/${input.id}`);
    revalidatePath("/");

    return { sucesso: true, mensagem: "Meta atualizada com sucesso." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao atualizar meta:", erro);
    return { sucesso: false, erro: "Não foi possível atualizar a meta." };
  }
}

export async function atualizarProgressoMeta(input: AtualizarProgressoInput): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    if (!input.id) {
      return { sucesso: false, erro: "ID da meta inválido." };
    }

    if (typeof input.valorNovo !== "number" || !isFinite(input.valorNovo) || input.valorNovo < 0) {
      return { sucesso: false, erro: "Valor deve ser um número não negativo." };
    }

    const observacao = normalizarTexto(input.observacao);
    if (observacao.length > 500) {
      return { sucesso: false, erro: "Observação não pode exceder 500 caracteres." };
    }

    const meta = await prisma.meta.findFirst({
      where: { id: input.id, excluidaEm: null },
      select: { id: true, valorAtual: true, status: true, origemProgresso: true },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    if (meta.origemProgresso === "AUTOMATICA") {
      return { sucesso: false, erro: "Metas automáticas devem ser atualizadas pela sincronização." };
    }

    if (meta.status === "CONCLUIDA" || meta.status === "CANCELADA") {
      return { sucesso: false, erro: "Não é possível atualizar o progresso de uma meta concluída ou cancelada." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.meta.update({
        where: { id: input.id },
        data: { valorAtual: input.valorNovo },
      });

      const descHistorico = observacao
        ? `Progresso atualizado para ${input.valorNovo}. Observação: ${observacao}`
        : `Progresso atualizado de ${numeroDaMeta(meta.valorAtual)} para ${input.valorNovo}.`;

      await tx.historicoMeta.create({
        data: {
          metaId: input.id,
          tipo: "ATUALIZACAO_PROGRESSO",
          descricao: descHistorico,
          valorAnterior: numeroDaMeta(meta.valorAtual),
          valorNovo: input.valorNovo,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:atualizarProgressoMeta"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_PROGRESSO_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: input.id,
          dadosAntes: {
            valorAtual: numeroDaMeta(meta.valorAtual),
          },
          dadosDepois: {
            valorAtual: input.valorNovo,
            observacao,
          },
        }
      );
    });

    revalidatePath("/metas");
    revalidatePath(`/metas/${input.id}`);

    return { sucesso: true, mensagem: "Progresso atualizado com sucesso." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao atualizar progresso:", erro);
    return { sucesso: false, erro: "Não foi possível atualizar o progresso." };
  }
}

export async function alterarStatusMeta(input: AlterarStatusInput): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    if (!statusValidos.includes(input.status)) {
      return { sucesso: false, erro: "Status inválido." };
    }

    const meta = await prisma.meta.findFirst({
      where: { id: input.id, excluidaEm: null },
      select: { id: true, status: true },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    if (meta.status === "CANCELADA") {
      return { sucesso: false, erro: "Não é possível alterar o status de uma meta cancelada." };
    }
    if (meta.status === "CONCLUIDA" && input.status !== "EM_ANDAMENTO") {
      return { sucesso: false, erro: "Meta concluída só pode ser reaberta." };
    }

    const agora = new Date();
    let tipoHistorico: TipoHistoricoMeta = "ALTERACAO_STATUS";

    const dataExtra: Prisma.MetaUpdateInput = {};
    if (input.status === "CONCLUIDA") {
      dataExtra.concluidaEm = agora;
      tipoHistorico = "CONCLUSAO";
    } else if (input.status === "CANCELADA") {
      dataExtra.canceladaEm = agora;
      tipoHistorico = "CANCELAMENTO";
    } else if (input.status === "PAUSADA") {
      tipoHistorico = "PAUSA";
    } else if (input.status === "EM_ANDAMENTO" && meta.status === "CONCLUIDA") {
      dataExtra.concluidaEm = null;
    }

    const observacao = normalizarTexto(input.observacao);
    const descricao = observacao
      ? `Status alterado para ${input.status}. ${observacao}`
      : `Status alterado de ${meta.status} para ${input.status}.`;

    await prisma.$transaction(async (tx) => {
      await tx.meta.update({
        where: { id: input.id },
        data: { status: input.status, ...dataExtra },
      });

      await tx.historicoMeta.create({
        data: {
          metaId: input.id,
          tipo: tipoHistorico,
          descricao,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:alterarStatusMeta"),
        {
          acao: ACOES_AUDITORIA.ALTERAR_STATUS_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: input.id,
          dadosAntes: {
            status: meta.status,
          },
          dadosDepois: {
            status: input.status,
            observacao,
          },
        }
      );
    });

    revalidatePath("/metas");
    revalidatePath(`/metas/${input.id}`);
    revalidatePath("/");

    return { sucesso: true, mensagem: "Status atualizado com sucesso." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao alterar status:", erro);
    return { sucesso: false, erro: "Não foi possível alterar o status." };
  }
}

export async function adicionarItemChecklistMeta(input: ItemChecklistInput): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const titulo = normalizarTexto(input.titulo);
    if (titulo.length < 2 || titulo.length > 160) {
      return { sucesso: false, erro: "Título do item deve ter entre 2 e 160 caracteres." };
    }

    const meta = await prisma.meta.findFirst({
      where: { id: input.metaId, excluidaEm: null },
      select: { id: true, _count: { select: { itensChecklist: true } } },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    await prisma.$transaction(async (tx) => {
      const itemCriado = await tx.itemChecklistMeta.create({
        data: {
          metaId: input.metaId,
          titulo,
          ordem: input.ordem ?? meta._count.itensChecklist,
        },
        select: {
          id: true,
        },
      });

      await tx.historicoMeta.create({
        data: {
          metaId: input.metaId,
          tipo: "ALTERACAO_CHECKLIST",
          descricao: `Item adicionado ao checklist: "${titulo}".`,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:adicionarItemChecklistMeta"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: input.metaId,
          dadosDepois: {
            checklist: {
              operacao: "ADICIONAR_ITEM",
              itemId: itemCriado.id,
              titulo,
            },
          },
        }
      );
    });

    revalidatePath(`/metas/${input.metaId}`);

    return { sucesso: true, mensagem: "Item adicionado." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao adicionar item:", erro);
    return { sucesso: false, erro: "Não foi possível adicionar o item." };
  }
}

export async function alternarItemChecklistMeta(itemId: string): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const item = await prisma.itemChecklistMeta.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        titulo: true,
        concluido: true,
        metaId: true,
        meta: { select: { criadoPorId: true, excluidaEm: true } },
      },
    });

    if (!item || item.meta.excluidaEm) {
      return { sucesso: false, erro: "Item não encontrado." };
    }

    const novoConcluido = !item.concluido;
    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.itemChecklistMeta.update({
        where: { id: itemId },
        data: {
          concluido: novoConcluido,
          concluidoEm: novoConcluido ? agora : null,
        },
      });

      await tx.historicoMeta.create({
        data: {
          metaId: item.metaId,
          tipo: "ALTERACAO_CHECKLIST",
          descricao: novoConcluido
            ? `Item concluído: "${item.titulo}".`
            : `Item desmarcado: "${item.titulo}".`,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:alternarItemChecklistMeta"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: item.metaId,
          dadosAntes: {
            checklist: {
              itemId,
              concluido: item.concluido,
            },
          },
          dadosDepois: {
            checklist: {
              itemId,
              concluido: novoConcluido,
            },
          },
        }
      );
    });

    revalidatePath(`/metas/${item.metaId}`);

    return { sucesso: true, mensagem: novoConcluido ? "Item concluído." : "Item desmarcado." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao alternar item:", erro);
    return { sucesso: false, erro: "Não foi possível atualizar o item." };
  }
}

export async function removerItemChecklistMeta(itemId: string): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const item = await prisma.itemChecklistMeta.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        titulo: true,
        metaId: true,
        meta: { select: { criadoPorId: true, excluidaEm: true } },
      },
    });

    if (!item || item.meta.excluidaEm) {
      return { sucesso: false, erro: "Item não encontrado." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.itemChecklistMeta.delete({ where: { id: itemId } });

      await tx.historicoMeta.create({
        data: {
          metaId: item.metaId,
          tipo: "ALTERACAO_CHECKLIST",
          descricao: `Item removido do checklist: "${item.titulo}".`,
          criadoPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:removerItemChecklistMeta"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: item.metaId,
          dadosAntes: {
            checklist: {
              itemId,
              titulo: item.titulo,
            },
          },
          dadosDepois: {
            checklist: {
              itemId,
              removido: true,
            },
          },
        }
      );
    });

    revalidatePath(`/metas/${item.metaId}`);

    return { sucesso: true, mensagem: "Item removido." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao remover item:", erro);
    return { sucesso: false, erro: "Não foi possível remover o item." };
  }
}

export async function adicionarHistoricoMeta(metaId: string, observacao: string): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const texto = normalizarTexto(observacao);
    if (texto.length < 2 || texto.length > 500) {
      return { sucesso: false, erro: "Observação deve ter entre 2 e 500 caracteres." };
    }

    const meta = await prisma.meta.findFirst({
      where: { id: metaId, excluidaEm: null },
      select: { id: true },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    await registrarHistorico(prisma, {
      metaId,
      tipo: "OBSERVACAO",
      descricao: texto,
      criadoPorId: usuario.id,
    });

    revalidatePath(`/metas/${metaId}`);

    return { sucesso: true, mensagem: "Observação registrada." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao adicionar observação:", erro);
    return { sucesso: false, erro: "Não foi possível registrar a observação." };
  }
}

export async function calcularValorAtualMetaAutomatica(metaId: string): Promise<ResultadoCalculoMetaAutomatica> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.ver");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const meta = await prisma.meta.findFirst({
      where: {
        id: metaId,
        excluidaEm: null,
      },
      select: {
        id: true,
        criadoPorId: true,
        origemProgresso: true,
        fonteAutomatica: true,
        metricaAutomatica: true,
        configuracaoAutomatica: true,
        dataInicio: true,
        dataPrazo: true,
      },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    return executarCalculoMetaAutomatica(prisma, meta, contexto.fusoHorario ?? FUSO_HORARIO_PADRAO);
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao calcular meta automática:", erro);
    return { sucesso: false, erro: "Não foi possível calcular a meta automática." };
  }
}

export async function sincronizarMetaAutomatica(metaId: string): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const meta = await prisma.meta.findFirst({
      where: {
        id: metaId,
        excluidaEm: null,
      },
      select: {
        id: true,
        titulo: true,
        criadoPorId: true,
        origemProgresso: true,
        fonteAutomatica: true,
        metricaAutomatica: true,
        configuracaoAutomatica: true,
        dataInicio: true,
        dataPrazo: true,
        valorAtual: true,
        tipoValor: true,
        unidade: true,
        erroSincronizacao: true,
      },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    if (meta.origemProgresso !== "AUTOMATICA") {
      return { sucesso: false, erro: "Esta meta é manual e não pode ser sincronizada automaticamente." };
    }

    const calculo = await executarCalculoMetaAutomatica(prisma, meta, contexto.fusoHorario ?? FUSO_HORARIO_PADRAO);
    if (!calculo.sucesso) {
      await prisma.meta.update({
        where: { id: meta.id },
        data: {
          erroSincronizacao: calculo.erro,
        },
      });
      revalidatePath("/metas");
      revalidatePath(`/metas/${metaId}`);
      revalidatePath("/");
      return { sucesso: false, erro: "Não foi possível sincronizar a meta automática." };
    }

    const valorNovo = Number(calculo.valorAtual.toFixed(2));
    const valorAnterior = numeroDaMeta(meta.valorAtual);
    const houveMudanca = valorNovo !== valorAnterior;

    await prisma.$transaction(async (tx) => {
      await tx.meta.update({
        where: { id: meta.id },
        data: {
          valorAtual: valorNovo,
          ultimaSincronizacaoEm: new Date(),
          erroSincronizacao: null,
        },
      });

      if (houveMudanca) {
        await tx.historicoMeta.create({
          data: {
            metaId: meta.id,
            tipo: "SINCRONIZACAO_AUTOMATICA",
            descricao: mensagemSincronizacao(valorAnterior, valorNovo, meta.unidade, meta.tipoValor),
            valorAnterior,
            valorNovo,
            criadoPorId: usuario.id,
          },
        });
      }

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:sincronizarMetaAutomatica"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: meta.id,
          dadosAntes: {
            valorAtual: valorAnterior,
            erroSincronizacao: meta.erroSincronizacao,
          },
          dadosDepois: {
            valorAtual: valorNovo,
            houveMudanca,
          },
        }
      );
    });

    revalidatePath("/metas");
    revalidatePath(`/metas/${meta.id}`);
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: houveMudanca
        ? "Meta automática sincronizada com novo valor."
        : "Meta automática sincronizada. Não houve alteração no valor.",
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao sincronizar meta automática:", erro);
    return { sucesso: false, erro: "Não foi possível sincronizar a meta automática." };
  }
}

export async function sincronizarTodasMetasAutomaticas(): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.editar");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const metasAutomaticas = await prisma.meta.findMany({
      where: {
        excluidaEm: null,
        origemProgresso: "AUTOMATICA",
      },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    });

    if (metasAutomaticas.length === 0) {
      return { sucesso: true, mensagem: "Nenhuma meta automática para sincronizar." };
    }

    let sucesso = 0;
    let falhas = 0;

    for (const meta of metasAutomaticas) {
      const resultado = await sincronizarMetaAutomatica(meta.id);
      if (resultado.sucesso) {
        sucesso += 1;
      } else {
        falhas += 1;
      }
    }

    revalidatePath("/metas");
    revalidatePath("/");

    if (falhas > 0) {
      return {
        sucesso: true,
        mensagem: `Sincronização concluída com alertas: ${sucesso} sucesso(s), ${falhas} falha(s).`,
      };
    }

    return { sucesso: true, mensagem: `Sincronização concluída: ${sucesso} meta(s) atualizada(s).` };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao sincronizar todas as metas automáticas:", erro);
    return { sucesso: false, erro: "Não foi possível sincronizar as metas automáticas." };
  }
}

export async function excluirMeta(id: string): Promise<ResultadoAcao> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "metas.excluir");
    const prisma = contexto.prisma;
    const usuario = { id: obterUsuarioOperacionalId(contexto) };

    const meta = await prisma.meta.findFirst({
      where: { id, excluidaEm: null },
      select: { id: true, titulo: true },
    });

    if (!meta) {
      return { sucesso: false, erro: "Meta não encontrada." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.meta.update({
        where: { id },
        data: {
          excluidaEm: new Date(),
          excluidaPorId: usuario.id,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaMetas(usuario.id, "app/actions/metas.ts:excluirMeta"),
        {
          acao: ACOES_AUDITORIA.EXCLUIR_META,
          entidade: ENTIDADES_AUDITORIA.META,
          entidadeId: id,
          dadosAntes: {
            titulo: meta.titulo,
            excluidaEm: null,
          },
          dadosDepois: {
            titulo: meta.titulo,
            excluidaEm: new Date().toISOString(),
          },
        }
      );
    });

    revalidatePath("/metas");
    revalidatePath("/");

    return { sucesso: true, mensagem: `Meta "${meta.titulo}" excluída.` };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao excluir meta:", erro);
    return { sucesso: false, erro: "Não foi possível excluir a meta." };
  }
}

/**
 * Sincroniza as metas automáticas de UM tenant, recebendo o client por
 * parâmetro em vez de resolver sessão.
 *
 * Existe porque a sincronização automática só rodava quando alguém clicava:
 * ou no botão da tela de Metas, ou no botão do detalhe de uma meta. Uma meta
 * automática guarda a fonte (OS, PDV, financeiro…) e a métrica (faturamento,
 * quantidade, ticket médio…), a conta estava certa — e nunca era executada.
 * Era exatamente isso o "parte funciona e os dados não se cruzam".
 *
 * Fica neste arquivo, e não em `lib/`, porque `executarCalculoMetaAutomatica`
 * e os cinco helpers de período e filtro que ela usa estão aqui. Movê-los
 * para `lib/metas/` é o certo e está no escopo da Fase 2B (camada de
 * domínio); fazer esse arrasto agora, só para habilitar o cron, seria
 * carregar o risco de uma refatoração grande sem precisar.
 *
 * Não chama `revalidatePath`: quem chama é o cron, fora de qualquer
 * requisição de usuário, e revalidar cache de rota dali não faz sentido.
 */
export async function sincronizarMetasAutomaticasDoTenant(
  prisma: PrismaMetasClient,
  fusoHorario: string = FUSO_HORARIO_PADRAO,
  usuarioId: string | null = null
): Promise<{ verificadas: number; atualizadas: number; falhas: number }> {
  const metasAutomaticas = await prisma.meta.findMany({
    where: { excluidaEm: null, origemProgresso: "AUTOMATICA" },
    select: {
      id: true,
      titulo: true,
      criadoPorId: true,
      origemProgresso: true,
      fonteAutomatica: true,
      metricaAutomatica: true,
      configuracaoAutomatica: true,
      dataInicio: true,
      dataPrazo: true,
      valorAtual: true,
      tipoValor: true,
      unidade: true,
      erroSincronizacao: true,
    },
    orderBy: { criadoEm: "asc" },
  });

  let atualizadas = 0;
  let falhas = 0;

  for (const meta of metasAutomaticas) {
    const calculo = await executarCalculoMetaAutomatica(prisma, meta, fusoHorario);

    if (!calculo.sucesso) {
      // Grava o motivo na própria meta: sem isso, a tela mostraria um valor
      // velho sem nada dizendo que a última sincronização falhou.
      await prisma.meta.update({
        where: { id: meta.id },
        data: { erroSincronizacao: calculo.erro },
      });
      falhas += 1;
      continue;
    }

    const valorNovo = Number(calculo.valorAtual.toFixed(2));
    const valorAnterior = numeroDaMeta(meta.valorAtual);
    const houveMudanca = valorNovo !== valorAnterior;

    await prisma.$transaction(async (tx) => {
      await tx.meta.update({
        where: { id: meta.id },
        data: {
          valorAtual: valorNovo,
          ultimaSincronizacaoEm: new Date(),
          erroSincronizacao: null,
        },
      });

      if (houveMudanca) {
        await tx.historicoMeta.create({
          data: {
            metaId: meta.id,
            tipo: "SINCRONIZACAO_AUTOMATICA",
            descricao: mensagemSincronizacao(valorAnterior, valorNovo, meta.unidade, meta.tipoValor),
            valorAnterior,
            valorNovo,
            criadoPorId: usuarioId,
          },
        });
      }
    });

    if (houveMudanca) atualizadas += 1;
  }

  return { verificadas: metasAutomaticas.length, atualizadas, falhas };
}
