"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { deDecimal, paraDecimal } from "@/lib/dinheiro";
import { dataDeCalendario } from "@/lib/datas";
import { apurarNota, apurarPeriodo, IMPOSTO_PADRAO_PERCENTUAL, type ApuracaoPeriodo, type NotaApuracao } from "@/lib/dominio/prefeitura/apuracao";
import { apurarCaixa, type ApuracaoCaixa, type ContaCaixa } from "@/lib/dominio/prefeitura/caixa";

const ORIGEM = "prefeitura";

type NotaComItens = {
  id: string;
  numero: string;
  serie: string | null;
  status: string;
  dataEmissao: Date | null;
  clienteNome: string | null;
  valorTotal: unknown;
  modoCusto: "ITENS" | "TOTAL";
  custoTotalInformado: unknown;
  freteInformado: unknown;
  impostoPercentual: unknown;
  impostosReais: unknown;
  segmento: string | null;
  segmentoManual: boolean;
  descricaoItens: string | null;
  linkDanfe: string | null;
  itens: Array<{
    id: string;
    ordem: number;
    descricao: string;
    quantidade: unknown;
    valorUnitarioVenda: unknown;
    valorTotalVenda: unknown;
    custoTotal: unknown;
  }>;
};

const centavosOuNulo = (valor: unknown): number | null => (valor === null || valor === undefined ? null : deDecimal(valor as never));
const centavos = (valor: unknown): number => (valor === null || valor === undefined ? 0 : deDecimal(valor as never));

function paraApuracao(nota: NotaComItens): NotaApuracao {
  return {
    receitaCentavos: centavos(nota.valorTotal),
    modoCusto: nota.modoCusto,
    custoTotalInformadoCentavos: centavosOuNulo(nota.custoTotalInformado),
    impostosCentavos: centavosOuNulo(nota.impostosReais),
    freteCentavos: centavos(nota.freteInformado),
    // Nota sem alíquota informada assume o padrão (Simples 4%), para o lucro
    // líquido já descontar imposto sem precisar salvar nota por nota. Uma
    // alíquota definida à mão (inclusive 0) sobrepõe.
    impostoPercentual:
      nota.impostoPercentual === null || nota.impostoPercentual === undefined ? IMPOSTO_PADRAO_PERCENTUAL : Number(nota.impostoPercentual),
    itens: nota.itens.map((i) => ({
      valorVendaCentavos: centavos(i.valorTotalVenda),
      custoCentavos: centavosOuNulo(i.custoTotal),
    })),
    // Caixa/recebimento entram num passo seguinte (precisa casar nota↔conta).
    recebida: false,
    dataEmissao: nota.dataEmissao,
    dataVencimento: null,
  };
}

export type ItemNotaPrefeitura = {
  id: string;
  ordem: number;
  descricao: string;
  quantidade: number;
  valorUnitarioVendaCentavos: number;
  valorTotalVendaCentavos: number;
  custoCentavos: number | null;
  lucroBrutoCentavos: number | null;
};

export type ResumoNotaPrefeitura = {
  id: string;
  numero: string;
  serie: string | null;
  status: string;
  dataEmissao: string | null;
  clienteNome: string | null;
  descricaoItens: string | null;
  receitaCentavos: number;
  custoCentavos: number;
  custoCompleto: boolean;
  temBaseDeCusto: boolean;
  itensSemCusto: number;
  lucroBrutoCentavos: number;
  margemBrutaPct: number | null;
  lucroLiquidoCentavos: number;
  impostosConhecidos: boolean;
};

function resumir(nota: NotaComItens): ResumoNotaPrefeitura {
  const a = apurarNota(paraApuracao(nota));
  return {
    id: nota.id,
    numero: nota.numero,
    serie: nota.serie,
    status: nota.status,
    dataEmissao: nota.dataEmissao ? nota.dataEmissao.toISOString() : null,
    clienteNome: nota.clienteNome,
    descricaoItens: nota.descricaoItens,
    receitaCentavos: a.receitaCentavos,
    custoCentavos: a.custoCentavos,
    custoCompleto: a.custoCompleto,
    temBaseDeCusto: a.temBaseDeCusto,
    itensSemCusto: a.itensSemCusto,
    lucroBrutoCentavos: a.lucroBrutoCentavos,
    margemBrutaPct: a.margemBrutaPct,
    lucroLiquidoCentavos: a.lucroLiquidoCentavos,
    impostosConhecidos: a.impostosConhecidos,
  };
}

