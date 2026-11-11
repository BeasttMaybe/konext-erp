"use server";

import { CHAMADA_INTERNA } from "@/lib/auth/chamada-interna";
import { revalidatePath } from "next/cache";
import type { StatusOS, TipoPeca } from "@prisma/client";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import {
  descreverAutoria,
  normalizarIdUsuarioOperacional,
} from "@/lib/tenant/usuario-operacional";
// Importação de calcularPrecoVendaPeca removida — preços são definidos manualmente pelo operador.
import { garantirTermoGarantiaPorOS } from "@/app/actions/garantias";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import {
  mensagemIndicaRuntimeLegadoConfiguracao,
  obterDefaultsConfiguracaoOsGarantias,
} from "@/lib/configuracoes-os-garantias";
import type { OrdemServico, OrdemServicoExcluida, TipoPecaOrcamento } from "@/types/os";
import {
  ROTULOS_ETAPA_OS,
  ROTULOS_SITUACAO_OS,
  STATUS_OS_SEQUENCIA,
  ehEtapaOS,
  motivoTransicaoNegadaEtapa,
} from "@/lib/dominio/os/maquina-estados";
import { normalizarSituacao, paraEstagio, paraStatusLegado, type EtapaOS, type SituacaoOS } from "@/lib/dominio/os/etapas";
import { encontrarEntregaAuditada } from "@/lib/dominio/os/entrega-auditada";
import { ErroPermissao, exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { escopoOrdemServico } from "@/lib/auth/escopos";
import { ID_CLIENTE_CONSUMIDOR_FINAL, ehClienteConsumidorFinal } from "@/lib/dominio/crm/consumidor-final";
import {
  avaliarFinalizacao,
  avaliarFinalizacaoSemServico,
  resumirPendencias,
  type PendenciaFinalizacao,
  type RegrasConfiguracaoFinalizacao,
} from "@/lib/dominio/os/regras-finalizacao";
import { ErroNegocio, paraMensagemSegura } from "@/lib/erros";
import {
  deDecimal,
  type EntradaDecimal,
  lerEntradaMonetaria,
  paraDecimal,
  paraMoeda,
  somar,
} from "@/lib/dinheiro";

type PrismaTenant = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

type ItemEntrada = {
  tipo: TipoPeca;
  descricao: string;
  // `number | string` porque e isso que chega do formulario: um
  // `input[type=number]` manda string, e a mascara de moeda manda pt-BR.
  // `lerEntradaMonetaria` resolve os dois.
  custoPeca: number | string;
  valorCobrado?: number | string;
};

type DadosNovaOS = {
  clienteId: string;
  equipamento: string;
  marca?: string;
  modelo?: string;
  imei?: string;
  senha?: string;
  senhaDesenho?: string;
  relatoCliente: string;
  condicaoFisica?: string;
  acessorios?: string;
  status: StatusOS;
  observacoesInternas?: string;
  itensOrcamento?: ItemEntrada[];
};

type RawItemOS = {
  id?: unknown;
  tipoPeca?: unknown;
  tipo?: unknown;
  descricao?: unknown;
  custoPeca?: unknown;
  valorCobrado?: unknown;
};

type RawOrdemServico = {
  id?: unknown;
  numeroOs?: unknown;
  clienteId?: unknown;
  cliente?: { nomeRazaoSocial?: unknown } | null;
  equipamento?: unknown;
  marca?: unknown;
  modelo?: unknown;
  imei?: unknown;
  senha?: unknown;
  senhaDesenho?: unknown;
  relatoCliente?: unknown;
  condicaoFisica?: unknown;
  acessorios?: unknown;
  status?: unknown;
  etapa?: unknown;
  situacao?: unknown;
  ehRetornoGarantia?: unknown;
  osOrigemGarantiaId?: unknown;
  osOrigemGarantia?: { numeroOs?: unknown } | null;
  retornoGarantiaId?: unknown;
  retornoGarantia?: { finalizadoEm?: unknown } | null;
  observacoes?: unknown;
  archivedAt?: unknown;
  entregueSemServico?: unknown;
  motivoSemServico?: unknown;
  excluidaEm?: unknown;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
  itens?: RawItemOS[];
  tecnicos?: RawTecnicoOS[];
};

type RawTecnicoOS = {
  usuarioId?: unknown;
  participacaoPercentual?: unknown;
  principal?: unknown;
  usuario?: { nome?: unknown } | null;
};

export type DadosDashboardOS = {
  ordensAtivas: OrdemServico[];
  ordensArquivadas: OrdemServico[];
  ordensExcluidas: OrdemServicoExcluida[];
};

function formatarNumeroOS(numero: number): string {
  return `OS-${String(new Date().getFullYear())}-${String(numero).padStart(3, "0")}`;
}

function normalizarDataISO(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString();

  if (typeof valor === "string" || typeof valor === "number") {
    const data = new Date(valor);
    if (!Number.isNaN(data.getTime())) return data.toISOString();
  }

  return new Date().toISOString();
}

function mapearOrdemServicoDashboard(order: RawOrdemServico, podeVerCustos: boolean): OrdemServico {
  const itensOrcamento = (order.itens ?? []).map((item) => ({
    id: String(item.id),
    tipo: String(item.tipoPeca ?? item.tipo ?? "OUTROS") as TipoPecaOrcamento,
    descricao: String(item.descricao ?? ""),
    // F-41: custo/margem só vai para o cliente com os.ver_custos. Omitido no
    // mapeamento do servidor — nunca filtrado na UI.
    custoPeca: podeVerCustos ? paraMoeda(deDecimal(item.custoPeca as EntradaDecimal ?? 0)) : null,
    valorCobrado: paraMoeda(deDecimal(item.valorCobrado as EntradaDecimal ?? 0)),
  }));

  const totalOrcamento = paraMoeda(somar(...itensOrcamento.map((item) => deDecimal(item.valorCobrado))));

  return {
    id: String(order.id),
    numeroOS: formatarNumeroOS(Number(order.numeroOs ?? 0)),
    clienteId: String(order.clienteId),
    nomeCliente: String(order.cliente?.nomeRazaoSocial ?? "Cliente nao informado"),
    equipamento: String(order.equipamento ?? "Nao informado"),
    marca: order.marca ? String(order.marca) : undefined,
    modelo: order.modelo ? String(order.modelo) : undefined,
    imei: order.imei ? String(order.imei) : undefined,
    senha: order.senha ? String(order.senha) : undefined,
    senhaDesenho: order.senhaDesenho ? String(order.senhaDesenho) : undefined,
    checklist: {
      relatoCliente: String(order.relatoCliente ?? ""),
      condicaoFisica: String(order.condicaoFisica ?? ""),
      acessorios: String(order.acessorios ?? ""),
    },
    itensOrcamento,
    totalOrcamento,
    status: String(order.status) as StatusOS,
    etapa: String(order.etapa) as EtapaOS,
    situacao: order.situacao ? (String(order.situacao) as SituacaoOS) : null,
    ehRetornoGarantia: Boolean(order.ehRetornoGarantia),
    osOrigemGarantiaId: order.osOrigemGarantiaId ? String(order.osOrigemGarantiaId) : undefined,
    numeroOSOrigemGarantia:
      order.osOrigemGarantia?.numeroOs !== undefined && order.osOrigemGarantia?.numeroOs !== null
        ? formatarNumeroOS(Number(order.osOrigemGarantia.numeroOs))
        : undefined,
    retornoGarantiaId: order.retornoGarantiaId ? String(order.retornoGarantiaId) : undefined,
    retornoGarantiaFinalizadoEm: order.retornoGarantia?.finalizadoEm
      ? normalizarDataISO(order.retornoGarantia.finalizadoEm)
      : undefined,
    observacoesInternas: order.observacoes ? String(order.observacoes) : undefined,
    entregueSemServico: Boolean(order.entregueSemServico),
    motivoSemServico: order.motivoSemServico ? String(order.motivoSemServico) : undefined,
    archivedAt: order.archivedAt ? normalizarDataISO(order.archivedAt) : null,
    tecnicos: (order.tecnicos ?? []).map((tecnico) => ({
      usuarioId: String(tecnico.usuarioId),
      nome: String(tecnico.usuario?.nome ?? "Técnico"),
      participacaoPercentual: Number(tecnico.participacaoPercentual ?? 0),
      principal: Boolean(tecnico.principal),
    })),
    dataCriacao: normalizarDataISO(order.criadoEm),
    dataAtualizacao: normalizarDataISO(order.atualizadoEm),
  };
}

export type ClienteBuscaOS = {
  id: string;
  nomeRazaoSocial: string;
  documento: string;
  telefone: string;
};

type OrdemServicoCreateDelegate = {
  create?: (args: unknown) => Promise<{ id: string }>;
};

type ItemOSCreateManyDelegate = {
  createMany?: (args: unknown) => Promise<unknown>;
};

type OrdemServicoPedidoItem = {
  valorCobrado?: EntradaDecimal | null;
};

type OrdemServicoPedido = {
  id: string;
  clienteId: string;
  status?: string | null;
  numeroOs?: number | null;
  itens?: OrdemServicoPedidoItem[];
};

type OrdemServicoPedidoDelegate = {
  findUnique?: (args: unknown) => Promise<OrdemServicoPedido | null>;
};

type ContaReceberPedidoDelegate = {
  findFirst?: (args: unknown) => Promise<{ vendaId?: string | null } | null>;
};

type VendaCreateDelegate = {
  create?: (args: unknown) => Promise<{ id: string }>;
};

type ContaReceberCreateDelegate = {
  create?: (args: unknown) => Promise<unknown>;
};

// Lista de status vem do dominio (fonte unica de verdade).
const statusValidos: readonly StatusOS[] = STATUS_OS_SEQUENCIA;


/**
 * Invalidacao de cache das telas afetadas por uma OS.
 * Centralizada porque as acoes repetiam listas ligeiramente diferentes — e uma
 * delas apontava para "/dashboard", rota que nao existe: o dashboard e "/"
 * (AUDIT_REPORT F-65).
 */
function revalidarOrdemServico(osId: string): void {
  revalidatePath("/");
  revalidatePath("/os");
  revalidatePath(`/os/${osId}`);
  revalidatePath(`/os/${osId}/garantia`);
  revalidatePath("/financeiro");
}

type RegrasOs = {
  exigirGarantiaAntesEntrega: boolean;
  exigirDiagnosticoParaFinalizar: boolean;
  permitirFinalizarSemPagamento: boolean;
};

async function obterRegrasOs(prisma: PrismaTenant): Promise<RegrasOs> {
  const defaults = obterDefaultsConfiguracaoOsGarantias();
  let configuracao: {
    exigirGarantiaAntesEntrega?: boolean | null;
    exigirDiagnosticoParaFinalizar?: boolean | null;
    permitirFinalizarSemPagamento?: boolean | null;
  } | null = null;

  try {
    configuracao = await prisma.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: {
        exigirGarantiaAntesEntrega: true,
        exigirDiagnosticoParaFinalizar: true,
        permitirFinalizarSemPagamento: true,
      },
    });
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }
    try {
      const rows = await prisma.$queryRaw<Array<{
        exigirGarantiaAntesEntrega: boolean | null;
        exigirDiagnosticoParaFinalizar: boolean | null;
        permitirFinalizarSemPagamento: boolean | null;
      }>>`
        SELECT "exigirGarantiaAntesEntrega", "exigirDiagnosticoParaFinalizar", "permitirFinalizarSemPagamento"
        FROM "Configuracao" ORDER BY "criadoEm" ASC LIMIT 1
      `;
      configuracao = rows[0] ?? null;
    } catch {
      // mantém null → defaults
    }
  }

  return {
    exigirGarantiaAntesEntrega:
      typeof configuracao?.exigirGarantiaAntesEntrega === "boolean"
        ? Boolean(configuracao.exigirGarantiaAntesEntrega)
        : defaults.exigirGarantiaAntesEntrega,
    exigirDiagnosticoParaFinalizar:
      typeof configuracao?.exigirDiagnosticoParaFinalizar === "boolean"
        ? Boolean(configuracao.exigirDiagnosticoParaFinalizar)
        : defaults.exigirDiagnosticoParaFinalizar,
    permitirFinalizarSemPagamento:
      typeof configuracao?.permitirFinalizarSemPagamento === "boolean"
        ? Boolean(configuracao.permitirFinalizarSemPagamento)
        : defaults.permitirFinalizarSemPagamento,
  };
}

