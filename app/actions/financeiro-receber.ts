"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { escopoContaReceber } from "@/lib/auth/escopos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { paraMensagemSegura } from "@/lib/erros";
import { comoDataDeCalendario, dataDeCalendario, FUSO_HORARIO_PADRAO, fimDoMes, inicioDoMes } from "@/lib/datas";

/**
 * Antes, criarContaReceber/darBaixaConta/editarContaReceber/excluirContaReceber
 * so lancavam erro sem nenhum catch — a mensagem (inclusive a de
 * ErroPermissao) dependia do Next nao a descartar ao cruzar a fronteira da
 * action, o que nao e garantido. Agora cada uma delega para uma "*Interno"
 * que continua lancando normalmente, mas a funcao publica captura e devolve
 * a mensagem como dado (Fase 1B-UI, Parte 1).
 */
export type ResultadoAcaoContaReceber = { sucesso: true } | { sucesso: false; mensagem: string };

function paraCentavos(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100);
}

function paraMoeda(centavos: number) {
  return centavos / 100;
}

function adicionarMeses(dataBase: Date, meses: number) {
  const data = new Date(dataBase);
  const diaOriginal = data.getDate();

  data.setMonth(data.getMonth() + meses, 1);
  const ultimoDiaMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(diaOriginal, ultimoDiaMes));

  return data;
}

export interface ContaReceberFinanceiro {
  id: string;
  descricao: string;
  valor: number;
  observacaoLancamento: string | null;
  observacaoPagamento: string | null;
  parcelamentoId: string | null;
  numeroParcela: number;
  totalParcelas: number;
  dataInicio: Date | null;
  dataFinalizacao: Date | null;
  clienteId: string | null;
  vendaId: string | null;
  dataVencimento: Date;
  dataRecebimento: Date | null;
  status: "PENDENTE" | "PAGO" | "RECEBIDO" | "ATRASADO" | "RENEGOCIADO";
  formaRecebimento:
    | "PIX"
    | "TED"
    | "BOLETO"
    | "CARTAO_CREDITO"
    | "CARTAO_CREDITO_AVISTA"
    | "CARTAO_CREDITO_PARCELADO"
    | "CARTAO_DEBITO"
    | "DINHEIRO"
    | "CREDIARIO"
    | "EMPENHO_PUBLICO";
  cliente: {
    nomeRazaoSocial: string;
  } | null;
}

export async function listarContasReceber(): Promise<ContaReceberFinanceiro[]> {
  // Leitura: sem sessao valida nao expoe dados financeiros.
  let contexto: Awaited<ReturnType<typeof exigirContextoTenant>>;
  try {
    contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.ver");
  } catch {
    return [];
  }
  const prisma = contexto.prisma;

  const contas = await prisma.contaReceber.findMany({
    where: escopoContaReceber(contexto),
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
    },
    orderBy: [{ dataVencimento: "asc" }, { numeroParcela: "asc" }],
  });

  const prioridadePorStatus: Record<ContaReceberFinanceiro["status"], number> = {
    PENDENTE: 0,
    ATRASADO: 1,
    RENEGOCIADO: 2,
    PAGO: 3,
    RECEBIDO: 4,
  };

  return contas.sort((a, b) => {
    const prioridadeA = prioridadePorStatus[a.status];
    const prioridadeB = prioridadePorStatus[b.status];

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    return a.dataVencimento.getTime() - b.dataVencimento.getTime();
  });
}

export interface CriarContaReceberInput {
  descricao: string;
  valorTotal: number;
  clienteId?: string;
  qtdParcelas: number;
  dataInicio: Date;
  dataVencimentoPrimeiraParcela: Date;
  formaRecebimento: ContaReceberFinanceiro["formaRecebimento"];
  observacaoLancamento?: string;
}