export type FiltrosPrefeitura = { cliente?: string | null; de?: string | null; ate?: string | null };

export type PainelPrefeitura = {
  periodo: ApuracaoPeriodo;
  notas: ResumoNotaPrefeitura[];
  /** Nomes de prefeitura disponíveis para o seletor (todas, sem filtro). */
  prefeituras: string[];
  /** Filtros efetivamente aplicados (já normalizados). */
  filtros: { cliente: string | null; de: string | null; ate: string | null };
};

// Aceita só YYYY-MM-DD; qualquer outra coisa vira null (filtro ignorado).
function dataValida(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : v;
}

/** Carrega o painel da Prefeitura: KPIs do período + as notas com apuração. */
export async function obterPainelPrefeitura(filtros: FiltrosPrefeitura = {}): Promise<PainelPrefeitura> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  const cliente = (filtros.cliente ?? "").trim() || null;
  const de = dataValida(filtros.de);
  const ate = dataValida(filtros.ate);

  const where: Record<string, unknown> = { segmento: "PREFEITURA" };
  if (cliente) where.clienteNome = cliente;
  // dataEmissao é data de calendário (meia-noite UTC), então os limites batem
  // exatos com o dia escolhido — `ate` inclui o próprio dia. As datas já vêm
  // validadas (YYYY-MM-DD), então dataDeCalendario não devolve null aqui, mas
  // o guard mantém o tipo honesto.
  const inicio = de ? dataDeCalendario(de) : null;
  const fim = ate ? dataDeCalendario(ate) : null;
  if (inicio || fim) {
    const faixa: { gte?: Date; lte?: Date } = {};
    if (inicio) faixa.gte = inicio;
    if (fim) faixa.lte = fim;
    where.dataEmissao = faixa;
  }

  const [notas, distintas] = await Promise.all([
    contexto.prisma.notaFiscal.findMany({
      where,
      orderBy: { dataEmissao: "desc" },
      include: { itens: { orderBy: { ordem: "asc" } } },
    }) as unknown as Promise<NotaComItens[]>,
    contexto.prisma.notaFiscal.findMany({
      where: { segmento: "PREFEITURA", clienteNome: { not: null } },
      select: { clienteNome: true },
      distinct: ["clienteNome"],
      orderBy: { clienteNome: "asc" },
    }) as unknown as Promise<Array<{ clienteNome: string | null }>>,
  ]);

  return {
    periodo: apurarPeriodo(notas.map(paraApuracao)),
    notas: notas.map(resumir),
    prefeituras: distintas.map((d) => d.clienteNome).filter((n): n is string => !!n),
    filtros: { cliente, de, ate },
  };
}

export type ContaAbertaPrefeitura = {
  id: string;
  descricao: string;
  prefeitura: string | null;
  valorCentavos: number;
  vencimento: string;
  atrasoDias: number;
};

export type RankingPrefeitura = {
  nome: string;
  recebidoCentavos: number;
  aReceberCentavos: number;
  /** recebido / (recebido + a receber), 0–100. NULO sem base. */
  percentualRecebido: number | null;
};

export type CaixaPrefeitura = ApuracaoCaixa & {
  temDados: boolean;
  contasAbertas: ContaAbertaPrefeitura[];
  /** Ranking das prefeituras por dinheiro recebido (desde sempre, todas). */
  ranking: RankingPrefeitura[];
  /** Nomes de prefeitura para o seletor. */
  prefeituras: string[];
  filtros: { cliente: string | null; de: string | null; ate: string | null };
};

const DIA_MS = 24 * 60 * 60 * 1000;

function hojeCalendario(): Date {
  const a = new Date();
  return dataDeCalendario(
    `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, "0")}-${String(a.getUTCDate()).padStart(2, "0")}`
  ) as Date;
}

