"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { propostaFormSchema, type PropostaFormValues } from "@/lib/validations/propostas";
import { aplicarPercentual, deDecimal, multiplicarPorQuantidade, paraDecimal, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import { agoraNaLoja, comoDataDeCalendario, dataDeCalendario, hojeComoDataDeCalendario, somarDiasEmDataDeCalendario } from "@/lib/datas";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import {
  calcularSituacao,
  calcularTaxaDeConversao,
  podeMarcarComoEnviada,
  podeRegistrarResposta,
  type StatusProposta,
} from "@/lib/dominio/propostas/situacao";
import {
  filtroDeBusca,
  filtroDeSituacao,
  ordenacao,
  type FiltroSituacaoProposta,
  type OrdemProposta,
} from "@/lib/propostas/consulta";

type PropostaStatusInput = "RASCUNHO" | "ENVIADA";

type CreatePropostaResult =
  | { success: true; message: string; propostaId: string }
  | { success: false; message: string };

type ClientePropostaSugestao = {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
};

type ProdutoPropostaSugestao = {
  id: string;
  nome: string;
  descricao: string | null;
  codigoBarras: string | null;
  precoVenda: number;
};

export async function listarClientesProposta(): Promise<ClientePropostaSugestao[]> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.ver");
    const prisma = contextoTenant.prisma;

    const clientes = await prisma.cliente.findMany({
      select: {
        id: true,
        nomeRazaoSocial: true,
        nomeFantasia: true,
        documento: true,
      },
      orderBy: {
        nomeRazaoSocial: "asc",
      },
      take: 300,
    });

    return clientes;
  } catch (error) {
    console.error("Erro ao listar clientes para proposta:", error);
    return [];
  }
}

export async function listarProdutosProposta(): Promise<ProdutoPropostaSugestao[]> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.ver");
    const prisma = contextoTenant.prisma;

    const produtos = await prisma.produto.findMany({
      select: {
        id: true,
        nome: true,
        descricao: true,
        codigoBarras: true,
        precoVenda: true,
      },
      where: {
        ativo: true,
      },
      orderBy: {
        nome: "asc",
      },
      take: 300,
    });

    return produtos.map((produto) => ({ ...produto, precoVenda: paraMoeda(deDecimal(produto.precoVenda)) }));
  } catch (error) {
    console.error("Erro ao listar produtos para proposta:", error);
    return [];
  }
}

/**
 * Validade, emissão e próximo contato são DATAS DE CALENDÁRIO: "vence dia 10"
 * não tem hora. Por isso passam por `dataDeCalendario` (meia-noite UTC) e não
 * por `new Date(`${texto}T00:00:00`)`, que ancora na meia-noite do fuso do
 * PROCESSO e desloca a data um dia conforme onde o código roda.
 *
 * Isso virou load-bearing agora: antes nada comparava `validade` com nada, e o
 * desvio de um dia passava em branco. A lista passou a dizer "vence hoje" e
 * "venceu há 2 dias" — se a data escorregar um dia na gravação, a tela erra.
 */
function toDateOnly(value: string): Date {
  const parsed = dataDeCalendario(value);
  if (!parsed) {
    throw new Error("Uma das datas informadas é inválida.");
  }
  return parsed;
}

