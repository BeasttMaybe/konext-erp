"use server";

import { revalidatePath } from "next/cache";
import type { TipoPeca } from "@prisma/client";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ErroPermissao, exigirPermissao } from "@/lib/auth/permissoes";
import type { EntradaDecimal } from "@/lib/dinheiro";
import {
  deDecimal,
  dividirEmParcelas,
  lerEntradaMonetaria,
  paraDecimal,
  paraMoeda,
  somar,
} from "@/lib/dinheiro";
import { validarMarcaDoItem } from "@/lib/dominio/os/marcas-peca";

const tiposPecaValidos: TipoPeca[] = [
  "TELA",
  "BATERIA",
  "CONECTOR_CARGA",
  "TAMPA_IPHONE",
  "TAMPA_ANDROID",
  "OUTROS",
];

type ItemOSDelegate = {
  findFirst?: (args: unknown) => Promise<{ id: string; osId?: string; ordemServicoId?: string } | null>;
  // `valorCobrado` e Decimal(12,2) no banco, nao number. Declarar `number`
  // aqui era o mesmo engano que fez os KPIs do financeiro somarem string:
  // o compilador aceitava `acumulador + item.valorCobrado` e o runtime
  // concatenava. Tipado como EntradaDecimal, a unica saida e `deDecimal`.
  findMany?: (args: unknown) => Promise<Array<{ valorCobrado: EntradaDecimal }>>;
  update?: (args: unknown) => Promise<unknown>;
  delete?: (args: unknown) => Promise<unknown>;
  create?: (args: unknown) => Promise<unknown>;
};

type ContaReceberOS = {
  id: string;
  vendaId?: string | null;
};

type ContaReceberDelegate = {
  findMany?: (args: unknown) => Promise<ContaReceberOS[]>;
  update?: (args: unknown) => Promise<unknown>;
};

type VendaDelegate = {
  update?: (args: unknown) => Promise<unknown>;
};

type OrdemServicoNumeroDelegate = {
  findUnique?: (args: unknown) => Promise<{ numeroOs?: number | null } | null>;
};

type DespesaDelegate = {
  create?: (args: unknown) => Promise<{ id: string }>;
};

type ParcelaDespesaDelegate = {
  create?: (args: unknown) => Promise<unknown>;
};

type DadosAdicionarItemOS = {
  descricao?: string;
  tipoPeca?: string;
  custoPeca?: number | string;
  valorManual?: number | string;
  marcaPecaId?: string | null;
};

export type EntradaAtualizarItemOS = {
  itemId: string;
  osId: string;
  tipoPeca: TipoPeca;
  descricao: string;
  custoPeca: number | string;
  valorCobrado: number | string;
  marcaPecaId?: string | null;
};

export type EntradaRemoverItemOS = {
  itemId: string;
  osId: string;
};

export type ResultadoAcaoItemOS =
  | {
      sucesso: true;
      mensagem: string;
      totalOS: number;
    }
  | {
      sucesso: false;
      erro: string;
    };

/**
 * `""` chega da tela quando o seletor de marca esta vazio; `null` e o que a
 * coluna guarda. Sem isso, um item de OUTROS sem marca tentaria gravar string
 * vazia numa chave estrangeira.
 */
function normalizarMarcaPecaId(valor: string | null | undefined): string | null {
  if (typeof valor !== "string") return null;
  const id = valor.trim();
  return id.length > 0 ? id : null;
}

/**
 * Decimal do Prisma -> number em reais, so pra escrever no JSON do log de
 * auditoria. `Prisma.Decimal` nao e serializavel em `createMany`, e um
 * `dadosAntes` com Decimal cru derruba o registro do log junto com a
 * transacao inteira.
 */
function moedaParaAuditoria(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  try {
    return paraMoeda(deDecimal(valor as EntradaDecimal));
  } catch {
    return null;
  }
}

function obterItemOSDelegate(client: unknown): ItemOSDelegate | null {
  const prismaClient = client as {
    itemOS?: ItemOSDelegate;
    ItemOS?: ItemOSDelegate;
  };

  return prismaClient.itemOS ?? prismaClient.ItemOS ?? null;
}