async function osPossuiPagamentoConfirmado(prisma: PrismaTenant, osId: string): Promise<boolean> {
  const totalConfirmado = await prisma.contaReceber.count({
    where: {
      ordemServicoId: osId,
      status: {
        in: ["PAGO", "RECEBIDO"],
      },
    },
  });

  return totalConfirmado > 0;
}

function archivedAtUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.includes("archivedAt") || message.includes("Unknown argument") || message.includes("Invalid `ordemServico");
}

export async function buscarClientesOS(termoBusca: string): Promise<ClienteBuscaOS[]> {
  const { prisma } = await exigirContextoTenant();
  const termo = termoBusca.trim();

  if (termo.length < 2) {
    return [];
  }

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const clienteDelegate = prismaAny.cliente ?? prismaAny.Cliente;

  if (!clienteDelegate?.findMany) {
    throw new Error("Delegate Prisma de Cliente nao disponivel.");
  }

  const clientes = await clienteDelegate.findMany({
    where: {
      papel: "CLIENTE",
      // Consumidor Final e automatico do sistema e nunca pode ser o cliente
      // de uma OS (criarOrdemServico tem a mesma trava) — nao faz sentido
      // aparecer como opcao de busca aqui.
      id: { not: ID_CLIENTE_CONSUMIDOR_FINAL },
      OR: [
        {
          nomeRazaoSocial: {
            contains: termo,
            mode: "insensitive",
          },
        },
        {
          documento: {
            contains: termo,
            mode: "insensitive",
          },
        },
        {
          telefone: {
            contains: termo,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      nomeRazaoSocial: true,
      documento: true,
      telefone: true,
    },
    orderBy: {
      nomeRazaoSocial: "asc",
    },
    take: 15,
  });

  return clientes.map((cliente: { id: string; nomeRazaoSocial: string; documento: string | null; telefone: string }) => ({
    id: String(cliente.id),
    nomeRazaoSocial: String(cliente.nomeRazaoSocial),
    // `String(null)` e a palavra "null" -- apareceria escrita na tela.
    documento: cliente.documento ? String(cliente.documento) : "",
    telefone: String(cliente.telefone),
  }));
}

/**
 * Retorna os dados de um cliente pelo ID.
 * Usado para pré-preencher o seletor de cliente na OS quando o clienteId vem via URL.
 */
export async function buscarClientePorId(clienteId: string): Promise<ClienteBuscaOS | null> {
  if (!clienteId) return null;

  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const clienteDelegate = prismaAny.cliente ?? prismaAny.Cliente;

  if (!clienteDelegate?.findFirst) return null;

  if (ehClienteConsumidorFinal(clienteId)) return null;

  const cliente = await clienteDelegate.findFirst({
    where: { id: clienteId, papel: "CLIENTE" },
    select: { id: true, nomeRazaoSocial: true, documento: true, telefone: true },
  });

  if (!cliente) return null;

  return {
    id: String(cliente.id),
    nomeRazaoSocial: String(cliente.nomeRazaoSocial),
    // `String(null)` e a palavra "null" -- apareceria escrita na tela.
    documento: cliente.documento ? String(cliente.documento) : "",
    telefone: String(cliente.telefone),
  };
}

export async function obterDadosDashboardOS(): Promise<DadosDashboardOS> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  const podeVerCustos = temPermissao(contexto, "os.ver_custos");
  // Escopo de visibilidade (Fase 1D-2): sem os.ver_todas, so OS criadas pelo
  // usuario ou em que ele aparece como tecnico — ver lib/auth/escopos.ts.
  // Vale pro quadro, pra lista de finalizadas e pros contadores do topo, que
  // sao todos derivados do que esta funcao devolve.
  const escopoOS = escopoOrdemServico(contexto);

  const prismaAny = prisma as unknown as Record<string, unknown>;
  const ordemServicoDelegate =
    (prismaAny.ordemServico as { findMany?: (args: unknown) => Promise<RawOrdemServico[]> } | undefined) ??
    (prismaAny.OrdemServico as { findMany?: (args: unknown) => Promise<RawOrdemServico[]> } | undefined);

  if (!ordemServicoDelegate?.findMany) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  const includeOrderRelations = {
    cliente: {
      select: {
        id: true,
        nomeRazaoSocial: true,
      },
    },
    itens: true,
    osOrigemGarantia: {
      select: {
        numeroOs: true,
      },
    },
    retornoGarantia: {
      select: {
        finalizadoEm: true,
      },
    },
    tecnicos: {
      select: {
        usuarioId: true,
        participacaoPercentual: true,
        principal: true,
        usuario: { select: { nome: true } },
      },
    },
  };

  let ordensAtivasBrutas: RawOrdemServico[] = [];
  let ordensArquivadasBrutas: RawOrdemServico[] = [];
  let ordensExcluidas: OrdemServicoExcluida[] = [];

  try {
    const [ativas, arquivadas, excluidas] = await Promise.all([
      ordemServicoDelegate.findMany({
        where: {
          archivedAt: null,
          excluidaEm: null,
          ...escopoOS,
        },
        include: includeOrderRelations,
        orderBy: {
          criadoEm: "desc",
        },
      }),
      ordemServicoDelegate.findMany({
        // "Finalizadas e Entregues" e SO o que esta de fato completo: ENTREGUE
        // *e* arquivada. Uma OS ENTREGUE sem archivedAt (o caso de "resgate")
        // nao e finalizada — ela continua no quadro, coluna Entregue, onde a
        // acao "Arquivar OS" da Parte 1 vive. Listar como "finalizada" uma OS
        // que ainda precisa ser arquivada foi o erro corrigido na Parte 4.
        where: {
          status: "ENTREGUE",
          archivedAt: {
            not: null,
          },
          excluidaEm: null,
          ...escopoOS,
        },
        include: includeOrderRelations,
        orderBy: {
          atualizadoEm: "desc",
        },
      }),
      listarOrdensServicoExcluidas(),
    ]);

    ordensAtivasBrutas = ativas;
    ordensArquivadasBrutas = arquivadas;
    ordensExcluidas = excluidas.map((item) => ({
      id: item.id,
      numeroOS: formatarNumeroOS(item.numeroOs),
      nomeCliente: item.clienteNome,
      equipamento: item.equipamento,
      totalOrcamento: item.totalOrcamento,
      statusAnterior: item.statusAnterior.replaceAll("_", " "),
      excluidaPor: item.excluidaPorNome,
      motivoExclusao: item.motivoExclusao,
      excluidaEm: item.excluidaEm.toISOString(),
    }));
  } catch (error) {
    if (!archivedAtUnsupported(error)) {
      throw error;
    }

    const [todasOrdens, archiveRows, excluidas] = await Promise.all([
      ordemServicoDelegate.findMany({
        where: escopoOS,
        include: includeOrderRelations,
        orderBy: {
          criadoEm: "desc",
        },
      }),
      prisma.$queryRaw<Array<{ id: string; archivedAt: Date | null }>>`
        SELECT id, "archivedAt"
        FROM "OrdemServico"
      `,
      listarOrdensServicoExcluidas(),
    ]);

    const archivedIds = new Set(
      archiveRows.filter((row) => row.archivedAt !== null).map((row) => String(row.id))
    );

    ordensAtivasBrutas = todasOrdens.filter(
      (order) => !archivedIds.has(String(order.id)) && !order.excluidaEm
    );
    ordensArquivadasBrutas = todasOrdens.filter(
      (order) => archivedIds.has(String(order.id)) && !order.excluidaEm
    );
    ordensExcluidas = excluidas.map((item) => ({
      id: item.id,
      numeroOS: formatarNumeroOS(item.numeroOs),
      nomeCliente: item.clienteNome,
      equipamento: item.equipamento,
      totalOrcamento: item.totalOrcamento,
      statusAnterior: item.statusAnterior.replaceAll("_", " "),
      excluidaPor: item.excluidaPorNome,
      motivoExclusao: item.motivoExclusao,
      excluidaEm: item.excluidaEm.toISOString(),
    }));
  }

  return {
    // Wrapper em arrow function de proposito: `mapearOrdemServicoDashboard`
    // passado direto para `.map` receberia o INDICE como segundo argumento
    // (`podeVerCustos`), que e truthy a partir do indice 1 — vazaria custo
    // para todo item exceto o primeiro de cada lista.
    ordensAtivas: ordensAtivasBrutas.map((ordem) => mapearOrdemServicoDashboard(ordem, podeVerCustos)),
    ordensArquivadas: ordensArquivadasBrutas.map((ordem) => mapearOrdemServicoDashboard(ordem, podeVerCustos)),
    ordensExcluidas,
  };
}

export async function criarOrdemServico(dados: DadosNovaOS) {
  // C1: rejeita chamadas nao autenticadas diretamente no backend.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "os.criar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  if (!dados?.clienteId) {
    throw new Error("Selecione um cliente para criar a ordem de servico.");
  }

  if (ehClienteConsumidorFinal(dados.clienteId)) {
    throw new Error("O cliente Consumidor Final é automático do sistema e não pode ser vinculado a uma Ordem de Serviço.");
  }

  if (!dados?.equipamento?.trim()) {
    throw new Error("Informe o equipamento da ordem de servico.");
  }

  if (!dados?.relatoCliente?.trim()) {
    throw new Error("Informe o relato do cliente para criar a ordem de servico.");
  }

  if (!statusValidos.includes(dados.status)) {
    throw new Error("Status da ordem de servico invalido.");
  }

  const cliente = await prisma.cliente.findFirst({
    where: {
      id: dados.clienteId,
      papel: "CLIENTE",
    },
    select: {
      id: true,
    },
  });

  if (!cliente) {
    throw new Error("Cliente nao encontrado para criar a ordem de servico.");
  }

  const itensTratados = (dados.itensOrcamento ?? [])
    .map((item) => {
      const descricao = String(item.descricao ?? "").trim();
      // Fase 2A-3: `lerEntradaMonetaria` no lugar do `Number()` local, que
      // lia "1.234,56" como NaN e devolvia 0 — o item nascia sem custo. Aqui
      // um valor invalido descarta o item, que era o comportamento (o
      // `.filter` abaixo tira os `null`), mas agora por nao ser numero, e nao
      // por ter virado zero.
      const custoPecaCentavos = lerEntradaMonetaria(item.custoPeca ?? 0);
      const valorCobradoCentavos = lerEntradaMonetaria(item.valorCobrado);

      if (!descricao) return null;
      if (custoPecaCentavos === null || custoPecaCentavos < 0) return null;

      // Valor cobrado ao cliente: sempre o informado manualmente, sem markup automático.
      if (valorCobradoCentavos === null || valorCobradoCentavos <= 0) return null;

      return {
        descricao,
        tipoPeca: item.tipo,
        // String de `paraDecimal`: Decimal(12,2) recebe o valor sem passar
        // por ponto flutuante outra vez.
        custoPeca: paraDecimal(custoPecaCentavos),
        valorCobrado: paraDecimal(valorCobradoCentavos),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoCreateDelegate;
    OrdemServico?: OrdemServicoCreateDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.create) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  const novaOS = await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & {
      ordemServico?: OrdemServicoCreateDelegate;
      OrdemServico?: OrdemServicoCreateDelegate;
      itemOS?: ItemOSCreateManyDelegate;
      ItemOS?: ItemOSCreateManyDelegate;
    };
    const txOrdemServico = txAny.ordemServico ?? txAny.OrdemServico;
    const txItemOS = txAny.itemOS ?? txAny.ItemOS;

    // Escrita dupla (Fase 1C-3): a OS ainda nasce a partir de um StatusOS
    // escolhido pela UI legada — etapa/situacao sao derivados dele com a
    // mesma funcao usada em toda a aplicacao (lib/dominio/os/etapas.ts).
    const estagioInicial = paraEstagio(dados.status);

    const ordemCriada = await txOrdemServico.create({
      data: {
        clienteId: dados.clienteId,
        equipamento: dados.equipamento.trim(),
        marca: dados.marca?.trim() || null,
        modelo: dados.modelo?.trim() || null,
        imei: dados.imei?.trim() || null,
        senha: dados.senha?.trim() || null,
        senhaDesenho: dados.senhaDesenho?.trim() || null,
        relatoCliente: dados.relatoCliente.trim(),
        condicaoFisica: dados.condicaoFisica?.trim() || null,
        acessorios: dados.acessorios?.trim() || null,
        status: dados.status,
        etapa: estagioInicial.etapa,
        situacao: estagioInicial.situacao,
        observacoes: dados.observacoesInternas?.trim() || null,
        // Fase 1D-2: fonte de "OS que eu criei" pra quem nao tem os.ver_todas — ver lib/auth/escopos.ts.
        criadoPorId: usuario.id || null,
      },
      select: {
        id: true,
      },
    });

    if (itensTratados.length > 0 && txItemOS?.createMany) {
      await txItemOS.createMany({
        data: itensTratados.map((item) => ({
          osId: ordemCriada.id,
          descricao: item.descricao,
          tipoPeca: item.tipoPeca,
          custoPeca: item.custoPeca,
          valorCobrado: item.valorCobrado,
        })),
      });
    }

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/os.ts:criarOrdemServico"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: ordemCriada.id,
        dadosDepois: {
          clienteId: dados.clienteId,
          equipamento: dados.equipamento,
          marca: dados.marca,
          modelo: dados.modelo,
          imei: dados.imei,
          senha: dados.senha,
          senhaDesenho: dados.senhaDesenho,
          relatoCliente: dados.relatoCliente,
          condicaoFisica: dados.condicaoFisica,
          acessorios: dados.acessorios,
          status: dados.status,
          observacoesInternas: dados.observacoesInternas,
          itensOrcamento: itensTratados,
        },
      }
    );

    return ordemCriada;
  });

  revalidatePath("/os");
  revalidatePath(`/os/${novaOS.id}`);
  revalidatePath("/");

  return novaOS;
}