export async function createProposta(
  data: PropostaFormValues,
  status: PropostaStatusInput
): Promise<CreatePropostaResult> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "propostas.editar");
    const prisma = contextoTenant.prisma;

    const validated = propostaFormSchema.parse(data);

    const normalizedItems = validated.itens
      .map((item) => ({
        descricao: item.descricao.trim(),
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        descontoPercentual: item.descontoPercentual,
      }))
      .filter((item) => item.descricao !== "");

    if (normalizedItems.length === 0) {
      return {
        success: false,
        message: "Adicione ao menos um item com descrição para salvar a proposta.",
      };
    }

    // Centavo-exato (Fase 2A-2): preço unitário/desconto vêm do formulário em
    // reais/percentual, mas toda soma/multiplicação/desconto passa por
    // lib/dinheiro.ts — nunca ponto flutuante direto (o subtotal bruto/total
    // gravado tinha que bater, item a item, com a soma dos subtotais de cada
    // linha, e ponto flutuante puro não garante isso).
    const itensComCentavos = normalizedItems.map((item) => {
      const precoUnitarioCentavos = deDecimal(item.precoUnitario);
      const linhaBrutaCentavos = multiplicarPorQuantidade(precoUnitarioCentavos, item.quantidade);
      const linhaDescontoCentavos = aplicarPercentual(linhaBrutaCentavos, item.descontoPercentual);
      const linhaSubtotalCentavos = Math.max(0, subtrair(linhaBrutaCentavos, linhaDescontoCentavos));

      return { ...item, precoUnitarioCentavos, linhaBrutaCentavos, linhaDescontoCentavos, linhaSubtotalCentavos };
    });

    const subtotalBrutoCentavos = somar(...itensComCentavos.map((item) => item.linhaBrutaCentavos));
    const descontoTotalCentavos = somar(...itensComCentavos.map((item) => item.linhaDescontoCentavos));
    const valorTotalCentavos = Math.max(0, subtrair(subtotalBrutoCentavos, descontoTotalCentavos));

    const paymentSummary = [validated.condicoesPagamento, validated.detalhesPagamento]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join(" | ");

    const created = await prisma.propostaComercial.create({
      data: {
        cliente: validated.cliente.trim(),
        aosCuidados: validated.aosCuidados,
        dataEmissao: toDateOnly(validated.dataEmissao),
        validade: toDateOnly(validated.validade),
        proximoContato: validated.proximoContato ? toDateOnly(validated.proximoContato) : null,
        equipamento: validated.equipamento,
        defeito: validated.defeito,
        introducao: validated.introducao,
        condicoesPagamento: paymentSummary || null,
        termosGarantia: validated.termosGarantia,
        observacoesInternas: validated.observacoesInternas,
        subtotalBruto: paraDecimal(subtotalBrutoCentavos),
        descontoTotal: paraDecimal(descontoTotalCentavos),
        valorTotal: paraDecimal(valorTotalCentavos),
        status,
        itens: {
          create: itensComCentavos.map((item) => ({
            descricao: item.descricao,
            quantidade: item.quantidade,
            precoUnitario: paraDecimal(item.precoUnitarioCentavos),
            descontoPercentual: item.descontoPercentual,
            subtotal: paraDecimal(item.linhaSubtotalCentavos),
          })),
        },
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/crm/propostas");

    return {
      success: true,
      message:
        status === "RASCUNHO"
          ? "Proposta guardada como rascunho com sucesso!"
          : "Proposta guardada com sucesso!",
      propostaId: created.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message ?? "Dados inválidos para guardar a proposta.",
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Não foi possível guardar a proposta no banco de dados.",
      };
    }

    if (error instanceof Error && error.message.includes("Sessão")) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Erro ao guardar proposta:", error);

    return {
      success: false,
      message: "Não foi possível guardar a proposta.",
    };
  }
}

// ── Resposta do cliente ───────────────────────────────────────────────────────
//
// Nada disto existia. O enum `StatusPropostaComercial` tem quatro valores e a
// única ação do arquivo (`createProposta`) grava dois: APROVADA e REJEITADA
// eram inalcançáveis, e toda proposta ficava "ENVIADA" pra sempre. Por isso
// não havia taxa de conversão nenhuma pra mostrar — não existia o dado.

type ResultadoAcaoProposta = { sucesso: true; mensagem: string } | { sucesso: false; erro: string };

const respostaSchema = z.object({
  propostaId: z.string().uuid("Proposta inválida."),
  resposta: z.enum(["APROVADA", "REJEITADA"]),
  motivo: z
    .string()
    .trim()
    .max(500, "O motivo não pode passar de 500 caracteres.")
    .optional()
    .transform((valor) => (valor && valor.length > 0 ? valor : null)),
});

/**
 * Registra o que o cliente respondeu.
 *
 * O motivo é opcional mas pedido na recusa de propósito: orçamento perdido por
 * preço e orçamento perdido por prazo pedem reações opostas, e sem o motivo
 * toda recusa fica igual no histórico — o que equivale a não ter histórico.
 */
