"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { deDecimal, paraDecimal } from "@/lib/dinheiro";
import { apurarNota, apurarPeriodo, type ApuracaoPeriodo, type NotaApuracao } from "@/lib/dominio/prefeitura/apuracao";

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

export type PainelPrefeitura = {
  periodo: ApuracaoPeriodo;
  notas: ResumoNotaPrefeitura[];
};

/** Carrega o painel da Prefeitura: KPIs do período + as notas com apuração. */
export async function obterPainelPrefeitura(): Promise<PainelPrefeitura> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  const notas = (await contexto.prisma.notaFiscal.findMany({
    where: { segmento: "PREFEITURA" },
    orderBy: { dataEmissao: "desc" },
    include: { itens: { orderBy: { ordem: "asc" } } },
  })) as unknown as NotaComItens[];

  return {
    periodo: apurarPeriodo(notas.map(paraApuracao)),
    notas: notas.map(resumir),
  };
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
  itens: Array<{ id: string; custoCentavos: number | null }>;
};

const paraDecimalOuNulo = (centavosValor: number | null): string | null =>
  centavosValor === null || !Number.isFinite(centavosValor) || centavosValor < 0 ? null : paraDecimal(Math.round(centavosValor));

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