function obterContaReceberDelegate(client: unknown): ContaReceberDelegate | null {
  const prismaClient = client as {
    contaReceber?: ContaReceberDelegate;
    ContaReceber?: ContaReceberDelegate;
  };

  return prismaClient.contaReceber ?? prismaClient.ContaReceber ?? null;
}

function obterVendaDelegate(client: unknown): VendaDelegate | null {
  const prismaClient = client as {
    venda?: VendaDelegate;
    Venda?: VendaDelegate;
  };

  return prismaClient.venda ?? prismaClient.Venda ?? null;
}

async function calcularTotalOSCentavos(client: unknown, osId: string): Promise<number> {
  const itemDelegate = obterItemOSDelegate(client);

  if (!itemDelegate?.findMany) {
    throw new Error("Delegate Prisma de ItemOS nao disponivel para calcular total.");
  }

  const itens = await itemDelegate.findMany({
    where: { osId },
    select: { valorCobrado: true },
  });

  // Soma de inteiros: nao existe resto de ponto flutuante pra arredondar
  // depois. Este total alimenta ContaReceber e Venda, onde um centavo de
  // diferenca fica visivel na conciliacao.
  return itens.reduce((acumulador, item) => somar(acumulador, deDecimal(item.valorCobrado)), 0);
}

async function sincronizarTotaisFinanceirosOS(
  client: unknown,
  osId: string,
  totalOSCentavos: number
): Promise<void> {
  const contaReceberDelegate = obterContaReceberDelegate(client);
  const vendaDelegate = obterVendaDelegate(client);

  if (!contaReceberDelegate?.findMany || !contaReceberDelegate.update) {
    return;
  }

  const contasDaOs = await contaReceberDelegate.findMany({
    where: {
      ordemServicoId: osId,
      origem: "ORDEM_SERVICO",
    },
    select: {
      id: true,
      vendaId: true,
    },
  });

  if (contasDaOs.length === 0) {
    return;
  }

  // Centavo-exato (Fase 2A-2 cont.): dividirEmParcelas (lib/dinheiro.ts) é o
  // único lugar autorizado a partir um total em N contas que somam
  // exatamente o total. A divisão manual anterior, além de reimplementar a
  // fórmula fora do módulo, jogava o resto na ÚLTIMA conta — invertendo a
  // convenção do projeto (resto vai pras PRIMEIRAS parcelas).
  const valoresParcelasCentavos = dividirEmParcelas(totalOSCentavos, contasDaOs.length);

  for (let indice = 0; indice < contasDaOs.length; indice += 1) {
    const conta = contasDaOs[indice];

    await contaReceberDelegate.update({
      where: { id: conta.id },
      // String de `paraDecimal` em vez de number: e o formato que o Prisma
      // grava em Decimal(12,2) sem passar por ponto flutuante de novo.
      data: { valor: paraDecimal(valoresParcelasCentavos[indice]) },
    });
  }

  if (!vendaDelegate?.update) {
    return;
  }

  const vendaIds = Array.from(
    new Set(
      contasDaOs
        .map((conta) => (conta.vendaId ? String(conta.vendaId) : ""))
        .filter((id): id is string => Boolean(id))
    )
  );

  for (const vendaId of vendaIds) {
    await vendaDelegate.update({
      where: { id: vendaId },
      data: { valorTotal: paraDecimal(totalOSCentavos) },
    });
  }
}