export async function responderProposta(entrada: {
  propostaId: string;
  resposta: "APROVADA" | "REJEITADA";
  motivo?: string;
}): Promise<ResultadoAcaoProposta> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "propostas.editar");
    const prisma = contexto.prisma;

    const validado = respostaSchema.parse(entrada);

    const proposta = await prisma.propostaComercial.findUnique({
      where: { id: validado.propostaId },
      select: { id: true, status: true, cliente: true, valorTotal: true },
    });

    if (!proposta) {
      return { sucesso: false, erro: "Proposta não encontrada." };
    }

    if (!podeRegistrarResposta(proposta.status as StatusProposta)) {
      // Reabrir uma proposta fechada tira ela da taxa de conversão e volta a
      // cobrar follow-up. É decisão com consequência, não um clique no mesmo
      // menu — então aqui só recusa e explica.
      return {
        sucesso: false,
        erro:
          proposta.status === "APROVADA"
            ? "Esta proposta já está aprovada."
            : "Esta proposta já está marcada como recusada.",
      };
    }

    const agora = agoraNaLoja(contexto.fusoHorario);

    await prisma.$transaction(async (transaction) => {
      await transaction.propostaComercial.update({
        where: { id: proposta.id },
        data: {
          status: validado.resposta,
          respondidaEm: agora,
          motivoResposta: validado.motivo,
          // A proposta saiu do fluxo: cobrar contato dela viraria ruído na
          // lista de quem precisa de atenção.
          proximoContato: null,
        },
      });

      await registrarLogAuditoria(
        transaction,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/propostas.ts:responderProposta"
        ),
        {
          acao: ACOES_AUDITORIA.RESPONDER_PROPOSTA,
          entidade: ENTIDADES_AUDITORIA.PROPOSTA,
          entidadeId: proposta.id,
          dadosAntes: { statusAnterior: proposta.status },
          dadosDepois: {
            statusNovo: validado.resposta,
            cliente: proposta.cliente,
            valorTotal: paraMoeda(deDecimal(proposta.valorTotal)),
          },
          motivo: validado.motivo,
        }
      );
    });

    revalidatePath("/crm/propostas");
    revalidatePath(`/crm/propostas/${proposta.id}`);

    return {
      sucesso: true,
      mensagem:
        validado.resposta === "APROVADA"
          ? "Proposta aprovada. Dá pra gerar a ordem de serviço a partir dela."
          : "Recusa registrada.",
    };
  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return { sucesso: false, erro: erro.issues[0]?.message ?? "Dados inválidos." };
    }
    console.error("Erro ao registrar resposta da proposta:", erro);
    return { sucesso: false, erro: "Não foi possível registrar a resposta." };
  }
}

/**
 * Marca um rascunho como enviado ao cliente.
 *
 * Grava `enviadaEm` separado da emissão porque são relógios diferentes: a
 * validade conta da emissão, o follow-up conta de quando a proposta saiu daqui.
 * Uma proposta emitida segunda e mandada na quinta tem três dias de validade
 * já queimados sem o cliente ter visto nada.
 */
export async function marcarPropostaComoEnviada(
  propostaId: string
): Promise<ResultadoAcaoProposta> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "propostas.editar");
    const prisma = contexto.prisma;

    const proposta = await prisma.propostaComercial.findUnique({
      where: { id: propostaId },
      select: { id: true, status: true },
    });

    if (!proposta) {
      return { sucesso: false, erro: "Proposta não encontrada." };
    }

    if (!podeMarcarComoEnviada(proposta.status as StatusProposta)) {
      return { sucesso: false, erro: "Só um rascunho pode ser marcado como enviado." };
    }

    const agora = agoraNaLoja(contexto.fusoHorario);

    await prisma.$transaction(async (transaction) => {
      await transaction.propostaComercial.update({
        where: { id: proposta.id },
        data: { status: "ENVIADA", enviadaEm: agora },
      });

      await registrarLogAuditoria(
        transaction,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/propostas.ts:marcarPropostaComoEnviada"
        ),
        {
          acao: ACOES_AUDITORIA.ENVIAR_PROPOSTA,
          entidade: ENTIDADES_AUDITORIA.PROPOSTA,
          entidadeId: proposta.id,
          dadosAntes: { statusAnterior: proposta.status },
          dadosDepois: { statusNovo: "ENVIADA" },
        }
      );
    });

    revalidatePath("/crm/propostas");
    revalidatePath(`/crm/propostas/${proposta.id}`);

    return { sucesso: true, mensagem: "Proposta marcada como enviada." };
  } catch (erro) {
    console.error("Erro ao marcar proposta como enviada:", erro);
    return { sucesso: false, erro: "Não foi possível marcar a proposta como enviada." };
  }
}

