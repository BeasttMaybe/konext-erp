"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { escopoDespesa } from "@/lib/auth/escopos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import {
  contextoAuditoriaDoUsuario,
  registrarLogAuditoria,
  registrarLogsAuditoriaEmLote,
} from "@/lib/auditoria";
import { paraMensagemSegura } from "@/lib/erros";
import { comoDataDeCalendario, dataDeCalendario, FUSO_HORARIO_PADRAO, fimDoMes, inicioDoMes } from "@/lib/datas";
import { deDecimal, dividirEmParcelas, paraDecimal, paraMoeda, somar } from "@/lib/dinheiro";

/** Ver o comentario equivalente em financeiro-receber.ts (Fase 1B-UI, Parte 1). */
export type ResultadoAcaoDespesa = { sucesso: true } | { sucesso: false; mensagem: string };

export type TipoDespesa = "UNICA" | "PARCELADA" | "FIXA_MENSAL";
export type StatusParcelaDespesa = "PENDENTE" | "PAGO" | "ATRASADO";

export interface DadosCriarDespesa {
  fornecedor: string;
  clienteId?: string;
  descricao: string;
  valorTotal: number;
  tipo: TipoDespesa;
  qtdParcelas?: number;
  dataVencimento: Date;
}

/**
 * A MESMA linha, do lado do banco: `valor`, `valorPago` e `valorTotal` chegam
 * como `Decimal` do Prisma. Separar os dois tipos e o que impede o cast
 * mentiroso de voltar — o compilador agora recusa tratar um como o outro.
 */
type DecimalPrisma = { toString(): string };

interface ParcelaDespesaPrisma extends Omit<ParcelaDespesaComRelacao, "valor" | "valorPago" | "despesa"> {
  valor: DecimalPrisma;
  valorPago: DecimalPrisma | null;
  despesa: Omit<ParcelaDespesaComRelacao["despesa"], "valorTotal"> & { valorTotal: DecimalPrisma };
}

export interface ParcelaDespesaComRelacao {
  id: string;
  despesaId: string;
  numeroParcela: number;
  valor: number;
  dataVencimento: Date;
  dataPagamento: Date | null;
  status: StatusParcelaDespesa;
  valorPago: number | null;
  criadoEm: Date;
  despesa: {
    id: string;
    clienteId: string | null;
    fornecedor: string;
    descricao: string;
    valorTotal: number;
    tipo: TipoDespesa;
    qtdParcelas: number;
    criadoEm: Date;
    atualizadoEm: Date;
    cliente: {
      id: string;
      nomeRazaoSocial: string;
      documento: string;
    } | null;
  };
}


type DelegateDespesaCreate = {
  create: (args: unknown) => Promise<{ id: string }>;
};

type DelegateParcelaDespesa = {
  createMany: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<ParcelaDespesaComRelacao[]>;
  update: (args: unknown) => Promise<unknown>;
};

type PrismaFinanceiroPagarAny = Record<string, unknown> & {
  despesa?: DelegateDespesaCreate;
  Despesa?: DelegateDespesaCreate;
  parcelaDespesa?: DelegateParcelaDespesa;
  ParcelaDespesa?: DelegateParcelaDespesa;
};

function obterDelegateDespesaCreate(
  tx: PrismaFinanceiroPagarAny,
  root: PrismaFinanceiroPagarAny
): DelegateDespesaCreate {
  const candidatos: Array<keyof PrismaFinanceiroPagarAny> = ["despesa", "Despesa"];

  for (const chave of candidatos) {
    const delegateTx = tx[chave] as DelegateDespesaCreate | undefined;
    if (delegateTx?.create) return delegateTx;

    const delegateRoot = root[chave] as DelegateDespesaCreate | undefined;
    if (delegateRoot?.create) return delegateRoot;
  }

  throw new Error("Delegate Prisma 'despesa' nao disponivel para operacao de create.");
}