const STATUS_NOTIFICAVEIS: Readonly<Record<string, { titulo: string; mensagem: (n: number) => string }>> = {
  APROVADO: {
    titulo: "OS Aprovada",
    mensagem: (n) => `A OS #${n} foi aprovada pelo cliente e pode seguir para a manutenção.`,
  },
  AGUARDANDO_PECA: {
    titulo: "OS Aguardando Peça",
    mensagem: (n) => `A OS #${n} está aguardando chegada de peça para prosseguir.`,
  },
  EM_MANUTENCAO: {
    titulo: "OS em Manutenção",
    mensagem: (n) => `A OS #${n} está em manutenção pelo técnico.`,
  },
  GARANTIA_RETORNO: {
    titulo: "OS em Garantia",
    mensagem: (n) => `A OS #${n} entrou em fluxo de retorno de garantia.`,
  },
  PRONTO: {
    titulo: "OS Pronta para Retirada",
    mensagem: (n) => `A OS #${n} foi concluída e está pronta para retirada pelo cliente.`,
  },
  ENTREGUE: {
    titulo: "OS Entregue",
    mensagem: (n) => `A OS #${n} foi entregue ao cliente com sucesso.`,
  },
};

/**
 * Notificacao best-effort, FORA da transacao de negocio: ela nunca deve
 * derrubar uma mudanca de status valida. A falha e registrada com console.error
 * em vez de engolida em silencio.
 */