/**
 * Marca (ou limpa) a data do próximo contato.
 *
 * `proximoContato` já existia no banco e não aparecia em tela nenhuma: era um
 * campo que só o formulário escrevia e ninguém lia. A lista agora destaca quem
 * está com contato atrasado, então dá pra reagendar direto dali.
 */
export async function agendarProximoContato(
  propostaId: string,
  /** "yyyy-MM-dd" ou `null` pra limpar. */
  dataIso: string | null
): Promise<ResultadoAcaoProposta> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "propostas.editar");
    const prisma = contexto.prisma;

    let novaData: Date | null = null;

    if (dataIso !== null) {
      novaData = dataDeCalendario(dataIso);
      if (!novaData) {
        return { sucesso: false, erro: "Data de contato inválida." };
      }
    }

    const proposta = await prisma.propostaComercial.findUnique({
      where: { id: propostaId },
      select: { id: true, status: true, proximoContato: true },
    });

    if (!proposta) {
      return { sucesso: false, erro: "Proposta não encontrada." };
    }

    if (!podeRegistrarResposta(proposta.status as StatusProposta)) {
      return { sucesso: false, erro: "Esta proposta já foi respondida pelo cliente." };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.propostaComercial.update({
        where: { id: proposta.id },
        data: { proximoContato: novaData },
      });

      await registrarLogAuditoria(
        transaction,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/propostas.ts:agendarProximoContato"
        ),
        {
          acao: ACOES_AUDITORIA.AGENDAR_CONTATO_PROPOSTA,
          entidade: ENTIDADES_AUDITORIA.PROPOSTA,
          entidadeId: proposta.id,
          dadosAntes: { proximoContatoAnterior: proposta.proximoContato?.toISOString() ?? null },
          dadosDepois: { proximoContato: novaData?.toISOString() ?? null },
        }
      );
    });

    revalidatePath("/crm/propostas");
    revalidatePath(`/crm/propostas/${proposta.id}`);

    return {
      sucesso: true,
      mensagem: novaData ? "Próximo contato marcado." : "Lembrete de contato removido.",
    };
  } catch (erro) {
    console.error("Erro ao agendar próximo contato da proposta:", erro);
    return { sucesso: false, erro: "Não foi possível marcar o próximo contato." };
  }
}

type ResultadoClone =
  | { sucesso: true; mensagem: string; propostaId: string }
  | { sucesso: false; erro: string };

/**
 * Duplica uma proposta como rascunho novo.
 *
 * Numa assistência o mesmo orçamento se repete muito (troca de tela do mesmo
 * modelo), e redigitar sete itens é o que faz o orçamento sair com erro de
 * preço. O clone vem como RASCUNHO, com emissão hoje e a validade recontada
 * pela mesma janela de dias da original — copiar a validade antiga criaria uma
 * proposta nova já vencida.
 */