function obterDelegateParcelaDespesa(
  tx: PrismaFinanceiroPagarAny,
  root: PrismaFinanceiroPagarAny
): DelegateParcelaDespesa {
  const candidatos: Array<keyof PrismaFinanceiroPagarAny> = [
    "parcelaDespesa",
    "ParcelaDespesa",
  ];

  for (const chave of candidatos) {
    const delegateTx = tx[chave] as DelegateParcelaDespesa | undefined;
    if (
      typeof delegateTx?.createMany === "function" &&
      typeof delegateTx?.findMany === "function" &&
      typeof delegateTx?.update === "function"
    )
      return delegateTx;

    const delegateRoot = root[chave] as DelegateParcelaDespesa | undefined;
    if (
      typeof delegateRoot?.createMany === "function" &&
      typeof delegateRoot?.findMany === "function" &&
      typeof delegateRoot?.update === "function"
    )
      return delegateRoot;
  }

  throw new Error(
    "Delegate Prisma 'parcelaDespesa' nao disponivel para operacoes de createMany/findMany/update."
  );
}

function adicionarMeses(dataBase: Date, meses: number): Date {
  return new Date(
    dataBase.getFullYear(),
    dataBase.getMonth() + meses,
    dataBase.getDate(),
    12,
    0,
    0,
    0
  );
}

function normalizarQtdParcelas(tipo: TipoDespesa, qtdParcelas?: number): number {
  if (tipo === "UNICA") return 1;

  if (typeof qtdParcelas !== "number" || Number.isNaN(qtdParcelas)) {
    return tipo === "FIXA_MENSAL" ? 12 : 2;
  }

  return Math.max(1, Math.trunc(qtdParcelas));
}

function gerarParcelas(
  tipo: TipoDespesa,
  valorTotal: number,
  qtdParcelas: number,
  dataVencimentoBase: Date
): Array<{ numeroParcela: number; valor: number; dataVencimento: Date; status: StatusParcelaDespesa }> {
  if (tipo === "UNICA") {
    return [
      {
        numeroParcela: 1,
        valor: valorTotal,
        dataVencimento: dataVencimentoBase,
        status: "PENDENTE",
      },
    ];
  }

  if (tipo === "FIXA_MENSAL") {
    return Array.from({ length: qtdParcelas }, (_, indice) => ({
      numeroParcela: indice + 1,
      valor: valorTotal,
      dataVencimento: adicionarMeses(dataVencimentoBase, indice),
      status: "PENDENTE" as const,
    }));
  }

  const totalCentavos = deDecimal(valorTotal);
  // Centavo-exato (Fase 2A-2 cont.): dividirEmParcelas (lib/dinheiro.ts) é o
  // único lugar autorizado a decidir como o resto em centavos é distribuído
  // — a divisão manual anterior chegava ao mesmo resultado (resto nas
  // primeiras parcelas) mas reimplementava a fórmula fora do módulo.
  const valoresParcelasCentavos = dividirEmParcelas(totalCentavos, qtdParcelas);

  return Array.from({ length: qtdParcelas }, (_, indice) => ({
    numeroParcela: indice + 1,
    valor: paraMoeda(valoresParcelasCentavos[indice]),
    dataVencimento: adicionarMeses(dataVencimentoBase, indice),
    status: "PENDENTE" as const,
  }));
}