async function notificarMudancaStatusOS(
  prisma: PrismaTenant,
  status: StatusOS,
  numeroOs: number
): Promise<void> {
  const configuracao = STATUS_NOTIFICAVEIS[status];

  if (!configuracao) {
    return;
  }

  try {
    await prisma.notificacao.create({
      data: {
        titulo: configuracao.titulo,
        mensagem: configuracao.mensagem(numeroOs),
      },
    });
  } catch (erro) {
    console.error("[os] falha ao criar notificacao de mudanca de status", {
      status,
      numeroOs,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
  }
}

export type ResultadoAtualizacaoEtapaOrdemServico =
  | {
      sucesso: true;
      mensagem: string;
      osId: string;
      etapa: EtapaOS;
      situacao: SituacaoOS | null;
    }
  | {
      sucesso: false;
      erro: string;
      bloqueioRegra: boolean;
    };

/**
 * Mudanca generica de ETAPA (Fase 1C-3) — a acao viva do Kanban de 4
 * colunas. Substitui `atualizarStatusOrdemServico` como caminho de escrita
 * do quadro; a maquina de estados que decide o que e alcancavel agora e
 * `motivoTransicaoNegadaEtapa`, nao mais a de StatusOS.
 *
 * Mudar de etapa sempre zera `situacao` (ela e independente da etapa, mas
 * nao sobrevive a troca — ver lib/dominio/os/etapas.ts). Quem quiser
 * marcar/desmarcar uma situacao sem mover o card usa
 * `atualizarSituacaoOrdemServico`.
 *
 * As mesmas duas transicoes de sempre ficam de fora, tratadas por acoes
 * dedicadas: qualquer -> ENTREGUE (`finalizarOrdemServico`/
 * `finalizarSemServico`) e ENTREGUE -> qualquer (`reabrirOrdemServico`).
 */
export async function atualizarEtapaOrdemServico(
  osId: string,
  etapa: EtapaOS
): Promise<ResultadoAtualizacaoEtapaOrdemServico> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    if (!osId) {
      return { sucesso: false, erro: "ID da ordem de servico nao informado.", bloqueioRegra: true };
    }

    if (!ehEtapaOS(etapa)) {
      return { sucesso: false, erro: "Etapa da ordem de servico invalida.", bloqueioRegra: true };
    }

    const numeroOsParaNotificacao = await prisma.$transaction(async (tx) => {
      const antes = await tx.ordemServico.findUnique({
        where: { id: osId },
        select: {
          id: true,
          numeroOs: true,
          etapa: true,
          situacao: true,
          status: true,
          archivedAt: true,
          excluidaEm: true,
          ehRetornoGarantia: true,
        },
      });

      if (!antes?.id) {
        throw new ErroNegocio("Ordem de servico nao encontrada.");
      }

      if (antes.excluidaEm) {
        throw new ErroNegocio("Nao e permitido alterar etapa de uma OS excluida.");
      }

      const etapaAtual = antes.etapa as EtapaOS;
      const ehRetornoGarantia = Boolean(antes.ehRetornoGarantia);

      const motivoNegado = motivoTransicaoNegadaEtapa(etapaAtual, etapa, { ehRetornoGarantia });

      if (motivoNegado !== null) {
        throw new ErroNegocio(motivoNegado);
      }

      // Trocar de etapa sempre zera a situacao (Parte 3 do prompt da fase).
      const statusLegado = paraStatusLegado({ etapa, situacao: null }, ehRetornoGarantia);

      await tx.ordemServico.update({
        where: { id: osId },
        data: { etapa, situacao: null, status: statusLegado },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          { id: normalizarIdUsuarioOperacional(usuario) },
          "app/actions/os.ts:atualizarEtapaOrdemServico"
        ),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_STATUS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: osId,
          dadosAntes: {
            etapa: etapaAtual,
            situacao: antes.situacao,
            status: antes.status,
            archivedAt: antes.archivedAt ? antes.archivedAt.toISOString() : null,
          },
          dadosDepois: {
            etapa,
            situacao: null,
            status: statusLegado,
            // archivedAt intencionalmente inalterado por esta acao.
            archivedAt: antes.archivedAt ? antes.archivedAt.toISOString() : null,
            ...descreverAutoria(contexto),
          },
        }
      );

      return Number(antes.numeroOs ?? 0);
    });

    await notificarMudancaStatusOS(prisma, paraStatusLegado({ etapa, situacao: null }, false), numeroOsParaNotificacao);

    revalidarOrdemServico(osId);

    return {
      sucesso: true,
      mensagem: "Etapa da OS atualizada com sucesso.",
      osId,
      etapa,
      situacao: null,
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: paraMensagemSegura(error),
      bloqueioRegra: error instanceof ErroNegocio || error instanceof ErroPermissao,
    };
  }
}

export type ResultadoAtualizacaoSituacaoOrdemServico =
  | {
      sucesso: true;
      mensagem: string;
      osId: string;
      situacao: SituacaoOS | null;
    }
  | {
      sucesso: false;
      erro: string;
    };

/**
 * Marca ou limpa a `situacao` da OS SEM mover a etapa — a acao do menu do
 * card (Parte 4). Ao contrario de `atualizarEtapaOrdemServico`, esta funcao
 * nunca passa pela maquina de estados de etapa: a unica regra e a situacao
 * pedida ser valida pra etapa ATUAL (normalizarSituacao, em etapas.ts).
 */
export async function atualizarSituacaoOrdemServico(
  osId: string,
  situacao: SituacaoOS | null
): Promise<ResultadoAtualizacaoSituacaoOrdemServico> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    if (!osId) {
      return { sucesso: false, erro: "ID da ordem de servico nao informado." };
    }

    const situacaoAplicada = await prisma.$transaction(async (tx) => {
      const antes = await tx.ordemServico.findUnique({
        where: { id: osId },
        select: {
          id: true,
          etapa: true,
          situacao: true,
          status: true,
          excluidaEm: true,
          ehRetornoGarantia: true,
        },
      });

      if (!antes?.id) {
        throw new ErroNegocio("Ordem de servico nao encontrada.");
      }

      if (antes.excluidaEm) {
        throw new ErroNegocio("Nao e permitido alterar uma OS excluida.");
      }

      const etapaAtual = antes.etapa as EtapaOS;
      const situacaoNormalizada = normalizarSituacao(etapaAtual, situacao);

      if (situacao !== null && situacaoNormalizada === null) {
        throw new ErroNegocio(
          `"${ROTULOS_SITUACAO_OS[situacao]}" não é uma situação válida para a etapa "${ROTULOS_ETAPA_OS[etapaAtual]}".`
        );
      }

      const statusNovo = paraStatusLegado(
        { etapa: etapaAtual, situacao: situacaoNormalizada },
        Boolean(antes.ehRetornoGarantia)
      );

      await tx.ordemServico.update({
        where: { id: osId },
        data: { situacao: situacaoNormalizada, status: statusNovo },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          { id: normalizarIdUsuarioOperacional(usuario) },
          "app/actions/os.ts:atualizarSituacaoOrdemServico"
        ),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_STATUS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: osId,
          dadosAntes: {
            etapa: etapaAtual,
            situacao: antes.situacao,
            status: antes.status,
          },
          dadosDepois: {
            etapa: etapaAtual,
            situacao: situacaoNormalizada,
            status: statusNovo,
            ...descreverAutoria(contexto),
          },
        }
      );

      return situacaoNormalizada;
    });

    revalidarOrdemServico(osId);

    return {
      sucesso: true,
      mensagem: situacaoAplicada ? `Situação "${ROTULOS_SITUACAO_OS[situacaoAplicada]}" aplicada.` : "Situação removida.",
      osId,
      situacao: situacaoAplicada,
    };
  } catch (error) {
    return { sucesso: false, erro: paraMensagemSegura(error) };
  }
}

export type EstagioDestinoReabertura = {
  etapa: EtapaOS;
  situacao: SituacaoOS | null;
};

export type EntradaReaberturaOrdemServico = {
  osId: string;
  motivo: string;
  estagioDestino: EstagioDestinoReabertura;
};

export type ResultadoReaberturaOrdemServico =
  | { sucesso: true; mensagem: string; osId: string; etapa: EtapaOS; situacao: SituacaoOS | null }
  | { sucesso: false; erro: string };

// Destinos validos ao reabrir uma OS entregue (Fase 1C-3: em termos de
// etapa+situacao, nunca ORCAMENTO). Nao exportado: arquivo "use server" so
// pode exportar funcoes async. A mesma lista aparece em
// components/os/modal-reabrir-os.tsx.
const ESTAGIOS_DESTINO_REABERTURA: readonly EstagioDestinoReabertura[] = [
  { etapa: "CONSERTO", situacao: null },
  { etapa: "CONSERTO", situacao: "AGUARDANDO_PECA" },
  { etapa: "PRONTO", situacao: null },
];

function estagioValidoParaReabertura(estagio: EstagioDestinoReabertura): boolean {
  return ESTAGIOS_DESTINO_REABERTURA.some(
    (item) => item.etapa === estagio.etapa && item.situacao === estagio.situacao
  );
}

const MOTIVO_REABERTURA_MINIMO = 10;