/**
 * Posição de caixa das vendas para a prefeitura: a receber (em aberto,
 * vencido e a vencer), recebido e prazo médio de recebimento, mais o ranking
 * das prefeituras que mais renderam. Usa as contas a receber do Bling
 * agrupadas pelos documentos (CNPJ) das prefeituras.
 *
 * Filtros (iguais aos da tela de resultado): por prefeitura e por período de
 * VENCIMENTO. O ranking ignora os filtros de propósito (visão estratégica de
 * todas as prefeituras, desde sempre).
 */
export async function obterCaixaPrefeitura(filtros: FiltrosPrefeitura = {}): Promise<CaixaPrefeitura> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  const cliente = (filtros.cliente ?? "").trim() || null;
  const de = dataValida(filtros.de);
  const ate = dataValida(filtros.ate);

  const vazio: CaixaPrefeitura = {
    aReceberAbertoCentavos: 0,
    vencidoCentavos: 0,
    aVencerCentavos: 0,
    recebidoCentavos: 0,
    qtdAberto: 0,
    qtdVencido: 0,
    prazoMedioDias: null,
    temDados: false,
    contasAbertas: [],
    ranking: [],
    prefeituras: [],
    filtros: { cliente, de, ate },
  };

  // Mapa documento (CNPJ) -> nome da prefeitura, a partir das notas.
  const notas = (await contexto.prisma.notaFiscal.findMany({
    where: { segmento: "PREFEITURA", clienteDocumento: { not: null } },
    select: { clienteDocumento: true, clienteNome: true },
  })) as Array<{ clienteDocumento: string | null; clienteNome: string | null }>;

  const docParaNome = new Map<string, string>();
  for (const n of notas) {
    const doc = (n.clienteDocumento ?? "").replace(/\D/g, "");
    if (doc && !docParaNome.has(doc) && n.clienteNome) docParaNome.set(doc, n.clienteNome);
  }
  const documentos = Array.from(new Set(notas.map((n) => (n.clienteDocumento ?? "").replace(/\D/g, "")).filter((d) => d.length > 0)));
  if (documentos.length === 0) return vazio;

  const prefeituras = Array.from(new Set(docParaNome.values())).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const docsDoCliente = cliente ? documentos.filter((d) => docParaNome.get(d) === cliente) : null;

  const contas = (await contexto.prisma.contaReceber.findMany({
    where: { clienteDocumento: { in: documentos } },
    select: {
      id: true,
      descricao: true,
      valor: true,
      status: true,
      dataVencimento: true,
      dataRecebimento: true,
      estornadaEm: true,
      clienteDocumento: true,
    },
    orderBy: { dataVencimento: "asc" },
  })) as Array<{
    id: string;
    descricao: string;
    valor: unknown;
    status: string;
    dataVencimento: Date;
    dataRecebimento: Date | null;
    estornadaEm: Date | null;
    clienteDocumento: string | null;
  }>;

  if (contas.length === 0) return { ...vazio, prefeituras };

  const hoje = hojeCalendario();
  const inicio = de ? (dataDeCalendario(de) as Date) : null;
  const fim = ate ? (dataDeCalendario(ate) as Date) : null;

  // Contas que entram nos KPIs: respeita prefeitura e período (por vencimento).
  const filtradas = contas.filter((c) => {
    const doc = (c.clienteDocumento ?? "").replace(/\D/g, "");
    if (docsDoCliente && !docsDoCliente.includes(doc)) return false;
    if (inicio && c.dataVencimento.getTime() < inicio.getTime()) return false;
    if (fim && c.dataVencimento.getTime() > fim.getTime()) return false;
    return true;
  });

  const paraCaixa: ContaCaixa[] = filtradas.map((c) => ({
    valorCentavos: centavos(c.valor),
    recebida: c.status === "RECEBIDO",
    estornada: c.status === "ESTORNADO" || c.estornadaEm !== null,
    vencimento: c.dataVencimento,
    recebimento: c.dataRecebimento,
  }));

  const apuracao = apurarCaixa(paraCaixa, hoje);

  const contasAbertas: ContaAbertaPrefeitura[] = filtradas
    .filter((c) => c.status !== "RECEBIDO" && c.status !== "ESTORNADO" && c.estornadaEm === null)
    .slice(0, 20)
    .map((c) => ({
      id: c.id,
      descricao: c.descricao || "Conta a receber",
      prefeitura: docParaNome.get((c.clienteDocumento ?? "").replace(/\D/g, "")) ?? null,
      valorCentavos: centavos(c.valor),
      vencimento: c.dataVencimento.toISOString(),
      atrasoDias: Math.max(0, Math.round((hoje.getTime() - c.dataVencimento.getTime()) / DIA_MS)),
    }));

  // Ranking: todas as prefeituras, desde sempre (ignora filtros).
  const porDoc = new Map<string, { recebido: number; aReceber: number }>();
  for (const c of contas) {
    if (c.status === "ESTORNADO" || c.estornadaEm !== null) continue;
    const doc = (c.clienteDocumento ?? "").replace(/\D/g, "");
    if (!doc) continue;
    const acc = porDoc.get(doc) ?? { recebido: 0, aReceber: 0 };
    if (c.status === "RECEBIDO") acc.recebido += centavos(c.valor);
    else acc.aReceber += centavos(c.valor);
    porDoc.set(doc, acc);
  }
  const ranking: RankingPrefeitura[] = Array.from(porDoc.entries())
    .map(([doc, v]) => {
      const total = v.recebido + v.aReceber;
      return {
        nome: docParaNome.get(doc) ?? "Prefeitura",
        recebidoCentavos: v.recebido,
        aReceberCentavos: v.aReceber,
        percentualRecebido: total > 0 ? (v.recebido / total) * 100 : null,
      };
    })
    .sort((a, b) => b.recebidoCentavos - a.recebidoCentavos)
    .slice(0, 10);

  return { ...apuracao, temDados: true, contasAbertas, ranking, prefeituras, filtros: { cliente, de, ate } };
}