export async function criarDespesa(data: DadosCriarDespesa): Promise<ResultadoAcaoDespesa> {
  try {
    await criarDespesaInterno(data);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function criarDespesaInterno(data: DadosCriarDespesa) {
  // C1: exige sessao valida antes de criar despesa.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.lancar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  const fornecedor = data.fornecedor.trim();
  const descricao = data.descricao.trim();

  if (!fornecedor) {
    throw new Error("Informe o fornecedor da despesa.");
  }

  if (!descricao) {
    throw new Error("Informe a descricao da despesa.");
  }

  if (!Number.isFinite(data.valorTotal) || data.valorTotal <= 0) {
    throw new Error("Informe um valor total valido.");
  }

  const qtdParcelas = normalizarQtdParcelas(data.tipo, data.qtdParcelas);
  const dataVencimentoBase = new Date(data.dataVencimento);

  if (Number.isNaN(dataVencimentoBase.getTime())) {
    throw new Error("Informe uma data de vencimento valida.");
  }

  return prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as PrismaFinanceiroPagarAny;
    const prismaAny = prisma as unknown as PrismaFinanceiroPagarAny;
    const despesaDelegate = obterDelegateDespesaCreate(txAny, prismaAny);
    const parcelaDespesaDelegate = obterDelegateParcelaDespesa(txAny, prismaAny);

    const despesa = await despesaDelegate.create({
      data: {
        fornecedor,
        clienteId: data.clienteId || null,
        descricao,
        valorTotal: data.valorTotal,
        tipo: data.tipo,
        qtdParcelas,
        criadoPorId: usuario.id || null,
      },
    });

    const parcelas = gerarParcelas(data.tipo, data.valorTotal, qtdParcelas, dataVencimentoBase);

    await parcelaDespesaDelegate.createMany({
      data: parcelas.map((parcela) => ({
        despesaId: despesa.id,
        numeroParcela: parcela.numeroParcela,
        valor: parcela.valor,
        dataVencimento: parcela.dataVencimento,
        status: parcela.status,
      })),
    });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:criarDespesa"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
        entidadeId: despesa.id,
        dadosDepois: {
          fornecedor,
          clienteId: data.clienteId || null,
          descricao,
          valorTotal: data.valorTotal,
          tipo: data.tipo,
          qtdParcelas,
          dataVencimentoBase,
        },
      }
    );

    revalidatePath("/financeiro/pagar");
    revalidatePath("/financeiro");
    revalidatePath("/");

    return despesa;
  });
}

export type DadosEditarDespesa = {
  fornecedor: string;
  descricao: string;
  clienteId?: string;
  /** Só aceito enquanto nenhuma parcela estiver paga — ver a regra abaixo. */
  valorTotal?: number;
  dataVencimento?: Date;
};

/**
 * Edita uma despesa.
 *
 * Duas camadas de regra, de propósito diferentes:
 *
 * - **Fornecedor, descrição e cliente** mudam sempre. São rótulos; corrigir um
 *   nome errado não reescreve história financeira nenhuma.
 * - **Valor e vencimento** só mudam enquanto NENHUMA parcela estiver paga.
 *   Alterar o valor de algo já pago faria o registro mentir sobre quanto saiu
 *   do caixa — e o certo nesse caso é lançar um ajuste, não reescrever o
 *   passado. Mesmo espírito de `editarContaReceber`, que recusa editar conta
 *   já baixada.
 */