export async function clonarProposta(propostaId: string): Promise<ResultadoClone> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "propostas.editar");
    const prisma = contexto.prisma;

    const original = await prisma.propostaComercial.findUnique({
      where: { id: propostaId },
      include: { itens: true },
    });

    if (!original) {
      return { sucesso: false, erro: "Proposta não encontrada." };
    }

    const hoje = hojeComoDataDeCalendario(contexto.fusoHorario);
    const emissaoOriginal = comoDataDeCalendario(original.dataEmissao, contexto.fusoHorario);
    const validadeOriginal = comoDataDeCalendario(original.validade, contexto.fusoHorario);

    const janelaEmDias = Math.max(
      1,
      Math.round((validadeOriginal.getTime() - emissaoOriginal.getTime()) / 86_400_000)
    );

    const criada = await prisma.propostaComercial.create({
      data: {
        cliente: original.cliente,
        aosCuidados: original.aosCuidados,
        dataEmissao: hoje,
        validade: somarDiasEmDataDeCalendario(hoje, janelaEmDias),
        // Lembrete de contato é da negociação antiga; a nova ainda não tem uma.
        proximoContato: null,
        equipamento: original.equipamento,
        defeito: original.defeito,
        introducao: original.introducao,
        condicoesPagamento: original.condicoesPagamento,
        termosGarantia: original.termosGarantia,
        observacoesInternas: original.observacoesInternas,
        subtotalBruto: original.subtotalBruto,
        descontoTotal: original.descontoTotal,
        valorTotal: original.valorTotal,
        status: "RASCUNHO",
        itens: {
          create: original.itens.map((item) => ({
            descricao: item.descricao,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            descontoPercentual: item.descontoPercentual,
            subtotal: item.subtotal,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/crm/propostas");

    return {
      sucesso: true,
      mensagem: "Cópia criada como rascunho.",
      propostaId: criada.id,
    };
  } catch (erro) {
    console.error("Erro ao clonar proposta:", erro);
    return { sucesso: false, erro: "Não foi possível duplicar a proposta." };
  }
}

// ── Lista e indicadores ───────────────────────────────────────────────────────

export type { FiltroSituacaoProposta, OrdemProposta } from "@/lib/propostas/consulta";


export type LinhaProposta = {
  id: string;
  cliente: string;
  equipamento: string | null;
  dataEmissao: string;
  validade: string;
  proximoContato: string | null;
  valorTotal: number;
  status: StatusProposta;
  quantidadeItens: number;
};

export type PaginaDePropostas = {
  dados: LinhaProposta[];
  total: number;
  pagina: number;
  totalDePaginas: number;
};


export async function listarPropostasPaginado(parametros: {
  pagina?: number;
  limite?: number;
  busca?: string;
  situacao?: FiltroSituacaoProposta;
  ordem?: OrdemProposta;
}): Promise<PaginaDePropostas> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "crm.ver");
  const prisma = contexto.prisma;

  const pagina = Math.max(1, Math.trunc(parametros.pagina ?? 1));
  const limite = Math.min(100, Math.max(1, Math.trunc(parametros.limite ?? 20)));
  const situacao = parametros.situacao ?? "EM_ABERTO";
  const ordem = parametros.ordem ?? "urgencia";
  // "yyyy-MM-dd" no fuso da LOJA. Vai como texto pro SQL de propósito: um
  // parâmetro de texto convertido pra `date` não depende do TimeZone da sessão
  // do Postgres, enquanto um timestamp convertido pra `date` depende — e isso
  // deslocaria "vence hoje" num dia conforme a configuração do servidor.
  const hojeIso = hojeComoDataDeCalendario(contexto.fusoHorario).toISOString().slice(0, 10);

  const onde = Prisma.sql`
    ${filtroDeSituacao(situacao, hojeIso)}
    AND ${filtroDeBusca(parametros.busca)}`;

  const [contagem, linhasOrdenadas] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM "PropostaComercial" WHERE ${onde}
    `,
    // A ordenação precisa sair do banco junto com a paginação, então os ids
    // vêm da consulta crua e os dados tipados vêm de um findMany reordenado
    // por essa lista. O findMany é quem converte os Decimal corretamente.
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "PropostaComercial"."id" FROM "PropostaComercial"
      WHERE ${onde}
      ORDER BY ${ordenacao(ordem, hojeIso)}
      LIMIT ${limite} OFFSET ${(pagina - 1) * limite}
    `,
  ]);

  const total = Number(contagem[0]?.total ?? 0);
  const ids = linhasOrdenadas.map((linha) => String(linha.id));

  if (ids.length === 0) {
    return { dados: [], total, pagina, totalDePaginas: Math.max(1, Math.ceil(total / limite)) };
  }

  const propostas = await prisma.propostaComercial.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      cliente: true,
      equipamento: true,
      dataEmissao: true,
      validade: true,
      proximoContato: true,
      valorTotal: true,
      status: true,
      _count: { select: { itens: true } },
    },
  });

  const porId = new Map(propostas.map((proposta) => [proposta.id, proposta]));

  const dados: LinhaProposta[] = ids
    .map((id) => porId.get(id))
    .filter((proposta): proposta is NonNullable<typeof proposta> => proposta !== undefined)
    .map((proposta) => ({
      id: proposta.id,
      cliente: proposta.cliente,
      equipamento: proposta.equipamento,
      dataEmissao: proposta.dataEmissao.toISOString(),
      validade: proposta.validade.toISOString(),
      proximoContato: proposta.proximoContato?.toISOString() ?? null,
      valorTotal: paraMoeda(deDecimal(proposta.valorTotal)),
      status: proposta.status as StatusProposta,
      quantidadeItens: proposta._count.itens,
    }));

  return { dados, total, pagina, totalDePaginas: Math.max(1, Math.ceil(total / limite)) };
}

