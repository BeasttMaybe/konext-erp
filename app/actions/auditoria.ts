"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";

export type ItemAuditoriaLegado = {
  categoria: string;
  total: number;
  ids: string[];
};

export type RelatorioAuditoriaLegado = {
  geradoEm: string;
  inconsistencias: ItemAuditoriaLegado[];
};

export type SnapshotPreSaneamento = {
  idLogAuditoria: string;
  geradoEm: string;
  resumo: {
    totalOrdensServico: number;
    totalOrdensServicoExcluidas: number;
    totalContasReceber: number;
    totalParcelasDespesa: number;
    totalMetasAtivas: number;
    totalRetornosGarantia: number;
  };
};

function limitarIds(ids: string[], limite = 200): string[] {
  return ids.slice(0, limite);
}

function textoAusente(valor: unknown): boolean {
  return valor == null || (typeof valor === "string" && valor.trim().length === 0);
}

export async function auditarDadosLegados(): Promise<RelatorioAuditoriaLegado> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "auditoria.ver");
  const prisma = contexto.prisma;

  const [
    ordensServico,
    ordensEntreguesSemArquivo,
    contasReceber,
    parcelasComValorInvalido,
    metas,
    retornosSemOsRetorno,
  ] = await Promise.all([
    prisma.ordemServico.findMany({
      select: { id: true, clienteId: true, relatoCliente: true },
      take: 500,
      orderBy: { criadoEm: "desc" },
    }),
    prisma.ordemServico.findMany({
      where: {
        status: "ENTREGUE",
        archivedAt: null,
        excluidaEm: null,
      },
      select: { id: true },
      take: 500,
      orderBy: { atualizadoEm: "desc" },
    }),
    prisma.contaReceber.findMany({
      select: { id: true, descricao: true },
      take: 500,
      orderBy: { criadoEm: "desc" },
    }),
    prisma.parcelaDespesa.findMany({
      where: {
        OR: [{ valor: { lte: 0 } }, { numeroParcela: { lte: 0 } }],
      },
      select: { id: true },
      take: 500,
      orderBy: { criadoEm: "desc" },
    }),
    prisma.meta.findMany({
      where: {
        excluidaEm: null,
      },
      select: { id: true, titulo: true },
      take: 500,
      orderBy: { criadoEm: "desc" },
    }),
    prisma.retornoGarantiaOS.findMany({
      where: {
        osRetornoId: null,
      },
      select: { id: true },
      take: 500,
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const ordensSemCliente = ordensServico.filter((item) => textoAusente(item.clienteId));
  const ordensSemRelato = ordensServico.filter((item) => textoAusente(item.relatoCliente));
  const contasReceberSemDescricao = contasReceber.filter((item) => textoAusente(item.descricao));
  const metasSemTitulo = metas.filter((item) => textoAusente(item.titulo));

  const inconsistencias: ItemAuditoriaLegado[] = [
    {
      categoria: "OS sem cliente",
      total: ordensSemCliente.length,
      ids: limitarIds(ordensSemCliente.map((item) => item.id)),
    },
    {
      categoria: "OS sem relato do cliente",
      total: ordensSemRelato.length,
      ids: limitarIds(ordensSemRelato.map((item) => item.id)),
    },
    {
      categoria: "OS entregue sem arquivamento",
      total: ordensEntreguesSemArquivo.length,
      ids: limitarIds(ordensEntreguesSemArquivo.map((item) => item.id)),
    },
    {
      categoria: "Contas a receber sem descricao",
      total: contasReceberSemDescricao.length,
      ids: limitarIds(contasReceberSemDescricao.map((item) => item.id)),
    },
    {
      categoria: "Parcelas de despesa com valor ou numero invalido",
      total: parcelasComValorInvalido.length,
      ids: limitarIds(parcelasComValorInvalido.map((item) => item.id)),
    },
    {
      categoria: "Metas ativas sem titulo",
      total: metasSemTitulo.length,
      ids: limitarIds(metasSemTitulo.map((item) => item.id)),
    },
    {
      categoria: "Retornos de garantia sem OS de retorno",
      total: retornosSemOsRetorno.length,
      ids: limitarIds(retornosSemOsRetorno.map((item) => item.id)),
    },
  ];

  return {
    geradoEm: new Date().toISOString(),
    inconsistencias,
  };
}

export async function gerarSnapshotPreSaneamento(): Promise<SnapshotPreSaneamento> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "auditoria.ver");
  const prisma = contexto.prisma;
  const usuarioOperacionalId = String(contexto.usuarioOperacional.id ?? "").trim() || null;

  const [
    totalOrdensServico,
    totalOrdensServicoExcluidas,
    totalContasReceber,
    totalParcelasDespesa,
    totalMetasAtivas,
    totalRetornosGarantia,
  ] = await Promise.all([
    prisma.ordemServico.count({}),
    prisma.ordemServico.count({ where: { excluidaEm: { not: null } } }),
    prisma.contaReceber.count({}),
    prisma.parcelaDespesa.count({}),
    prisma.meta.count({ where: { excluidaEm: null } }),
    prisma.retornoGarantiaOS.count({}),
  ]);

  const resumo = {
    totalOrdensServico,
    totalOrdensServicoExcluidas,
    totalContasReceber,
    totalParcelasDespesa,
    totalMetasAtivas,
    totalRetornosGarantia,
  };

  const logAuditoria = await prisma.$transaction(async (tx) => {
    return registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(
        usuarioOperacionalId ? { id: usuarioOperacionalId } : null,
        "app/actions/auditoria.ts:gerarSnapshotPreSaneamento"
      ),
      {
        acao: ACOES_AUDITORIA.SNAPSHOT_PRE_SANEAMENTO,
        entidade: ENTIDADES_AUDITORIA.SISTEMA,
        entidadeId: "pre-saneamento",
        dadosDepois: resumo,
        motivo: "Snapshot gerado antes de qualquer saneamento/correcao de legado.",
      }
    );
  });

  return {
    idLogAuditoria: logAuditoria.id,
    geradoEm: new Date().toISOString(),
    resumo,
  };
}