/**
 * Reabre uma OS ENTREGUE.
 *
 * E a unica saida do estado ENTREGUE, e a unica coisa no sistema que limpa
 * `archivedAt`. Exige motivo e perfil ADMIN ou GESTOR: desfazer uma entrega tem
 * efeito financeiro e contratual (a garantia ja foi emitida com data de inicio).
 * O termo de garantia e deliberadamente preservado — reabrir para retrabalho
 * nao deve reiniciar nem invalidar a garantia do cliente.
 */
export async function reabrirOrdemServico(
  input: EntradaReaberturaOrdemServico
): Promise<ResultadoReaberturaOrdemServico> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.reabrir");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    const osId = String(input?.osId ?? "").trim();
    const motivo = String(input?.motivo ?? "").trim();
    const estagioDestino = input?.estagioDestino;

    if (!osId) {
      return { sucesso: false, erro: "ID da ordem de servico nao informado." };
    }

    if (motivo.length < MOTIVO_REABERTURA_MINIMO) {
      return {
        sucesso: false,
        erro: `Descreva o motivo da reabertura com pelo menos ${MOTIVO_REABERTURA_MINIMO} caracteres.`,
      };
    }

    if (motivo.length > 500) {
      return { sucesso: false, erro: "O motivo da reabertura excede 500 caracteres." };
    }

    if (!estagioDestino || !estagioValidoParaReabertura(estagioDestino)) {
      return {
        sucesso: false,
        erro: 'Ao reabrir, escolha "Conserto" ou "Pronto" (com ou sem "Aguardando peça").',
      };
    }

    await prisma.$transaction(async (tx) => {
      const antes = await tx.ordemServico.findUnique({
        where: { id: osId },
        select: {
          id: true,
          status: true,
          archivedAt: true,
          excluidaEm: true,
          ehRetornoGarantia: true,
          termoGarantia: { select: { id: true } },
        },
      });

      if (!antes?.id) {
        throw new ErroNegocio("Ordem de servico nao encontrada.");
      }

      if (antes.excluidaEm) {
        throw new ErroNegocio("Nao e permitido reabrir uma OS excluida.");
      }

      if (antes.status !== "ENTREGUE") {
        throw new ErroNegocio(
          "Só é possível reabrir uma OS que já foi entregue. Para mover esta OS, use a mudança de status normal."
        );
      }

      // Escrita dupla (Fase 1C-3) — mesma funcao usada em toda a aplicacao.
      const statusDestino = paraStatusLegado(estagioDestino, Boolean(antes.ehRetornoGarantia));

      await tx.ordemServico.update({
        where: { id: osId },
        data: {
          status: statusDestino,
          etapa: estagioDestino.etapa,
          situacao: estagioDestino.situacao,
          archivedAt: null,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          { id: normalizarIdUsuarioOperacional(usuario) },
          "app/actions/os.ts:reabrirOrdemServico"
        ),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_STATUS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: osId,
          motivo,
          dadosAntes: {
            status: antes.status,
            archivedAt: antes.archivedAt ? antes.archivedAt.toISOString() : null,
          },
          dadosDepois: {
            status: statusDestino,
            etapa: estagioDestino.etapa,
            situacao: estagioDestino.situacao,
            archivedAt: null,
            reabertura: true,
            // O termo de garantia continua valido e com as datas originais.
            termoGarantiaPreservadoId: antes.termoGarantia?.id ?? null,
            papelDoAutor: String(usuario.role ?? ""),
            ...descreverAutoria(contexto),
          },
        }
      );
    });

    revalidarOrdemServico(osId);

    return {
      sucesso: true,
      mensagem: "OS reaberta com sucesso.",
      osId,
      etapa: estagioDestino.etapa,
      situacao: estagioDestino.situacao,
    };
  } catch (error) {
    return { sucesso: false, erro: paraMensagemSegura(error) };
  }
}


export type FinalizarOrdemServicoInput = {
  osId: string;
};

export type GerarGarantiaEFinalizarOSInput = {
  osId: string;
  prazoGarantiaDias: number;
};

export type ResultadoFinalizacaoOrdemServico =
  | {
      sucesso: true;
      mensagem: string;
      osId: string;
      termoGarantiaId?: string;
      garantiaGerada: boolean;
    }
  | {
      sucesso: false;
      erro: string;
      requerGarantia?: boolean;
    };

type OrdemServicoFinalizacao = {
  id: string;
  numeroOs: number;
  status: StatusOS;
  archivedAt: Date | null;
  excluidaEm: Date | null;
  ehRetornoGarantia: boolean;
  observacoes: string | null;
  termoGarantia: { id: string } | null;
  itens: Array<{ id: string; descricao: string; custoPeca: EntradaDecimal; valorCobrado: EntradaDecimal }>;
  transacoes: Array<{ vendaId: string | null; origem: string }>;
};

/**
 * Le as regras de finalizacao da Configuracao do tenant.
 * Reaproveita `obterRegrasOs` (gates de OS) e completa com os prazos de garantia.
 */
async function obterRegrasFinalizacao(prisma: PrismaTenant): Promise<RegrasConfiguracaoFinalizacao> {
  const defaults = obterDefaultsConfiguracaoOsGarantias();
  const regrasOs = await obterRegrasOs(prisma);

  let configuracao: {
    prazoGarantiaPadraoDias?: number | null;
    prazoMinimoGarantiaDias?: number | null;
    prazoMaximoGarantiaDias?: number | null;
  } | null = null;

  try {
    configuracao = await prisma.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: {
        prazoGarantiaPadraoDias: true,
        prazoMinimoGarantiaDias: true,
        prazoMaximoGarantiaDias: true,
      },
    });
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }
  }

  const numeroOuPadrao = (valor: number | null | undefined, padrao: number): number =>
    typeof valor === "number" && Number.isFinite(valor) ? valor : padrao;

  return {
    exigirDiagnosticoParaFinalizar: regrasOs.exigirDiagnosticoParaFinalizar,
    permitirFinalizarSemPagamento: regrasOs.permitirFinalizarSemPagamento,
    prazoGarantiaPadraoDias: numeroOuPadrao(
      configuracao?.prazoGarantiaPadraoDias,
      defaults.prazoGarantiaPadraoDias
    ),
    prazoMinimoGarantiaDias: numeroOuPadrao(
      configuracao?.prazoMinimoGarantiaDias,
      defaults.prazoMinimoGarantiaDias
    ),
    prazoMaximoGarantiaDias: numeroOuPadrao(
      configuracao?.prazoMaximoGarantiaDias,
      defaults.prazoMaximoGarantiaDias
    ),
  };
}

/**
 * Data de entrega usada como inicio da garantia no caso de RESGATE
 * (OS ja ENTREGUE a que falta o termo).
 *
 * A entrega real e a PRIMEIRA transicao auditada para ENTREGUE — nunca um eco
 * de resgate (ver lib/dominio/os/entrega-auditada.ts para o motivo). Sem
 * nenhuma transicao real registrada (OS legada, anterior a trilha), cai para
 * agora e o fato fica anotado na propria auditoria como ESTIMADO.
 */