export async function editarDespesa(
  id: string,
  data: DadosEditarDespesa
): Promise<ResultadoAcaoDespesa> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.editar");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    const fornecedor = data.fornecedor.trim();
    const descricao = data.descricao.trim();

    if (!fornecedor) throw new Error("Informe o fornecedor da despesa.");
    if (!descricao) throw new Error("Informe a descricao da despesa.");

    await prisma.$transaction(async (tx) => {
      const despesa = await tx.despesa.findUnique({
        where: { id },
        select: {
          id: true,
          fornecedor: true,
          descricao: true,
          clienteId: true,
          valorTotal: true,
          tipo: true,
          qtdParcelas: true,
          parcelas: {
            select: { id: true, status: true, numeroParcela: true },
            orderBy: { numeroParcela: "asc" },
          },
        },
      });

      if (!despesa) throw new Error("Despesa nao encontrada.");

      const temParcelaPaga = despesa.parcelas.some((parcela) => parcela.status === "PAGO");
      const querMudarValor = typeof data.valorTotal === "number";
      const querMudarVencimento = data.dataVencimento instanceof Date;

      if (temParcelaPaga && (querMudarValor || querMudarVencimento)) {
        throw new Error(
          "Esta despesa ja tem parcela paga: valor e vencimento nao podem ser alterados. " +
            "Para corrigir, lance um ajuste."
        );
      }

      if (querMudarValor && (!Number.isFinite(data.valorTotal) || (data.valorTotal ?? 0) <= 0)) {
        throw new Error("Informe um valor total valido.");
      }

      await tx.despesa.update({
        where: { id },
        data: {
          fornecedor,
          descricao,
          clienteId: data.clienteId || null,
          ...(querMudarValor ? { valorTotal: paraDecimal(deDecimal(data.valorTotal as number)) } : {}),
        },
      });

      // Valor novo precisa ser redistribuido entre as parcelas, em centavos
      // exatos — `dividirEmParcelas` e o unico lugar autorizado a partir um
      // total, e garante que a soma das partes seja igual ao todo.
      if (querMudarValor) {
        const valoresCentavos = dividirEmParcelas(
          deDecimal(data.valorTotal as number),
          despesa.parcelas.length
        );

        for (let indice = 0; indice < despesa.parcelas.length; indice += 1) {
          await tx.parcelaDespesa.update({
            where: { id: despesa.parcelas[indice].id },
            data: { valor: paraDecimal(valoresCentavos[indice]) },
          });
        }
      }

      if (querMudarVencimento) {
        // So a primeira parcela recebe a data informada; as demais mantem o
        // espacamento que ja tinham, porque remontar o calendario inteiro a
        // partir de uma edicao seria surpresa, nao correcao.
        const primeira = despesa.parcelas[0];
        if (primeira) {
          await tx.parcelaDespesa.update({
            where: { id: primeira.id },
            data: { dataVencimento: data.dataVencimento as Date },
          });
        }
      }

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:editarDespesa"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_STATUS,
          entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
          entidadeId: id,
          dadosAntes: {
            fornecedor: despesa.fornecedor,
            descricao: despesa.descricao,
            clienteId: despesa.clienteId,
            valorTotal: despesa.valorTotal,
          },
          dadosDepois: {
            fornecedor,
            descricao,
            clienteId: data.clienteId || null,
            valorTotal: querMudarValor ? data.valorTotal : despesa.valorTotal,
          },
        }
      );
    });

    revalidatePath("/financeiro/pagar");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/");

    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

/**
 * Exclui uma despesa e as suas parcelas.
 *
 * Nao bloqueia despesa com parcela paga, e isso e deliberado: desde que o custo
 * de peca passou a nascer quitado, bloquear ai impediria apagar um lancamento
 * errado — que e justamente o caso em que apagar faz falta. O que a exclusao
 * exige em troca e trilha: o registro de auditoria guarda a despesa inteira,
 * com todas as parcelas e as que estavam pagas, para que "sumiu" nunca seja uma
 * pergunta sem resposta.
 */
export async function excluirDespesa(id: string): Promise<ResultadoAcaoDespesa> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.excluir");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    await prisma.$transaction(async (tx) => {
      const despesa = await tx.despesa.findUnique({
        where: { id },
        select: {
          id: true,
          fornecedor: true,
          descricao: true,
          valorTotal: true,
          tipo: true,
          qtdParcelas: true,
          criadoEm: true,
          parcelas: {
            select: {
              numeroParcela: true,
              valor: true,
              status: true,
              dataVencimento: true,
              dataPagamento: true,
              valorPago: true,
            },
            orderBy: { numeroParcela: "asc" },
          },
        },
      });

      if (!despesa) throw new Error("Despesa nao encontrada.");

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:excluirDespesa"),
        {
          acao: ACOES_AUDITORIA.EXCLUIR_FISICO,
          entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
          entidadeId: id,
          // A despesa inteira, nao um resumo: depois do delete, isto e tudo o
          // que resta dela.
          dadosAntes: despesa,
          dadosDepois: null,
        }
      );

      // As parcelas vao junto por onDelete: Cascade no schema.
      await tx.despesa.delete({ where: { id } });
    });

    revalidatePath("/financeiro/pagar");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/");

    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