export type NotaPrefeituraDetalhe = {
  id: string;
  numero: string;
  serie: string | null;
  status: string;
  dataEmissao: string | null;
  clienteNome: string | null;
  linkDanfe: string | null;
  modoCusto: "ITENS" | "TOTAL";
  custoTotalInformadoCentavos: number | null;
  freteCentavos: number | null;
  /** Alíquota salva (ex.: 4). NULO = nunca informada (a tela sugere 4%). */
  impostoPercentual: number | null;
  receitaCentavos: number;
  itens: ItemNotaPrefeitura[];
};

/** Detalhe de uma nota da Prefeitura, para lançar os custos. */
export async function obterNotaPrefeitura(notaId: string): Promise<NotaPrefeituraDetalhe | null> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  if (!notaId) return null;

  const nota = (await contexto.prisma.notaFiscal.findUnique({
    where: { id: notaId },
    include: { itens: { orderBy: { ordem: "asc" } } },
  })) as unknown as NotaComItens | null;

  if (!nota || nota.segmento !== "PREFEITURA") return null;

  return {
    id: nota.id,
    numero: nota.numero,
    serie: nota.serie,
    status: nota.status,
    dataEmissao: nota.dataEmissao ? nota.dataEmissao.toISOString() : null,
    clienteNome: nota.clienteNome,
    linkDanfe: nota.linkDanfe,
    modoCusto: nota.modoCusto,
    custoTotalInformadoCentavos: centavosOuNulo(nota.custoTotalInformado),
    freteCentavos: centavosOuNulo(nota.freteInformado),
    impostoPercentual: nota.impostoPercentual === null || nota.impostoPercentual === undefined ? null : Number(nota.impostoPercentual),
    receitaCentavos: centavos(nota.valorTotal),
    itens: nota.itens.map((i) => {
      const venda = centavos(i.valorTotalVenda);
      const custo = centavosOuNulo(i.custoTotal);
      return {
        id: i.id,
        ordem: i.ordem,
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        valorUnitarioVendaCentavos: centavos(i.valorUnitarioVenda),
        valorTotalVendaCentavos: venda,
        custoCentavos: custo,
        lucroBrutoCentavos: custo === null ? null : venda - custo,
      };
    }),
  };
}