async function obterMomentoEntregaAuditado(
  prisma: PrismaTenant,
  osId: string
): Promise<{ momento: Date; fonte: "AUDITORIA" | "ESTIMADO" }> {
  try {
    const linhas = await prisma.$queryRaw<
      Array<{
        id: string;
        criadoEm: Date;
        statusAntes: string | null;
        statusDepois: string | null;
        tipoFinalizacao: string | null;
      }>
    >`
      SELECT id, "criadoEm",
             "dadosAntes" ->> 'status' AS "statusAntes",
             "dadosDepois" ->> 'status' AS "statusDepois",
             "dadosDepois" ->> 'tipoFinalizacao' AS "tipoFinalizacao"
      FROM "LogAuditoria"
      WHERE entidade = 'ORDEM_SERVICO'
        AND "entidadeId" = ${osId}
        AND "dadosDepois" ->> 'status' = 'ENTREGUE'
    `;

    const resultado = encontrarEntregaAuditada(
      linhas.map((linha) => ({
        id: String(linha.id),
        criadoEm: new Date(linha.criadoEm),
        statusAntes: linha.statusAntes,
        statusDepois: linha.statusDepois,
        tipoFinalizacao: linha.tipoFinalizacao,
      }))
    );

    if (resultado.encontrada) {
      return { momento: resultado.momento, fonte: "AUDITORIA" };
    }
  } catch (erro) {
    // Trilha ausente ou tabela inexistente nao pode impedir o resgate da OS.
    console.error("[os] falha ao ler a entrega auditada; usando agora como inicio da garantia", {
      osId,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
  }

  return { momento: new Date(), fonte: "ESTIMADO" };
}

export type ResultadoFinalizarOrdemServico =
  | {
      sucesso: true;
      mensagem: string;
      osId: string;
      termoGarantiaId?: string;
      garantiaGerada: boolean;
      ehResgate: boolean;
    }
  | {
      sucesso: false;
      erro: string;
      pendencias: PendenciaFinalizacao[];
      requerGarantia?: boolean;
    };

/**
 * FINALIZACAO ATOMICA DA OS — ponto unico de entrega.
 *
 * Substitui os dois caminhos anteriores (`gerarGarantiaEFinalizarOS` e
 * `archiveDeliveredOrderService`), que divergiam nos gates e deixavam uma
 * armadilha fechada: OS ja ENTREGUE e sem termo nao podia ser finalizada por
 * nenhum dos dois (AUDIT_REPORT 16.3-1).
 *
 * Numa unica transacao:
 *   1. carrega OS + itens + termo + regras;
 *   2. avalia TODAS as regras de uma vez (nada e gravado se houver pendencia);
 *   3. emite ou reancora o termo de garantia (OS normal);
 *   4. grava status = ENTREGUE, archivedAt = agora e prazoGarantiaDias;
 *   5. audita OS e termo com antes/depois.
 */
export async function finalizarOrdemServico(
  input: FinalizarOrdemServicoInput & { prazoGarantiaDias?: number | null }
): Promise<ResultadoFinalizarOrdemServico> {
  const contexto = await exigirContextoTenant();

  try {
    exigirPermissao(contexto, "os.finalizar");
  } catch (erro) {
    if (erro instanceof ErroPermissao) {
      return { sucesso: false, erro: erro.message, pendencias: [] };
    }
    throw erro;
  }

  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;
  const osId = String(input?.osId ?? "").trim();

  if (!osId) {
    return {
      sucesso: false,
      erro: "ID da ordem de servico nao informado.",
      pendencias: [],
    };
  }

  const ordemServico = (await prisma.ordemServico.findUnique({
    where: { id: osId },
    select: {
      id: true,
      numeroOs: true,
      status: true,
      archivedAt: true,
      excluidaEm: true,
      ehRetornoGarantia: true,
      observacoes: true,
      termoGarantia: { select: { id: true } },
      itens: { select: { id: true, descricao: true, custoPeca: true, valorCobrado: true } },
      transacoes: { select: { vendaId: true, origem: true } },
    },
  })) as OrdemServicoFinalizacao | null;

  if (!ordemServico) {
    return {
      sucesso: false,
      erro: "Ordem de servico nao encontrada.",
      pendencias: [],
    };
  }

  const regras = await obterRegrasFinalizacao(prisma);
  const possuiPagamentoConfirmado = regras.permitirFinalizarSemPagamento
    ? true
    : await osPossuiPagamentoConfirmado(prisma, osId);

  const possuiVendaVinculada = ordemServico.transacoes.some(
    (transacao) => Boolean(transacao.vendaId) && transacao.origem === "ORDEM_SERVICO"
  );

  const avaliacao = avaliarFinalizacao({
    status: ordemServico.status,
    ehRetornoGarantia: ordemServico.ehRetornoGarantia,
    excluidaEm: ordemServico.excluidaEm,
    archivedAt: ordemServico.archivedAt,
    possuiTermoGarantia: ordemServico.termoGarantia !== null,
    itens: ordemServico.itens.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      custo: paraMoeda(deDecimal(item.custoPeca ?? 0)),
      precoVenda: paraMoeda(deDecimal(item.valorCobrado ?? 0)),
    })),
    observacoes: ordemServico.observacoes,
    possuiPagamentoConfirmado,
    possuiVendaVinculada,
    prazoGarantiaDiasInformado: input.prazoGarantiaDias ?? null,
    regras,
  });

  if (!avaliacao.podeFinalizar) {
    return {
      sucesso: false,
      erro: resumirPendencias(avaliacao.pendencias),
      pendencias: avaliacao.pendencias,
      requerGarantia: avaliacao.deveGerarTermo,
    };
  }

  // Momento da entrega: agora no fluxo normal; a entrega auditada no resgate.
  const entrega = avaliacao.ehResgate
    ? await obterMomentoEntregaAuditado(prisma, osId)
    : { momento: new Date(), fonte: "AGORA" as const };

  // Rotulo estavel do tipo de finalizacao, gravado em toda auditoria desta
  // funcao — ver lib/dominio/os/entrega-auditada.ts, que le exatamente este
  // campo (junto com dadosAntes.status) para nunca confundir um resgate com
  // uma entrega de verdade.
  const tipoFinalizacao = avaliacao.ehResgate ? ("RESGATE" as const) : ("ENTREGA" as const);

  const resultado = await prisma.$transaction(async (tx) => {
    let termoGarantiaId = ordemServico.termoGarantia?.id;
    let garantiaGerada = false;
    let prazoGarantiaAplicado: number | null = null;

    if (!ordemServico.ehRetornoGarantia) {
      const garantia = await garantirTermoGarantiaPorOS(CHAMADA_INTERNA, tx, {
        osId,
        criadoPorId: normalizarIdUsuarioOperacional(usuario),
        prazoGarantiaDias: avaliacao.prazoGarantiaEfetivo ?? undefined,
        dataInicioGarantia: entrega.momento,
        fusoHorario: contexto.fusoHorario,
        auditoria: {
          contexto: contextoAuditoriaDoUsuario(
            { id: normalizarIdUsuarioOperacional(usuario) },
            "app/actions/os.ts:finalizarOrdemServico"
          ),
          extras: {
            ehResgate: avaliacao.ehResgate,
            tipoFinalizacao,
            fonteDataEntrega: entrega.fonte,
            ...descreverAutoria(contexto),
          },
        },
      });

      termoGarantiaId = garantia.termoGarantiaId;
      garantiaGerada = garantia.criadoNovo;
      prazoGarantiaAplicado = garantia.prazoGarantiaDias;
    }

    const archivedAtFinal = ordemServico.archivedAt ?? entrega.momento;

    // Escrita dupla (Fase 1C-3) — ENTREGUE mapeia 1:1 nos dois modelos.
    const estagioEntregue = paraEstagio("ENTREGUE");

    await tx.ordemServico.update({
      where: { id: osId },
      data: {
        status: "ENTREGUE",
        etapa: estagioEntregue.etapa,
        situacao: estagioEntregue.situacao,
        archivedAt: archivedAtFinal,
        ...(prazoGarantiaAplicado !== null ? { prazoGarantiaDias: prazoGarantiaAplicado } : {}),
      },
    });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(
        { id: normalizarIdUsuarioOperacional(usuario) },
        "app/actions/os.ts:finalizarOrdemServico"
      ),
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: osId,
        dadosAntes: {
          status: ordemServico.status,
          archivedAt: ordemServico.archivedAt ? ordemServico.archivedAt.toISOString() : null,
          possuiTermoGarantia: ordemServico.termoGarantia !== null,
        },
        dadosDepois: {
          status: "ENTREGUE",
          etapa: estagioEntregue.etapa,
          situacao: estagioEntregue.situacao,
          archivedAt: archivedAtFinal.toISOString(),
          termoGarantiaId: termoGarantiaId ?? null,
          garantiaGerada,
          prazoGarantiaDias: prazoGarantiaAplicado,
          ehResgate: avaliacao.ehResgate,
          tipoFinalizacao,
          // Registra de onde veio a data de entrega no resgate, para que a
          // origem do numero seja auditavel depois.
          fonteDataEntrega: entrega.fonte,
          ...descreverAutoria(contexto),
        },
      }
    );

    return { termoGarantiaId, garantiaGerada };
  });

  revalidarOrdemServico(osId);

  return {
    sucesso: true,
    mensagem: avaliacao.ehResgate
      ? "OS regularizada: entrega, garantia e arquivamento concluídos."
      : "OS finalizada com sucesso.",
    osId,
    termoGarantiaId: resultado.termoGarantiaId,
    garantiaGerada: resultado.garantiaGerada,
    ehResgate: avaliacao.ehResgate,
  };
}

export type FinalizarSemServicoInput = {
  osId: string;
  motivo: string;
};

export type ResultadoFinalizarSemServico =
  | {
      sucesso: true;
      mensagem: string;
      osId: string;
    }
  | {
      sucesso: false;
      erro: string;
    };

/**
 * Encerra uma OS sem peça/serviço vinculado (Fase 1C-2, Parte 3) — a OS nunca
 * teve item lançado, entao `avaliarFinalizacao` sempre bloquearia (Parte 2
 * tornou item obrigatorio na entrega normal). Nao gera termo de garantia nem
 * exige pedido no PDV, e fica de fora do faturamento (ver
 * lib/dashboard/regras-financeiras.ts e app/actions/metas.ts).
 */