export async function listarParcelasPagar(): Promise<ParcelaDespesaComRelacao[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const prismaAny = prisma as unknown as PrismaFinanceiroPagarAny;
  const parcelaDespesaDelegate = obterDelegateParcelaDespesa(prismaAny, prismaAny);

  const parcelas = await parcelaDespesaDelegate.findMany({
    where: { despesa: { is: escopoDespesa(contexto) } },
    include: {
      despesa: {
        include: {
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              documento: true,
            },
          },
        },
      },
    },
    orderBy: {
      dataVencimento: "asc",
    },
  });

  return parcelas as ParcelaDespesaComRelacao[];
}

// ── Tipos e funções para consulta filtrada ──────────────────────────────────

export interface FiltrosPagar {
  /** Início/fim do período (DATA DE CALENDÁRIO, "yyyy-MM-dd") — vem do componente `FiltroPeriodo` (Fase 2A-1), filtra `dataVencimento`. */
  inicio?: string;
  fim?: string;
  categoriaCliente?: string;
  /**
   * Ignora a janela de período — todas as parcelas, de qualquer período
   * (Fase 3-2D). Usado pelos indicadores "em aberto" da Visão geral
   * (`app/actions/financeiro-hub.ts`), chamado direto no código — a tela de
   * Contas a Pagar não expõe mais isso como opção pro usuário desde a
   * adoção do `FiltroPeriodo` (Fase 2A-1): "Período customizado" com um
   * intervalo bem largo cobre o mesmo caso de uso pela UI.
   */
  todoPeriodo?: boolean;
}

export interface ResumoPagar {
  /** Total de parcelas pendentes (não vencidas) */
  totalPendente: number;
  /** Total de parcelas vencidas e não pagas */
  totalAtrasado: number;
  /** Total de parcelas com vencimento no dia de hoje */
  venceHoje: number;
  /** Total de parcelas no mês atual (ou no período filtrado) */
  totalPeriodo: number;
}

/**
 * Retorna as parcelas a pagar com filtros opcionais por período e categoria de cliente.
 * Adequado para chamadas em Server Components (page.tsx).
 *
 * Quando `inicio`/`fim` não vêm (ou vêm inválidos), aplica o mês corrente
 * (no fuso da loja) como padrão, evitando retornar registros de todos os
 * períodos sem filtragem — mesmo comportamento de antes da Fase 2A-1,
 * agora com `dataDeCalendario` em vez de `new Date(ano, mes-1, 1)` cru (que
 * construía a fronteira no fuso do PROCESSO, não no da loja).
 */
export async function listarParcelasPagarFiltradas(
  filtros?: FiltrosPagar
): Promise<ParcelaDespesaComRelacao[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  const where: Record<string, unknown> = {};

  // `dataVencimento` é DATA DE CALENDÁRIO (meia-noite UTC) — `inicio`/`fim`
  // (yyyy-MM-dd) comparam direto, sem inicioDoDia/fimDoDia (que resolveriam
  // fronteira de INSTANTE, não de calendário). todoPeriodo pula a janela
  // inteira — ver o comentário em `FiltrosPagar.todoPeriodo` acima.
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

  // Escopo de visibilidade (Fase 1D-2) + filtro por categoria de cliente,
  // os dois dentro do mesmo `despesa.is` — nunca dois filtros concorrentes
  // na mesma relacao.
  where.despesa = {
    is: {
      ...escopoDespesa(contexto),
      ...(filtros?.categoriaCliente
        ? { cliente: { is: { categoria: filtros.categoriaCliente } } }
        : {}),
    },
  };

  const parcelas = await prisma.parcelaDespesa.findMany({
    where,
    include: {
      despesa: {
        include: {
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              documento: true,
            },
          },
        },
      },
    },
    orderBy: { dataVencimento: "asc" },
  });

  return parcelas.map(converterParcelaParaTela);
}