export async function criarContaReceber(
  input: CriarContaReceberInput
): Promise<ResultadoAcaoContaReceber> {
  try {
    await criarContaReceberInterno(input);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function criarContaReceberInterno(input: CriarContaReceberInput): Promise<void> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.lancar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  const qtdParcelas = Math.max(1, Math.trunc(input.qtdParcelas || 1));
  const valorTotalCentavos = paraCentavos(input.valorTotal);

  if (valorTotalCentavos <= 0) {
    throw new Error("Valor total invalido para criar conta a receber.");
  }

  const valorBaseCentavos = Math.floor(valorTotalCentavos / qtdParcelas);
  const restoCentavos = valorTotalCentavos - valorBaseCentavos * qtdParcelas;
  const parcelamentoId = qtdParcelas > 1 ? crypto.randomUUID() : null;
  const observacaoLancamento = input.observacaoLancamento?.trim() || null;

  const contas = Array.from({ length: qtdParcelas }).map((_, indice) => {
    const valorParcelaCentavos = valorBaseCentavos + (indice < restoCentavos ? 1 : 0);

    return {
      descricao: input.descricao,
      valor: paraMoeda(valorParcelaCentavos),
      clienteId: input.clienteId || null,
      dataVencimento: adicionarMeses(input.dataVencimentoPrimeiraParcela, indice),
      formaRecebimento: input.formaRecebimento,
      origem: "AVULSO" as const,
      status: "PENDENTE" as const,
      observacaoLancamento,
      parcelamentoId,
      numeroParcela: indice + 1,
      totalParcelas: qtdParcelas,
      dataInicio: input.dataInicio,
      dataFinalizacao: null,
      criadoPorId: usuario.id || null,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.contaReceber.createMany({ data: contas });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:criarContaReceber"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
        dadosDepois: {
          descricao: input.descricao,
          valorTotal: input.valorTotal,
          clienteId: input.clienteId ?? null,
          qtdParcelas,
          formaRecebimento: input.formaRecebimento,
          parcelamentoId,
        },
      }
    );
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/");
}

type PrismaTenant = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];
type PrismaTx = Parameters<Parameters<PrismaTenant["$transaction"]>[0]>[0];

export async function darBaixaConta(
  id: string,
  observacaoPagamento?: string
): Promise<ResultadoAcaoContaReceber> {
  try {
    await darBaixaContaInterno(id, observacaoPagamento);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function darBaixaContaInterno(id: string, observacaoPagamento?: string): Promise<void> {
  // C1: exige sessao valida antes de registrar recebimento.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.baixar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  await prisma.$transaction((tx) => aplicarBaixaConta(tx, id, observacaoPagamento, usuario));

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/");
}

/**
 * Núcleo de "dar baixa", sem abrir transação própria — usada tanto pelo
 * caminho de uma conta só (`darBaixaContaInterno`, que abre a transação em
 * volta dela) quanto pelo lote (Fase 3-2D, Parte 5: várias chamadas dentro
 * de UMA `$transaction` só, pra ficar tudo-ou-nada). É a MESMA validação
 * nos dois casos — não existe um segundo caminho de baixa.
 */
async function aplicarBaixaConta(
  tx: PrismaTx,
  id: string,
  observacaoPagamento: string | undefined,
  usuario: { id?: string | null } | null | undefined
): Promise<{ valor: number }> {
  const momentoBaixa = new Date();
  const observacao = observacaoPagamento?.trim() || null;

  const contaAtual = await tx.contaReceber.findUnique({
    where: { id },
    select: { id: true, valor: true, parcelamentoId: true, status: true, dataRecebimento: true },
  });

  if (!contaAtual) {
    throw new Error("Conta a receber nao encontrada.");
  }

  if (contaAtual.status === "RECEBIDO") {
    throw new Error("Esta conta ja foi recebida.");
  }

  await tx.contaReceber.update({
    where: { id },
    data: {
      status: "RECEBIDO",
      dataRecebimento: momentoBaixa,
      observacaoPagamento: observacao,
      dataFinalizacao: contaAtual.parcelamentoId ? null : momentoBaixa,
    },
  });

  if (!contaAtual.parcelamentoId) {
    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:darBaixaConta"),
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
        entidadeId: id,
        dadosAntes: {
          status: contaAtual.status,
          dataRecebimento: contaAtual.dataRecebimento,
        },
        dadosDepois: {
          status: "RECEBIDO",
          dataRecebimento: momentoBaixa,
          observacaoPagamento: observacao,
        },
      }
    );
    return { valor: contaAtual.valor };
  }

  const pendentesNoGrupo = await tx.contaReceber.count({
    where: {
      parcelamentoId: contaAtual.parcelamentoId,
      status: {
        not: "RECEBIDO",
      },
    },
  });

  if (pendentesNoGrupo === 0) {
    await tx.contaReceber.updateMany({
      where: {
        parcelamentoId: contaAtual.parcelamentoId,
      },
      data: {
        dataFinalizacao: momentoBaixa,
      },
    });
  }

  await registrarLogAuditoria(
    tx,
    contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:darBaixaConta"),
    {
      acao: ACOES_AUDITORIA.FINALIZAR,
      entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
      entidadeId: id,
      dadosAntes: {
        status: contaAtual.status,
        dataRecebimento: contaAtual.dataRecebimento,
      },
      dadosDepois: {
        status: "RECEBIDO",
        dataRecebimento: momentoBaixa,
        observacaoPagamento: observacao,
        parcelamentoId: contaAtual.parcelamentoId,
      },
    }
  );

  return { valor: contaAtual.valor };
}

export type ResultadoAcaoLote =
  | { sucesso: true; quantidade: number; total: number }
  | { sucesso: false; mensagem: string };

/**
 * Dar baixa em várias contas de uma vez (Fase 3-2D, Parte 5). UMA
 * transação pro lote inteiro — se uma conta falhar (já recebida, excluída
 * por outra aba entre a seleção e a confirmação, etc.), NENHUMA muda:
 * tudo-ou-nada, não "passou o que deu". A mensagem de erro nomeia a conta
 * que falhou. Mesma observação (opcional) pra todas — sem valor por conta
 * customizado em lote, de propósito.
 */
export async function darBaixaContasEmLote(
  ids: string[],
  observacaoPagamento?: string
): Promise<ResultadoAcaoLote> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.baixar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  const idsUnicos = Array.from(new Set(ids.filter((id) => id.trim().length > 0)));

  if (idsUnicos.length === 0) {
    return { sucesso: false, mensagem: "Selecione ao menos uma conta para dar baixa." };
  }

  try {
    const totalCentavos = await prisma.$transaction(async (tx) => {
      let acumuladoCentavos = 0;

      for (const id of idsUnicos) {
        const { valor } = await aplicarBaixaConta(tx, id, observacaoPagamento, usuario);
        acumuladoCentavos += paraCentavos(valor);
      }

      const idLote = crypto.randomUUID();
      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:darBaixaContasEmLote"),
        {
          acao: ACOES_AUDITORIA.FINALIZAR_LOTE,
          entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
          entidadeId: idLote,
          dadosDepois: {
            contasIds: idsUnicos,
            quantidade: idsUnicos.length,
            total: paraMoeda(acumuladoCentavos),
            observacaoPagamento: observacaoPagamento?.trim() || null,
          },
        }
      );

      return acumuladoCentavos;
    });

    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/");

    return { sucesso: true, quantidade: idsUnicos.length, total: paraMoeda(totalCentavos) };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

// ── Editar Conta a Receber ────────────────────────────────────────────────────

export interface EditarContaReceberInput {
  dataVencimento: Date;
  valor: number;
}

/**
 * Atualiza o vencimento e o valor de uma conta a receber ainda não baixada.
 * Só permite editar contas com status PENDENTE.
 */
export async function editarContaReceber(
  id: string,
  input: EditarContaReceberInput
): Promise<ResultadoAcaoContaReceber> {
  try {
    await editarContaReceberInterno(id, input);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function editarContaReceberInterno(id: string, input: EditarContaReceberInput): Promise<void> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.editar");
  const { prisma } = contexto;

  const conta = await prisma.contaReceber.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!conta) throw new Error("Conta não encontrada.");
  if (conta.status === "RECEBIDO") {
    throw new Error("Não é possível editar uma conta já baixada.");
  }

  await prisma.contaReceber.update({
    where: { id },
    data: {
      dataVencimento: input.dataVencimento,
      valor: input.valor,
    },
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/");
}

// ── Excluir Conta a Receber ───────────────────────────────────────────────────

/**
 * Remove uma conta a receber do banco.
 * Contas vinculadas a vendas não podem ser excluídas manualmente.
 */
export async function excluirContaReceber(id: string): Promise<ResultadoAcaoContaReceber> {
  try {
    await excluirContaReceberInterno(id);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function excluirContaReceberInterno(id: string): Promise<void> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.excluir");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  await prisma.$transaction(async (tx) => {
    const conta = await tx.contaReceber.findUnique({
      where: { id },
      select: { id: true, vendaId: true, status: true, valor: true },
    });

    if (!conta) throw new Error("Conta não encontrada.");
    if (conta.vendaId) {
      throw new Error(
        "Esta conta está vinculada a uma venda e não pode ser excluída manualmente."
      );
    }

    // TODO: em migracao futura, priorizar cancelamento/soft-delete para trilha financeira mais robusta.
    await tx.contaReceber.delete({ where: { id } });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:excluirContaReceber"),
      {
        acao: ACOES_AUDITORIA.EXCLUIR_FISICO,
        entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
        entidadeId: id,
        dadosAntes: {
          status: conta.status,
          valor: conta.valor,
        },
        dadosDepois: null,
      }
    );
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/");
}

// ── Tipos e funções para consulta filtrada ──────────────────────────────────

export interface FiltrosReceber {
  /** Início/fim do período (DATA DE CALENDÁRIO, "yyyy-MM-dd") — vem do componente `FiltroPeriodo` (Fase 2A-1), filtra `dataVencimento`. */
  inicio?: string;
  fim?: string;
  categoriaCliente?: string;
  /**
   * Ignora a janela de período — todas as contas, de qualquer período
   * (Fase 3-2D). Usado pelos indicadores "em aberto" da Visão geral
   * (`app/actions/financeiro-hub.ts`), chamado direto no código — a tela de
   * Contas a Receber não expõe mais isso como opção pro usuário desde a
   * adoção do `FiltroPeriodo` (Fase 2A-1): "Período customizado" com um
   * intervalo bem largo cobre o mesmo caso de uso pela UI.
   */
  todoPeriodo?: boolean;
}

export interface ResumoReceber {
  /** Total de contas pendentes (não vencidas) */
  totalPendente: number;
  /** Total de contas vencidas e não recebidas */
  totalAtrasado: number;
  /** Total de contas recebidas no período */
  totalRecebido: number;
  /** Total geral do período (todos os status) */
  totalPeriodo: number;
}

/**
 * Retorna as contas a receber com filtros opcionais por período e categoria de cliente.
 * Adequado para chamadas em Server Components (page.tsx).
 */
export async function listarContasReceberFiltradas(
  filtros?: FiltrosReceber
): Promise<ContaReceberFinanceiro[]> {
  let contexto: Awaited<ReturnType<typeof exigirContextoTenant>>;
  try {
    contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.ver");
  } catch {
    return [];
  }
  const prisma = contexto.prisma;

  const where: Record<string, unknown> = { ...escopoContaReceber(contexto) };

  // `dataVencimento` é DATA DE CALENDÁRIO (meia-noite UTC) — `inicio`/`fim`
  // (yyyy-MM-dd) comparam direto, sem inicioDoDia/fimDoDia (que resolveriam
  // fronteira de INSTANTE, não de calendário). todoPeriodo pula a janela
  // inteira — ver o comentário em `FiltrosReceber.todoPeriodo` acima.
  if (!filtros?.todoPeriodo) {
    const dataInicioFiltro = filtros?.inicio ? dataDeCalendario(filtros.inicio) : null;
    const dataFimFiltro = filtros?.fim ? dataDeCalendario(filtros.fim) : null;

    // Só usa o par vindo da URL quando os DOIS lados são válidos — um único
    // lado presente (URL adulterada/incompleta) cai pro mês inteiro, nunca
    // mistura um limite filtrado com um limite "mês atual" do outro lado.
    const [dataInicio, dataFim] =
      dataInicioFiltro && dataFimFiltro
        ? [dataInicioFiltro, dataFimFiltro]
        : [
            comoDataDeCalendario(inicioDoMes(new Date(), contexto.fusoHorario), contexto.fusoHorario),
            comoDataDeCalendario(fimDoMes(new Date(), contexto.fusoHorario), contexto.fusoHorario),
          ];

    where.dataVencimento = {
      gte: dataInicio,
      lte: dataFim,
    };
  }

  // Filtro por categoria de cliente
  if (filtros?.categoriaCliente) {
    where.cliente = {
      is: {
        categoria: filtros.categoriaCliente,
      },
    };
  }

  const contas = await prisma.contaReceber.findMany({
    where,
    include: {
      cliente: {
        select: { nomeRazaoSocial: true },
      },
    },
    orderBy: [{ dataVencimento: "asc" }, { numeroParcela: "asc" }],
  });

  const prioridadePorStatus: Record<ContaReceberFinanceiro["status"], number> = {
    PENDENTE: 0,
    ATRASADO: 1,
    RENEGOCIADO: 2,
    PAGO: 3,
    RECEBIDO: 4,
  };

  return (contas as unknown as ContaReceberFinanceiro[]).sort((a, b) => {
    const pa = prioridadePorStatus[a.status];
    const pb = prioridadePorStatus[b.status];
    if (pa !== pb) return pa - pb;
    return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
  });
}

/**
 * Calcula o resumo financeiro das contas a receber com base nos filtros.
 */
export async function obterResumoReceber(filtros?: FiltrosReceber): Promise<ResumoReceber> {
  const contas = await listarContasReceberFiltradas(filtros);

  let fusoHorario = FUSO_HORARIO_PADRAO;
  try {
    fusoHorario = (await exigirContextoTenant()).fusoHorario ?? FUSO_HORARIO_PADRAO;
  } catch {
    // Mesma tolerancia de listarContasReceberFiltradas acima: sem contexto
    // (chamada fora de requisicao autenticada), cai no fuso padrao.
  }

  // `dataVencimento` é DATA DE CALENDÁRIO — comparar contra "hoje" precisa
  // da mesma convenção (meia-noite UTC), não meia-noite do fuso da loja
  // como instante. Ver lib/datas.ts (`comoDataDeCalendario`).
  const hoje = comoDataDeCalendario(new Date(), fusoHorario);

  let totalPendente = 0;
  let totalAtrasado = 0;
  let totalRecebido = 0;
  let totalPeriodo = 0;

  for (const conta of contas) {
    totalPeriodo += conta.valor;
    // dataVencimento já é uma DATA DE CALENDÁRIO (meia-noite UTC) — nunca
    // reconverter via comoDataDeCalendario, que assumiria um instante
    // qualquer e deslocaria o dia. Compara direto contra `hoje`, que já
    // está na mesma convenção.
    const vencimento = conta.dataVencimento;

    if (conta.status === "RECEBIDO") {
      totalRecebido += conta.valor;
    } else if (conta.status === "ATRASADO" || vencimento < hoje) {
      totalAtrasado += conta.valor;
    } else if (conta.status === "PENDENTE" || conta.status === "RENEGOCIADO") {
      totalPendente += conta.valor;
    }
  }

  return { totalPendente, totalAtrasado, totalRecebido, totalPeriodo };
}