export async function finalizarSemServico(
  input: FinalizarSemServicoInput
): Promise<ResultadoFinalizarSemServico> {
  const contexto = await exigirContextoTenant();

  try {
    exigirPermissao(contexto, "os.finalizar");
  } catch (erro) {
    if (erro instanceof ErroPermissao) {
      return { sucesso: false, erro: erro.message };
    }
    throw erro;
  }

  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;
  const osId = String(input?.osId ?? "").trim();
  const motivo = String(input?.motivo ?? "").trim();

  if (!osId) {
    return { sucesso: false, erro: "ID da ordem de servico nao informado." };
  }

  if (motivo.length < 10) {
    return {
      sucesso: false,
      erro: "Informe o motivo do encerramento sem serviço (mínimo 10 caracteres).",
    };
  }

  const ordemServico = await prisma.ordemServico.findUnique({
    where: { id: osId },
    select: {
      id: true,
      numeroOs: true,
      status: true,
      archivedAt: true,
      excluidaEm: true,
      _count: { select: { itens: true } },
    },
  });

  if (!ordemServico) {
    return { sucesso: false, erro: "Ordem de servico nao encontrada." };
  }

  const avaliacao = avaliarFinalizacaoSemServico({
    status: ordemServico.status,
    excluidaEm: ordemServico.excluidaEm,
    quantidadeItens: Number(ordemServico._count?.itens ?? 0),
  });

  if (!avaliacao.podeFinalizar) {
    return { sucesso: false, erro: avaliacao.erro };
  }

  const agora = new Date();
  // Escrita dupla (Fase 1C-3) — ENTREGUE mapeia 1:1 nos dois modelos.
  const estagioEntregue = paraEstagio("ENTREGUE");

  await prisma.$transaction(async (tx) => {
    await tx.ordemServico.update({
      where: { id: osId },
      data: {
        status: "ENTREGUE",
        etapa: estagioEntregue.etapa,
        situacao: estagioEntregue.situacao,
        archivedAt: agora,
        entregueSemServico: true,
        motivoSemServico: motivo,
      },
    });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(
        { id: normalizarIdUsuarioOperacional(usuario) },
        "app/actions/os.ts:finalizarSemServico"
      ),
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: osId,
        dadosAntes: {
          status: ordemServico.status,
          archivedAt: ordemServico.archivedAt ? ordemServico.archivedAt.toISOString() : null,
        },
        dadosDepois: {
          status: "ENTREGUE",
          etapa: estagioEntregue.etapa,
          situacao: estagioEntregue.situacao,
          archivedAt: agora.toISOString(),
          entregueSemServico: true,
          tipoFinalizacao: "ENTREGA",
          ...descreverAutoria(contexto),
        },
        motivo,
      }
    );
  });

  revalidarOrdemServico(osId);

  return {
    sucesso: true,
    mensagem: `OS ${ordemServico.numeroOs} encerrada sem serviço vinculado.`,
    osId,
  };
}

/**
 * COMPATIBILIDADE. Delegava a logica propria de arquivamento; agora e um
 * invólucro fino de `finalizarOrdemServico`.
 * Chamador: components/os/dashboard-os.tsx.
 */
export async function archiveDeliveredOrderService(
  input: FinalizarOrdemServicoInput
): Promise<ResultadoFinalizacaoOrdemServico> {
  const resultado = await finalizarOrdemServico({ osId: input.osId });

  if (!resultado.sucesso) {
    return {
      sucesso: false,
      erro: resultado.erro,
      requerGarantia: resultado.requerGarantia,
    };
  }

  return {
    sucesso: true,
    mensagem: resultado.mensagem,
    osId: resultado.osId,
    termoGarantiaId: resultado.termoGarantiaId,
    garantiaGerada: resultado.garantiaGerada,
  };
}

/**
 * COMPATIBILIDADE. Mesmo invólucro, aceitando o prazo de garantia.
 * Chamador: components/os/dashboard-os.tsx.
 */
export async function gerarGarantiaEFinalizarOS(
  input: GerarGarantiaEFinalizarOSInput
): Promise<ResultadoFinalizacaoOrdemServico> {
  const prazo = Number(input?.prazoGarantiaDias);

  const resultado = await finalizarOrdemServico({
    osId: input.osId,
    prazoGarantiaDias: Number.isFinite(prazo) && prazo > 0 ? prazo : null,
  });

  if (!resultado.sucesso) {
    return {
      sucesso: false,
      erro: resultado.erro,
      requerGarantia: resultado.requerGarantia,
    };
  }

  return {
    sucesso: true,
    mensagem: resultado.mensagem,
    osId: resultado.osId,
    termoGarantiaId: resultado.termoGarantiaId,
    garantiaGerada: resultado.garantiaGerada,
  };
}



export type ResultadoExcluirOrdemServico =
  | {
      sucesso: true;
      mensagem: string;
    }
  | {
      sucesso: false;
      erro: string;
    };

export type DadosOrdemServicoExcluida = {
  id: string;
  numeroOs: number;
  clienteNome: string;
  equipamento: string;
  totalOrcamento: number;
  statusAnterior: string;
  motivoExclusao: string;
  excluidaEm: Date;
  excluidaPorNome: string;
};

export type EntradaExcluirOrdemServico = {
  osId: string;
  motivoExclusao: string;
};

function normalizarMotivoExclusao(valor: string): string | null {
  const motivo = String(valor ?? "").trim();

  if (motivo.length < 5 || motivo.length > 500) {
    return null;
  }

  return motivo;
}



export async function excluirOrdemServico(input: EntradaExcluirOrdemServico): Promise<ResultadoExcluirOrdemServico> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.excluir");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    const idNormalizado = String(input.osId ?? "").trim();
    const motivoNormalizado = normalizarMotivoExclusao(input.motivoExclusao);

    if (!idNormalizado) {
      return {
        sucesso: false,
        erro: "Não foi possível excluir a OS. Tente novamente.",
      };
    }

    if (!motivoNormalizado) {
      return {
        sucesso: false,
        erro: "Informe o motivo da exclusão.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const txAny = tx as typeof tx & Record<string, unknown>;
      const ordemServicoDelegate =
        (txAny.ordemServico as
          | {
              findUnique?: (args: unknown) => Promise<{
                id: string;
                archivedAt?: Date | null;
                excluidaEm?: Date | null;
                status?: string | null;
                excluidaPorId?: string | null;
                numeroOs?: number | null;
              } | null>;
              update?: (args: unknown) => Promise<unknown>;
            }
          | undefined) ??
        (txAny.OrdemServico as
          | {
              findUnique?: (args: unknown) => Promise<{
                id: string;
                archivedAt?: Date | null;
                excluidaEm?: Date | null;
                status?: string | null;
                excluidaPorId?: string | null;
                numeroOs?: number | null;
              } | null>;
              update?: (args: unknown) => Promise<unknown>;
            }
          | undefined);

      if (!ordemServicoDelegate?.findUnique || !ordemServicoDelegate.update) {
        throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
      }

      const osExistente = await ordemServicoDelegate.findUnique({
        where: { id: idNormalizado },
        select: {
          id: true,
          archivedAt: true,
          excluidaEm: true,
          excluidaPorId: true,
          numeroOs: true,
          status: true,
        },
      });

      if (!osExistente?.id) {
        throw new Error("OS inexistente");
      }

      if (osExistente.excluidaEm) {
        throw new Error("OS ja excluida");
      }

      await ordemServicoDelegate.update({
        where: {
          id: idNormalizado,
        },
        data: {
          excluidaEm: new Date(),
          excluidaPorId: normalizarIdUsuarioOperacional(usuario),
          motivoExclusao: motivoNormalizado,
          statusAnterior: String(osExistente.status ?? "AGUARDANDO_ORCAMENTO"),
          archivedAt: new Date(),
          atualizadoEm: new Date(),
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/os.ts:excluirOrdemServico"),
        {
          acao: ACOES_AUDITORIA.EXCLUIR_LOGICO,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: idNormalizado,
          dadosAntes: {
            status: osExistente.status,
            excluidaEm: osExistente.excluidaEm,
            archivedAt: osExistente.archivedAt,
          },
          dadosDepois: {
            status: osExistente.status,
            excluidaEm: new Date().toISOString(),
            archivedAt: new Date().toISOString(),
            ...descreverAutoria(contexto),
          },
          motivo: motivoNormalizado,
        }
      );
    });

    revalidatePath("/");
    revalidatePath("/os");
    revalidatePath(`/os/${idNormalizado}`);
    revalidatePath(`/os/${idNormalizado}/garantia`);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/pdv");

    return {
      sucesso: true,
      mensagem: "OS excluída com sucesso.",
    };
  } catch (erro) {
    if (erro instanceof ErroPermissao) {
      return { sucesso: false, erro: erro.message };
    }

    const mensagemInterna = erro instanceof Error ? erro.message : "";

    if (mensagemInterna.includes("OS ja excluida")) {
      return {
        sucesso: false,
        erro: "Esta OS já foi excluída.",
      };
    }

    return {
      sucesso: false,
      erro: "Não foi possível excluir a OS. Tente novamente.",
    };
  }
}

async function listarOrdensServicoExcluidas(): Promise<DadosOrdemServicoExcluida[]> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;

  try {
    const ordensExcluidas = await prisma.$queryRaw<Array<{
      id: string;
      numeroOs: number;
      equipamento: string;
      statusAnterior: string | null;
      statusAtual: string | null;
      motivoExclusao: string | null;
      excluidaEm: Date;
      clienteNome: string | null;
      excluidaPorNome: string | null;
      totalOrcamento: number | null;
    }>>`
      SELECT
        os.id,
        os."numeroOs",
        os.equipamento,
        os."statusAnterior"::text AS "statusAnterior",
        os.status::text AS "statusAtual",
        os."motivoExclusao",
        os."excluidaEm",
        c."nomeRazaoSocial" AS "clienteNome",
        u.nome AS "excluidaPorNome",
        COALESCE(SUM(i."valorCobrado"), 0) AS "totalOrcamento"
      FROM "OrdemServico" os
      LEFT JOIN "Cliente" c ON c.id = os."clienteId"
      LEFT JOIN "Usuario" u ON u.id = os."excluidaPorId"
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NOT NULL
      GROUP BY
        os.id,
        os."numeroOs",
        os.equipamento,
        os."statusAnterior",
        os.status,
        os."motivoExclusao",
        os."excluidaEm",
        c."nomeRazaoSocial",
        u.nome
      ORDER BY os."excluidaEm" DESC
    `;

    return ordensExcluidas.map((os) => ({
      id: String(os.id),
      numeroOs: Number(os.numeroOs ?? 0),
      clienteNome: String(os.clienteNome ?? "Cliente nao informado"),
      equipamento: String(os.equipamento ?? "Nao informado"),
      totalOrcamento: Number(os.totalOrcamento ?? 0),
      statusAnterior: String(os.statusAnterior ?? os.statusAtual ?? "Nao informado"),
      motivoExclusao: String(os.motivoExclusao ?? "Nao informado"),
      excluidaEm: new Date(os.excluidaEm),
      excluidaPorNome: String(os.excluidaPorNome ?? "Usuário não identificado"),
    }));
  } catch {
    return [];
  }
}