export type EntradaCustos = {
  notaId: string;
  modoCusto: "ITENS" | "TOTAL";
  custoTotalCentavos: number | null;
  freteCentavos: number | null;
  /** Alíquota em pontos percentuais (ex.: 4). NULO limpa o campo. */
  impostoPercentual: number | null;
  itens: Array<{ id: string; custoCentavos: number | null }>;
};

const paraDecimalOuNulo = (centavosValor: number | null): string | null =>
  centavosValor === null || !Number.isFinite(centavosValor) || centavosValor < 0 ? null : paraDecimal(Math.round(centavosValor));

// Alíquota (0–100) como string decimal "x.xx"; fora da faixa ou inválida → null.
const percentualOuNulo = (valor: number | null): string | null =>
  valor === null || !Number.isFinite(valor) || valor < 0 || valor > 100 ? null : valor.toFixed(2);

/** Salva o custo da nota: modo (itens/total), o total e/ou os custos por item. */
export async function salvarCustosDaNota(entrada: EntradaCustos): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.editar");
  if (!entrada?.notaId) return { ok: false, erro: "Nota inválida." };

  const nota = (await contexto.prisma.notaFiscal.findUnique({
    where: { id: entrada.notaId },
    select: { id: true, segmento: true },
  })) as { id: string; segmento: string | null } | null;
  if (!nota || nota.segmento !== "PREFEITURA") return { ok: false, erro: "Nota não encontrada no módulo Prefeitura." };

  const modoCusto = entrada.modoCusto === "TOTAL" ? "TOTAL" : "ITENS";

  try {
    await contexto.prisma.$transaction(async (tx) => {
      const trx = tx as unknown as {
        notaFiscal: { update: (args: unknown) => Promise<unknown> };
        notaFiscalItem: { updateMany: (args: unknown) => Promise<unknown> };
      };

      await trx.notaFiscal.update({
        where: { id: nota.id },
        data: {
          modoCusto,
          custoTotalInformado: modoCusto === "TOTAL" ? paraDecimalOuNulo(entrada.custoTotalCentavos) : undefined,
          freteInformado: paraDecimalOuNulo(entrada.freteCentavos),
          impostoPercentual: percentualOuNulo(entrada.impostoPercentual),
        },
      });

      // Só itens desta nota (o where com notaFiscalId impede editar item alheio).
      for (const item of entrada.itens ?? []) {
        await trx.notaFiscalItem.updateMany({
          where: { id: item.id, notaFiscalId: nota.id },
          data: { custoTotal: paraDecimalOuNulo(item.custoCentavos) },
        });
      }
    });

    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:salvarCustosDaNota`), {
      acao: ACOES_AUDITORIA.ATUALIZAR_CUSTO_NOTA,
      entidade: ENTIDADES_AUDITORIA.NOTA_FISCAL,
      entidadeId: nota.id,
      dadosDepois: { modoCusto },
    });

    revalidatePath("/prefeitura");
    revalidatePath(`/prefeitura/${nota.id}`);
    return { ok: true };
  } catch (erro) {
    console.error("[prefeitura] falha ao salvar custos", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível salvar os custos agora. Tente de novo." };
  }
}

/** Ajuste manual: marca ou desmarca uma nota como Prefeitura (trava a detecção automática). */
export async function definirSegmentoPrefeitura(notaId: string, ehPrefeitura: boolean): Promise<{ ok: boolean; erro?: string }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.editar");
  if (!notaId) return { ok: false, erro: "Nota inválida." };

  try {
    await contexto.prisma.notaFiscal.update({
      where: { id: notaId },
      data: { segmento: ehPrefeitura ? "PREFEITURA" : null, segmentoManual: true },
    });

    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:definirSegmentoPrefeitura`), {
      acao: ACOES_AUDITORIA.DEFINIR_SEGMENTO_NOTA,
      entidade: ENTIDADES_AUDITORIA.NOTA_FISCAL,
      entidadeId: notaId,
      dadosDepois: { segmento: ehPrefeitura ? "PREFEITURA" : null, manual: true },
    });

    revalidatePath("/prefeitura");
    revalidatePath("/financeiro/notas-fiscais");
    return { ok: true };
  } catch (erro) {
    console.error("[prefeitura] falha ao definir segmento", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível alterar a nota agora. Tente de novo." };
  }
}