export type IndicadoresPropostas = {
  /** Quantas ainda dependem de resposta do cliente. */
  emAberto: number;
  /** Soma do que está em aberto, em reais. É o dinheiro que ainda pode entrar. */
  valorEmAberto: number;
  /** Vence hoje ou nos próximos dias — ainda dá pra ligar. */
  vencendo: number;
  /** A validade passou e ninguém respondeu. */
  vencidas: number;
  /** Follow-up marcado pra hoje ou pra trás. */
  contatosAtrasados: number;
  /** Percentual de aprovadas sobre as RESPONDIDAS. `null` sem nenhuma resposta. */
  taxaDeConversao: number | null;
  aprovadas: number;
  rejeitadas: number;
};

/**
 * Indicadores da tela. Cada um existe por uma pergunta que o dono faz:
 * quanto ainda pode entrar, o que preciso ligar hoje, e de cada dez orçamentos
 * quantos eu fecho. Nenhum deles é contagem que a lista logo abaixo já mostra.
 */
export async function obterIndicadoresPropostas(): Promise<IndicadoresPropostas> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "crm.ver");
  const prisma = contexto.prisma;
  const hoje = hojeComoDataDeCalendario(contexto.fusoHorario);

  // Carrega as abertas inteiras em memória porque "vencendo"/"vencida" dependem
  // da comparação com hoje no fuso da loja, e a conta fica em UM lugar
  // (`calcularSituacao`) em vez de virar um segundo CASE em SQL. São só as
  // propostas em aberto — dezenas, no tamanho de uma assistência. Se um dia
  // passar de alguns milhares, isto vira contagem agregada no banco.
  const abertas = await prisma.propostaComercial.findMany({
    where: { status: { in: ["RASCUNHO", "ENVIADA"] } },
    select: { status: true, validade: true, proximoContato: true, valorTotal: true },
  });

  const [aprovadas, rejeitadas] = await Promise.all([
    prisma.propostaComercial.count({ where: { status: "APROVADA" } }),
    prisma.propostaComercial.count({ where: { status: "REJEITADA" } }),
  ]);

  let valorEmAbertoCentavos = 0;
  let vencendo = 0;
  let vencidas = 0;
  let contatosAtrasados = 0;

  for (const proposta of abertas) {
    valorEmAbertoCentavos = somar(valorEmAbertoCentavos, deDecimal(proposta.valorTotal));

    const calculada = calcularSituacao({
      status: proposta.status as StatusProposta,
      validade: comoDataDeCalendario(proposta.validade, contexto.fusoHorario),
      proximoContato: proposta.proximoContato
        ? comoDataDeCalendario(proposta.proximoContato, contexto.fusoHorario)
        : null,
      hoje,
    });

    if (calculada.situacao === "VENCENDO") vencendo += 1;
    if (calculada.situacao === "VENCIDA") vencidas += 1;
    if (calculada.contatoAtrasado) contatosAtrasados += 1;
  }

  return {
    emAberto: abertas.length,
    valorEmAberto: paraMoeda(valorEmAbertoCentavos),
    vencendo,
    vencidas,
    contatosAtrasados,
    taxaDeConversao: calcularTaxaDeConversao({ aprovadas, rejeitadas }),
    aprovadas,
    rejeitadas,
  };
}