export async function gerarPedidoVendaPorOS(osId: string) {
  // C1: exige sessao valida antes de gerar pedido/venda.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const { prisma } = contexto;

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoPedidoDelegate;
    OrdemServico?: OrdemServicoPedidoDelegate;
    contaReceber?: ContaReceberPedidoDelegate;
    ContaReceber?: ContaReceberPedidoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;

  if (!ordemServicoDelegate?.findUnique || !contaReceberDelegate?.findFirst) {
    throw new Error("Delegates Prisma necessarios para gerar pedido de venda nao disponiveis.");
  }

  const os = await ordemServicoDelegate.findUnique({
    where: { id: osId },
    select: {
      id: true,
      clienteId: true,
      status: true,
      numeroOs: true,
      itens: {
        select: {
          valorCobrado: true,
        },
      },
    },
  });

  if (!os) {
    throw new Error("Ordem de servico nao encontrada.");
  }

  if (String(os.status) !== "PRONTO") {
    throw new Error("A OS precisa estar com status PRONTO para gerar pedido de venda.");
  }

  const pedidoExistente = await contaReceberDelegate.findFirst({
    where: {
      ordemServicoId: osId,
      origem: "ORDEM_SERVICO",
      vendaId: {
        not: null,
      },
    },
    select: {
      vendaId: true,
    },
  });

  if (pedidoExistente?.vendaId) {
    return {
      vendaId: String(pedidoExistente.vendaId),
      pedidoJaExistia: true,
    };
  }

  let configuracao: { exigirItemParaEnviarPDV?: boolean | null } | null = null;

  try {
    configuracao = await prisma.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: {
        exigirItemParaEnviarPDV: true,
      },
    });
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }
    try {
      const rows = await prisma.$queryRaw<Array<{ exigirItemParaEnviarPDV: boolean | null }>>`
        SELECT "exigirItemParaEnviarPDV" FROM "Configuracao" ORDER BY "criadoEm" ASC LIMIT 1
      `;
      configuracao = rows[0] ?? null;
    } catch {
      // mantém null → defaults
    }
  }

  const exigirItemParaEnviarPDV =
    typeof configuracao?.exigirItemParaEnviarPDV === "boolean"
      ? Boolean(configuracao.exigirItemParaEnviarPDV)
      : obterDefaultsConfiguracaoOsGarantias().exigirItemParaEnviarPDV;

  const quantidadeItens = (os.itens ?? []).length;
  if (exigirItemParaEnviarPDV && quantidadeItens === 0) {
    throw new Error("Para enviar ao PDV, cadastre pelo menos uma peca ou servico na OS.");
  }

  const totalPedidoCentavos = somar(...(os.itens ?? []).map((item: OrdemServicoPedidoItem) => deDecimal(item.valorCobrado ?? 0)));
  const totalPedido = paraMoeda(totalPedidoCentavos);

  if (totalPedido <= 0) {
    throw new Error("Nao foi possivel gerar o pedido: a OS nao possui valor de itens maior que zero.");
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & {
      venda?: VendaCreateDelegate;
      Venda?: VendaCreateDelegate;
      contaReceber?: ContaReceberCreateDelegate;
      ContaReceber?: ContaReceberCreateDelegate;
    };
    const txVenda = txAny.venda ?? txAny.Venda;
    const txContaReceber = txAny.contaReceber ?? txAny.ContaReceber;

    if (!txVenda?.create || !txContaReceber?.create) {
      throw new Error("Delegates Prisma de venda/contaReceber nao disponiveis para transacao.");
    }

    const novaVenda = await txVenda.create({
      data: {
        clienteId: String(os.clienteId),
        formaPagamento: "PIX",
        valorTotal: paraDecimal(totalPedidoCentavos),
        desconto: paraDecimal(0),
      },
      select: {
        id: true,
      },
    });

    await txContaReceber.create({
      data: {
        descricao: `OS #${String(os.numeroOs)} - Pedido de venda`,
        valor: paraDecimal(totalPedidoCentavos),
        clienteId: String(os.clienteId),
        ordemServicoId: String(os.id),
        vendaId: String(novaVenda.id),
        dataVencimento: new Date(),
        status: "PENDENTE",
        formaRecebimento: "PIX",
        origem: "ORDEM_SERVICO",
        notaFiscalEmitida: false,
      },
    });

    return {
      vendaId: String(novaVenda.id),
      pedidoJaExistia: false,
    };
  });

  revalidatePath("/os");
  revalidatePath(`/os/${osId}`);
  revalidatePath("/");
  revalidatePath("/financeiro");

  return resultado;
}

/**
 * Fase 3-2B — chamado quando o usuario clica "Mostrar" na senha do aparelho
 * na tela de detalhe. So grava a trilha (quem + quando + qual OS); o valor
 * da senha nunca entra no payload — mesmo que entrasse, sanitizarValor()
 * (lib/auditoria.ts) redige qualquer campo chamado "senha". Best-effort
 * fora de transacao de negocio (ver OpcoesRegistroAuditoria.melhorEsforco):
 * uma falha aqui nao pode impedir o usuario de ver a senha que ja tem
 * permissao de ver.
 */
export async function registrarVisualizacaoSenhaOS(osId: string): Promise<void> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  const idNormalizado = String(osId ?? "").trim();

  if (!idNormalizado) return;

  // Confere que a OS existe no escopo de visibilidade do usuario antes de
  // gravar — mesma regra de acesso da pagina de detalhe (lib/auth/escopos.ts).
  const escopoOS = escopoOrdemServico(contexto);
  const osNoEscopo = await prisma.ordemServico.findFirst({
    where: { id: idNormalizado, ...escopoOS },
    select: { id: true },
  });

  if (!osNoEscopo) return;

  await registrarLogAuditoria(
    prisma,
    contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/os.ts:registrarVisualizacaoSenhaOS"),
    {
      acao: ACOES_AUDITORIA.VISUALIZAR_SENHA,
      entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
      entidadeId: idNormalizado,
    },
    { melhorEsforco: true }
  );
}

export type LinhaHistoricoOS = {
  id: string;
  acao: string;
  rotulo: string;
  quando: string;
  autor: string | null;
};

const ROTULO_ACAO_HISTORICO: Partial<Record<string, string>> = {
  CRIAR: "OS criada",
  ATUALIZAR_STATUS: "Etapa alterada",
  FINALIZAR: "Entregue e finalizada",
  EXCLUIR_LOGICO: "OS excluída",
  VISUALIZAR_SENHA: "Senha visualizada",
};

/**
 * Historico compacto da OS (Fase 3-2B, Parte 3) — le direto de LogAuditoria,
 * sem tabela nova. So os eventos gravados com entidade=ORDEM_SERVICO e
 * entidadeId=osId (criacao, troca de etapa, finalizacao, exclusao,
 * visualizacao de senha) — adicionar/editar/remover item e gerar termo de
 * garantia gravam contra ITEM_OS/TERMO_GARANTIA_OS (o proprio id do item/
 * termo, nao o da OS) e ficam de fora desta lista compacta de propósito:
 * cruzar as duas fontes é um passo maior que esta fase de restilo cobre.
 */
export async function obterHistoricoOS(osId: string, limite = 8): Promise<LinhaHistoricoOS[]> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  const idNormalizado = String(osId ?? "").trim();

  if (!idNormalizado) return [];

  const escopoOS = escopoOrdemServico(contexto);
  const osNoEscopo = await prisma.ordemServico.findFirst({
    where: { id: idNormalizado, ...escopoOS },
    select: { id: true },
  });

  if (!osNoEscopo) return [];

  const registros = await prisma.logAuditoria.findMany({
    where: { entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO, entidadeId: idNormalizado },
    orderBy: { criadoEm: "desc" },
    take: Math.max(1, Math.min(limite, 50)),
    select: {
      id: true,
      acao: true,
      criadoEm: true,
      usuario: { select: { nome: true } },
    },
  });

  return registros.map((registro) => ({
    id: String(registro.id),
    acao: String(registro.acao),
    rotulo: ROTULO_ACAO_HISTORICO[String(registro.acao)] ?? String(registro.acao).replaceAll("_", " ").toLowerCase(),
    quando: registro.criadoEm.toISOString(),
    autor: registro.usuario?.nome ? String(registro.usuario.nome) : null,
  }));
}