export async function adicionarItemOS(osId: string, data: DadosAdicionarItemOS) {
  // C1: exige sessao valida antes de inserir item na OS.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "os.editar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  const descricao = String(data?.descricao ?? "").trim();
  const tipoPeca = String(data?.tipoPeca ?? "") as TipoPeca;
  // Mesma normalizacao da edicao. Antes era um `Number()` cru, que lia
  // "1.234,56" como NaN e gravava 0 sem reclamar: a peca de 1.234 reais
  // entrava na OS custando zero.
  const custoPecaCentavos = lerEntradaMonetaria(data?.custoPeca ?? 0);
  const valorManualCentavos = lerEntradaMonetaria(data?.valorManual);
  const marcaPecaId = normalizarMarcaPecaId(data?.marcaPecaId);

  if (!descricao) {
    throw new Error("A descricao do item e obrigatoria.");
  }

  if (!tiposPecaValidos.includes(tipoPeca)) {
    throw new Error("Tipo de peca invalido.");
  }

  // Mesma funcao que a tela usa pra desabilitar o envio: esconder um campo
  // nunca foi validacao, e a action e a fronteira que de fato decide.
  const marcaValida = validarMarcaDoItem(tipoPeca, marcaPecaId);
  if (!marcaValida.valido) {
    throw new Error(marcaValida.erro);
  }

  if (custoPecaCentavos === null || custoPecaCentavos < 0) {
    throw new Error("Informe um custo de peca valido (nao negativo).");
  }

  // O valor cobrado ao cliente é sempre o informado manualmente — sem cálculo automático de markup.
  const valorCobradoCentavos = valorManualCentavos;

  if (valorCobradoCentavos === null || valorCobradoCentavos <= 0) {
    throw new Error("Informe um valor cobrado ao cliente válido (maior que zero).");
  }

  const prismaAny = prisma as typeof prisma & {
    itemOS?: ItemOSDelegate;
    ItemOS?: ItemOSDelegate;
  };
  const delegate = prismaAny.itemOS ?? prismaAny.ItemOS;

  if (!delegate?.create) {
    throw new Error("Delegate Prisma de ItemOS nao disponivel.");
  }

  // Lido fora da transacao de proposito: e so leitura de configuracao, e
  // mante-la aqui evita mais uma ida ao banco dentro da transacao.
  // `?? true` cobre o tenant que ainda nao tem a linha de Configuracao.
  const custoPecaJaPago =
    (
      await prisma.configuracao.findFirst({
        select: { custoPecaOSJaPago: true },
        orderBy: { criadoEm: "asc" },
      })
    )?.custoPecaOSJaPago ?? true;

  // Usa transaction para garantir que o item e a despesa financeira sejam criados juntos.
  await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & {
      itemOS?: ItemOSDelegate;
      ItemOS?: ItemOSDelegate;
      despesa?: DespesaDelegate;
      Despesa?: DespesaDelegate;
      parcelaDespesa?: ParcelaDespesaDelegate;
      ParcelaDespesa?: ParcelaDespesaDelegate;
      ordemServico?: OrdemServicoNumeroDelegate;
      OrdemServico?: OrdemServicoNumeroDelegate;
    };
    const txItemOS = txAny.itemOS ?? txAny.ItemOS;
    const txDespesa = txAny.despesa ?? txAny.Despesa;
    const txParcelaDespesa = txAny.parcelaDespesa ?? txAny.ParcelaDespesa;

    if (!txItemOS?.create) {
      throw new Error("Delegate Prisma de ItemOS nao disponivel na transacao.");
    }

    // 1. Insere o item na OS.
    //
    // Sem try/catch aqui de proposito. Havia um fallback que, em QUALQUER
    // falha, tentava de novo com `ordemServicoId`/`tipo` — nomes de um schema
    // que nao existe desde a baseline (ItemOS usa `osId`/`tipoPeca`). O
    // caminho alternativo nunca podia dar certo, e o unico efeito real era
    // engolir o erro verdadeiro e devolver no lugar dele uma mensagem do
    // Prisma sobre coluna inexistente. Com a marca de peca isso ficaria pior:
    // uma marca invalida viraria erro sobre `ordemServicoId`.
    const itemCriado = (await txItemOS.create({
      data: {
        osId,
        descricao,
        tipoPeca,
        custoPeca: paraDecimal(custoPecaCentavos),
        valorCobrado: paraDecimal(valorCobradoCentavos),
        marcaPecaId,
      },
    })) as { id?: string };
    const itemCriadoId = itemCriado?.id ? String(itemCriado.id) : null;

    // 2. Lanca o custo da peca no financeiro, se houver custo registrado.
    //
    // A peca de conserto e comprada por servico e, nesta loja, paga no ato — por
    // isso `custoPecaOSJaPago` nasce ligado. Com ele ligado, a despesa entra JA
    // QUITADA: continua contando em relatorio, fluxo de caixa e apuracao de
    // lucro, mas nao vira conta em aberto. Antes nascia sempre PENDENTE
    // vencendo no mesmo dia, o que enchia Contas a Pagar de linhas que so
    // esperavam alguem dar baixa em algo ja pago.
    if (custoPecaCentavos > 0 && txDespesa?.create && txParcelaDespesa?.create) {
      const custoPecaDecimal = paraDecimal(custoPecaCentavos);

      // Busca o número da OS para compor a descrição legível
      const osDelegate = txAny.ordemServico ?? txAny.OrdemServico;
      const numeroOs = osDelegate?.findUnique
        ? (await osDelegate.findUnique({ where: { id: osId }, select: { numeroOs: true } }))?.numeroOs ?? osId
        : osId;

      const despesa = await txDespesa.create({
        data: {
          fornecedor: "Custo de peça (OS)",
          descricao: `Custo de Peça - OS #${numeroOs} - ${descricao}`,
          valorTotal: custoPecaDecimal,
          tipo: "UNICA",
          qtdParcelas: 1,
        },
      });

      const agora = new Date();

      await txParcelaDespesa.create({
        data: {
          despesaId: despesa.id,
          numeroParcela: 1,
          valor: custoPecaDecimal,
          dataVencimento: agora,
          ...(custoPecaJaPago
            ? { status: "PAGO", dataPagamento: agora, valorPago: custoPecaDecimal }
            : { status: "PENDENTE" }),
        },
      });
    }

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/os-itens.ts:adicionarItemOS"),
      {
        acao: ACOES_AUDITORIA.ADICIONAR_ITEM,
        entidade: ENTIDADES_AUDITORIA.ITEM_OS,
        entidadeId: itemCriadoId,
        dadosDepois: {
          osId,
          descricao,
          tipoPeca,
          custoPeca: paraMoeda(custoPecaCentavos),
          valorCobrado: paraMoeda(valorCobradoCentavos),
        },
      }
    );
  });

  revalidatePath(`/os/${osId}`);
  revalidatePath("/os");
  revalidatePath("/");
  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/pdv");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
}