/**
 * Converte a linha do Prisma para o formato que a tela consome.
 *
 * Existe porque antes havia `parcelas as unknown as ParcelaDespesaComRelacao[]`
 * no lugar. Aquele cast MENTIA para o TypeScript: o tipo declara `valor:
 * number`, mas o Prisma devolve `Decimal` nas 49 colunas de dinheiro do schema.
 * Como o compilador acreditava no tipo, ninguém via o problema — e somar
 * `Decimal` com `+` concatena texto em vez de somar. Era de onde saía o
 * "R$ 1.101.065.160,10" na tela de Contas a Pagar: "110" + "10" + "65"...
 *
 * A conversão acontece AQUI, na fronteira, e não em cada lugar que lê: é o
 * único ponto por onde esses dados saem do banco para a tela.
 */
function converterParcelaParaTela(parcela: ParcelaDespesaPrisma): ParcelaDespesaComRelacao {
  return {
    ...parcela,
    valor: paraMoeda(deDecimal(parcela.valor)),
    valorPago: parcela.valorPago === null ? null : paraMoeda(deDecimal(parcela.valorPago)),
    despesa: {
      ...parcela.despesa,
      valorTotal: paraMoeda(deDecimal(parcela.despesa.valorTotal)),
    },
  };
}

/**
 * Calcula o resumo financeiro das parcelas a pagar com base nos filtros.
 */
export async function obterResumoPagar(filtros?: FiltrosPagar): Promise<ResumoPagar> {
  const parcelas = await listarParcelasPagarFiltradas(filtros);

  let fusoHorario = FUSO_HORARIO_PADRAO;
  try {
    fusoHorario = (await exigirContextoTenant()).fusoHorario ?? FUSO_HORARIO_PADRAO;
  } catch {
    // Sem contexto (chamada fora de requisicao autenticada): cai no fuso padrao.
  }

  // `dataVencimento` é DATA DE CALENDÁRIO (meia-noite UTC) — "hoje"/"amanhã"
  // precisam da mesma convenção, não meia-noite do fuso da loja como
  // instante. Ver lib/datas.ts (`comoDataDeCalendario`).
  const hoje = comoDataDeCalendario(new Date(), fusoHorario);

  // Centavos inteiros do início ao fim, convertidos para reais só no retorno.
  // Somar em ponto flutuante aqui reintroduziria o erro de arredondamento que
  // a Fase 2A-2 tirou do caixa; somar o `Decimal` cru reintroduziria a
  // concatenação de texto que quebrou esta tela.
  let pendenteCentavos = 0;
  let atrasadoCentavos = 0;
  let venceHojeCentavos = 0;
  let periodoCentavos = 0;

  for (const parcela of parcelas) {
    // Já é DATA DE CALENDÁRIO — nunca reconverter via comoDataDeCalendario.
    const venc = parcela.dataVencimento;
    const valorCentavos = deDecimal(parcela.valor);

    periodoCentavos = somar(periodoCentavos, valorCentavos);

    if (parcela.status === "PAGO") continue;

    if (parcela.status === "ATRASADO" || venc < hoje) {
      atrasadoCentavos = somar(atrasadoCentavos, valorCentavos);
    } else if (venc.getTime() === hoje.getTime() && parcela.status === "PENDENTE") {
      venceHojeCentavos = somar(venceHojeCentavos, valorCentavos);
    } else if (parcela.status === "PENDENTE") {
      pendenteCentavos = somar(pendenteCentavos, valorCentavos);
    }
  }

  return {
    totalPendente: paraMoeda(pendenteCentavos),
    totalAtrasado: paraMoeda(atrasadoCentavos),
    venceHoje: paraMoeda(venceHojeCentavos),
    totalPeriodo: paraMoeda(periodoCentavos),
  };
}

// ── Pagar Parcela ────────────────────────────────────────────────────────────