export async function atualizarItemOS(input: EntradaAtualizarItemOS): Promise<ResultadoAcaoItemOS> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    const itemId = String(input.itemId ?? "").trim();
    const osId = String(input.osId ?? "").trim();
    const descricao = String(input.descricao ?? "").trim();
    const tipoPeca = String(input.tipoPeca ?? "") as TipoPeca;
    const custoPecaCentavos = lerEntradaMonetaria(input.custoPeca);
    const valorCobradoCentavos = lerEntradaMonetaria(input.valorCobrado);
    const marcaPecaId = normalizarMarcaPecaId(input.marcaPecaId);

    if (!itemId || !osId) {
      return { sucesso: false, erro: "Item ou OS invalido." };
    }

    if (!descricao) {
      return { sucesso: false, erro: "A descricao do item e obrigatoria." };
    }

    if (!tiposPecaValidos.includes(tipoPeca)) {
      return { sucesso: false, erro: "Tipo de peca invalido." };
    }

    // Vale tambem na edicao, inclusive em item antigo que nasceu sem marca: a
    // regra e uma so, e editar um item e a oportunidade de completar o dado.
    const marcaValida = validarMarcaDoItem(tipoPeca, marcaPecaId);
    if (!marcaValida.valido) {
      return { sucesso: false, erro: marcaValida.erro };
    }

    if (custoPecaCentavos === null || custoPecaCentavos < 0) {
      return { sucesso: false, erro: "Informe um custo valido (nao negativo)." };
    }

    if (valorCobradoCentavos === null || valorCobradoCentavos <= 0) {
      return { sucesso: false, erro: "Informe um valor cobrado valido (maior que zero)." };
    }

    const totalOSCentavos = await prisma.$transaction(async (tx) => {
      const itemDelegate = obterItemOSDelegate(tx);

      if (!itemDelegate?.findFirst || !itemDelegate?.update) {
        throw new Error("Delegate Prisma de ItemOS nao disponivel na transacao.");
      }

      const itemExiste = await itemDelegate.findFirst({
        where: {
          id: itemId,
          osId,
        },
        select: {
          id: true,
          osId: true,
          descricao: true,
          tipoPeca: true,
          custoPeca: true,
          valorCobrado: true,
          marcaPecaId: true,
        },
      });

      if (!itemExiste?.id) {
        throw new Error("Item da OS nao encontrado.");
      }

      await itemDelegate.update({
        where: {
          id: itemId,
        },
        data: {
          tipoPeca,
          descricao,
          custoPeca: paraDecimal(custoPecaCentavos),
          valorCobrado: paraDecimal(valorCobradoCentavos),
          marcaPecaId,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/os-itens.ts:atualizarItemOS"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_ITEM,
          entidade: ENTIDADES_AUDITORIA.ITEM_OS,
          entidadeId: itemId,
          dadosAntes: {
            descricao: (itemExiste as Record<string, unknown>).descricao,
            tipoPeca: (itemExiste as Record<string, unknown>).tipoPeca,
            custoPeca: moedaParaAuditoria((itemExiste as Record<string, unknown>).custoPeca),
            valorCobrado: moedaParaAuditoria((itemExiste as Record<string, unknown>).valorCobrado),
            marcaPecaId: (itemExiste as Record<string, unknown>).marcaPecaId,
          },
          dadosDepois: {
            descricao,
            tipoPeca,
            custoPeca: paraMoeda(custoPecaCentavos),
            valorCobrado: paraMoeda(valorCobradoCentavos),
            marcaPecaId,
          },
        }
      );

      const totalAtualizadoCentavos = await calcularTotalOSCentavos(tx, osId);
      await sincronizarTotaisFinanceirosOS(tx, osId, totalAtualizadoCentavos);
      return totalAtualizadoCentavos;
    });

    revalidatePath(`/os/${osId}`);
    revalidatePath("/os");
    revalidatePath("/");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/pdv");

    return {
      sucesso: true,
      mensagem: "Item atualizado com sucesso.",
      totalOS: paraMoeda(totalOSCentavos),
    };
  } catch (erro) {
    if (erro instanceof ErroPermissao) {
      return { sucesso: false, erro: erro.message };
    }

    return {
      sucesso: false,
      erro: "Nao foi possivel atualizar o item da ordem de servico.",
    };
  }
}

export async function removerItemOS(input: EntradaRemoverItemOS): Promise<ResultadoAcaoItemOS> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");
    const prisma = contexto.prisma;
    const usuario = contexto.usuarioOperacional;

    const itemId = String(input.itemId ?? "").trim();
    const osId = String(input.osId ?? "").trim();

    if (!itemId || !osId) {
      return { sucesso: false, erro: "Item ou OS invalido." };
    }

    const totalOSCentavos = await prisma.$transaction(async (tx) => {
      const itemDelegate = obterItemOSDelegate(tx);

      if (!itemDelegate?.findFirst || !itemDelegate?.delete) {
        throw new Error("Delegate Prisma de ItemOS nao disponivel na transacao.");
      }

      const itemExiste = await itemDelegate.findFirst({
        where: {
          id: itemId,
          osId,
        },
        select: {
          id: true,
          descricao: true,
          tipoPeca: true,
          custoPeca: true,
          valorCobrado: true,
        },
      });

      if (!itemExiste?.id) {
        throw new Error("Item da OS nao encontrado.");
      }

      await itemDelegate.delete({
        where: {
          id: itemId,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/os-itens.ts:removerItemOS"),
        {
          acao: ACOES_AUDITORIA.REMOVER_ITEM,
          entidade: ENTIDADES_AUDITORIA.ITEM_OS,
          entidadeId: itemId,
          dadosAntes: {
            descricao: (itemExiste as Record<string, unknown>).descricao,
            tipoPeca: (itemExiste as Record<string, unknown>).tipoPeca,
            custoPeca: moedaParaAuditoria((itemExiste as Record<string, unknown>).custoPeca),
            valorCobrado: moedaParaAuditoria((itemExiste as Record<string, unknown>).valorCobrado),
          },
          dadosDepois: null,
        }
      );

      const totalAtualizadoCentavos = await calcularTotalOSCentavos(tx, osId);
      await sincronizarTotaisFinanceirosOS(tx, osId, totalAtualizadoCentavos);
      return totalAtualizadoCentavos;
    });

    revalidatePath(`/os/${osId}`);
    revalidatePath("/os");
    revalidatePath("/");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/pdv");

    return {
      sucesso: true,
      mensagem: "Item removido com sucesso.",
      totalOS: paraMoeda(totalOSCentavos),
    };
  } catch (erro) {
    if (erro instanceof ErroPermissao) {
      return { sucesso: false, erro: erro.message };
    }

    return {
      sucesso: false,
      erro: "Nao foi possivel remover o item da ordem de servico.",
    };
  }
}