export async function pagarParcela(
  parcelaId: string,
  valorPago: number
): Promise<ResultadoAcaoDespesa> {
  try {
    await pagarParcelaInterno(parcelaId, valorPago);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

type PrismaTenantPagar = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];
type PrismaTxPagar = Parameters<Parameters<PrismaTenantPagar["$transaction"]>[0]>[0];

async function pagarParcelaInterno(parcelaId: string, valorPago: number): Promise<void> {
  // C1: exige sessao valida antes de pagar parcela.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.baixar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  await prisma.$transaction((tx) => aplicarPagamentoParcela(tx, prisma, parcelaId, valorPago, usuario));

  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/");
}

/**
 * Núcleo de "pagar parcela", sem abrir transação própria — mesmo padrão de
 * `aplicarBaixaConta` em financeiro-receber.ts (Fase 3-2D, Parte 5): usada
 * pelo caminho de uma parcela só e pelo lote, dentro da MESMA transação no
 * caso do lote. `root` é sempre o client de nivel de modulo (pra resolver o
 * delegate 'parcelaDespesa'/'ParcelaDespesa' mesmo quando `tx` nao tem —
 * ver obterDelegateParcelaDespesa), nao muda entre uma parcela e lote.
 */
async function aplicarPagamentoParcela(
  tx: PrismaTxPagar,
  root: PrismaTenantPagar,
  parcelaId: string,
  /** Omitido = paga pelo valor original da parcela (lote, Fase 3-2D Parte 5 — sem desconto/juros por item). */
  valorPagoInformado: number | undefined,
  usuario: { id?: string | null } | null | undefined
): Promise<{ valor: number }> {
  if (!parcelaId) {
    throw new Error("Parcela invalida para pagamento.");
  }

  if (valorPagoInformado !== undefined && (!Number.isFinite(valorPagoInformado) || valorPagoInformado <= 0)) {
    throw new Error("Informe um valor pago valido.");
  }

  const txAny = tx as unknown as PrismaFinanceiroPagarAny;
  const rootAny = root as unknown as PrismaFinanceiroPagarAny;
  const parcelaDespesaDelegate = obterDelegateParcelaDespesa(txAny, rootAny);

  const parcelaAntes = await parcelaDespesaDelegate.findMany({
    where: {
      id: parcelaId,
    },
    select: {
      id: true,
      status: true,
      valorPago: true,
      valor: true,
    },
    take: 1,
  });

  if (!parcelaAntes[0]?.id) {
    throw new Error("Parcela nao encontrada para pagamento.");
  }

  if (parcelaAntes[0].status === "PAGO") {
    throw new Error("Esta parcela ja foi paga.");
  }

  const valorPago = valorPagoInformado ?? Number(parcelaAntes[0].valor ?? 0);
  const dataPagamento = new Date();

  await parcelaDespesaDelegate.update({
    where: {
      id: parcelaId,
    },
    data: {
      status: "PAGO",
      dataPagamento,
      valorPago,
    },
  });

  await registrarLogAuditoria(
    tx,
    contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:pagarParcela"),
    {
      acao: ACOES_AUDITORIA.FINALIZAR,
      entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
      entidadeId: parcelaId,
      dadosAntes: {
        status: parcelaAntes[0].status,
        valorPago: parcelaAntes[0].valorPago,
        valor: parcelaAntes[0].valor,
      },
      dadosDepois: {
        status: "PAGO",
        valorPago,
        dataPagamento,
      },
    }
  );

  return { valor: valorPago };
}

export type ResultadoAcaoLotePagar =
  | { sucesso: true; quantidade: number; total: number }
  | { sucesso: false; mensagem: string };

/**
 * Pagar várias parcelas de uma vez (Fase 3-2D, Parte 5) — cada uma pelo
 * seu valor ORIGINAL, sem desconto/juros por parcela: quem quiser ajustar
 * valor tem que baixar individualmente, não é uma opção do lote de
 * propósito ("aplicar um valor só pra várias é assim que dinheiro se
 * perde", conforme a especificação). UMA transação pro lote inteiro,
 * tudo-ou-nada — ver o comentário equivalente em
 * `darBaixaContasEmLote` (financeiro-receber.ts).
 */
export async function pagarParcelasEmLote(ids: string[]): Promise<ResultadoAcaoLotePagar> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.baixar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  const idsUnicos = Array.from(new Set(ids.filter((id) => id.trim().length > 0)));

  if (idsUnicos.length === 0) {
    return { sucesso: false, mensagem: "Selecione ao menos uma parcela para pagar." };
  }

  try {
    const totalCentavos = await prisma.$transaction(async (tx) => {
      // Uma leitura para todas as parcelas, em vez de uma por item. O caminho
      // anterior chamava `aplicarPagamentoParcela` em sequencia: 3 idas ao
      // banco por parcela (ler, atualizar, auditar). Com 20 selecionadas eram
      // 60 idas em serie dentro da MESMA transacao interativa, que expira em 5
      // segundos por padrao — com o banco na rede, isso estourava sempre. Era
      // o "Nao foi possivel concluir a operacao" que o dono reportou: nenhum
      // pagamento acontecia, e a mensagem nao dizia por que.
      const parcelas = await tx.parcelaDespesa.findMany({
        where: { id: { in: idsUnicos } },
        select: { id: true, status: true, valor: true, valorPago: true },
      });

      // As mesmas validacoes de antes, agora em memoria. Continuam parando o
      // lote inteiro: tudo-ou-nada e a regra, e pagar 19 de 20 em silencio
      // seria pior que nao pagar nenhuma.
      const encontradas = new Set(parcelas.map((parcela) => parcela.id));
      const ausente = idsUnicos.find((id) => !encontradas.has(id));
      if (ausente) {
        throw new Error("Parcela nao encontrada para pagamento.");
      }

      const jaPaga = parcelas.find((parcela) => parcela.status === "PAGO");
      if (jaPaga) {
        throw new Error("Esta parcela ja foi paga.");
      }

      const dataPagamento = new Date();

      // Uma unica atualizacao para todas. `valorPago` recebe o proprio `valor`
      // de cada linha — que e exatamente a regra do lote: cada parcela pelo seu
      // valor original, sem desconto nem juros. `updateMany` do Prisma nao
      // sabe copiar coluna para coluna, dai o SQL direto.
      await tx.$executeRaw`
        UPDATE "ParcelaDespesa"
           SET "status" = 'PAGO',
               "dataPagamento" = ${dataPagamento},
               "valorPago" = "valor"
         WHERE "id" = ANY(${idsUnicos})
      `;

      // Uma unica gravacao de auditoria para os itens, mais a do lote.
      await registrarLogsAuditoriaEmLote(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:pagarParcelasEmLote"),
        parcelas.map((parcela) => ({
          acao: ACOES_AUDITORIA.FINALIZAR,
          entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
          entidadeId: parcela.id,
          dadosAntes: { status: parcela.status, valorPago: parcela.valorPago, valor: parcela.valor },
          dadosDepois: { status: "PAGO", valorPago: parcela.valor, dataPagamento },
        }))
      );

      const acumuladoCentavos = parcelas.reduce(
        (total, parcela) => somar(total, deDecimal(parcela.valor)),
        0
      );

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:pagarParcelasEmLote"),
        {
          acao: ACOES_AUDITORIA.FINALIZAR_LOTE,
          entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
          entidadeId: crypto.randomUUID(),
          dadosDepois: {
            parcelasIds: idsUnicos,
            quantidade: idsUnicos.length,
            total: paraMoeda(acumuladoCentavos),
          },
        }
      );

      return acumuladoCentavos;
    },
    // Folga para lotes grandes, agora que sao 4 idas ao banco em vez de 3N.
    // Nao e o conserto — e a rede de seguranca caso o lote cresca.
    { timeout: 20000, maxWait: 10000 });

    revalidatePath("/financeiro/pagar");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/");

    return { sucesso: true, quantidade: idsUnicos.length, total: paraMoeda(totalCentavos) };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}
