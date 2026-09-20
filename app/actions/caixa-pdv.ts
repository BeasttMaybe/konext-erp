"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";

type CaixaDelegate = {
  findFirst?: (args: unknown) => Promise<{ id?: string; valorAbertura?: number; dataAbertura?: Date } | null>;
  create?: (args: unknown) => Promise<{ id: string; valorAbertura: number; dataAbertura: Date }>;
  update?: (args: unknown) => Promise<{ id: string; valorFechamento?: number; dataFechamento?: Date | null }>;
};

type SqlExecutor = {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

type SqlMutator = SqlExecutor & {
  $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

type CaixaClient = SqlMutator & {
  caixaSession?: CaixaDelegate;
  CaixaSession?: CaixaDelegate;
};

export interface ResumoCaixaAbertoAtual {
  caixaId: string;
  valorAbertura: number;
  totalVendasSessao: number;
  valorSugeridoFechamento: number;
  dataAbertura: string;
}

function obterCaixaDelegate(client: unknown): CaixaDelegate | undefined {
  const prismaClient = client as CaixaClient;
  return prismaClient.caixaSession ?? prismaClient.CaixaSession;
}

async function buscarCaixaAbertoViaSql(client: SqlExecutor): Promise<{ id: string } | null> {
  const resultado = await client.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "CaixaSession"
    WHERE status::text = 'ABERTO'
    ORDER BY "dataAbertura" DESC
    LIMIT 1
  `;

  if (!Array.isArray(resultado) || resultado.length === 0 || !resultado[0]?.id) {
    return null;
  }

  return { id: String(resultado[0].id) };
}

async function criarCaixaViaSql(client: SqlExecutor, valorAbertura: number, abertoPorId: string | null) {
  const id = randomUUID();

  const resultado = await client.$queryRaw<
    Array<{ id: string; valorAbertura: number; dataAbertura: Date }>
  >`
    INSERT INTO "CaixaSession" (id, status, "valorAbertura", "abertoPorId", "criadoEm", "atualizadoEm")
    VALUES (${id}, 'ABERTO', ${valorAbertura}, ${abertoPorId}, NOW(), NOW())
    RETURNING id, "valorAbertura", "dataAbertura"
  `;

  if (!Array.isArray(resultado) || resultado.length === 0) {
    throw new Error("Nao foi possivel abrir o caixa no banco de dados.");
  }

  const novo = resultado[0];
  return {
    id: String(novo.id),
    valorAbertura: Number(novo.valorAbertura),
    dataAbertura: new Date(novo.dataAbertura).toISOString(),
  };
}

async function fecharCaixaViaSql(client: SqlExecutor, caixaId: string, valorFechamento: number) {
  const resultado = await client.$queryRaw<
    Array<{ id: string; valorFechamento: number; dataFechamento: Date }>
  >`
    UPDATE "CaixaSession"
    SET
      status = 'FECHADO',
      "valorFechamento" = ${valorFechamento},
      "dataFechamento" = NOW(),
      "atualizadoEm" = NOW()
    WHERE id = ${caixaId}
    RETURNING id, "valorFechamento", "dataFechamento"
  `;

  if (!Array.isArray(resultado) || resultado.length === 0) {
    throw new Error("Nao foi possivel fechar o caixa no banco de dados.");
  }

  const caixaFechado = resultado[0];
  return {
    id: String(caixaFechado.id),
    valorFechamento: Number(caixaFechado.valorFechamento),
    dataFechamento: new Date(caixaFechado.dataFechamento).toISOString(),
  };
}

async function obterResumoCaixaAbertoAtualViaSql(client: SqlExecutor): Promise<ResumoCaixaAbertoAtual> {
  const caixaAberto = await client.$queryRaw<
    Array<{ id: string; valorAbertura: number; dataAbertura: Date }>
  >`
    SELECT id, "valorAbertura", "dataAbertura"
    FROM "CaixaSession"
    WHERE status::text = 'ABERTO'
    ORDER BY "dataAbertura" DESC
    LIMIT 1
  `;

  if (!Array.isArray(caixaAberto) || caixaAberto.length === 0 || !caixaAberto[0]?.id) {
    throw new Error("Nao existe caixa aberto para fechamento.");
  }

  const caixaId = String(caixaAberto[0].id);
  const valorAbertura = Number(caixaAberto[0].valorAbertura ?? 0);
  const dataAbertura = new Date(caixaAberto[0].dataAbertura).toISOString();

  const totaisVenda = await client.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM("valorTotal"), 0) AS total
    FROM "Venda"
    WHERE "caixaSessionId" = ${caixaId}
  `;

  const totalVendasSessao = Number(totaisVenda?.[0]?.total ?? 0);

  return {
    caixaId,
    valorAbertura,
    totalVendasSessao,
    valorSugeridoFechamento: valorAbertura + totalVendasSessao,
    dataAbertura,
  };
}

async function obterResumoCaixaAbertoAtualInterno(client: CaixaClient): Promise<ResumoCaixaAbertoAtual> {
  const caixaDelegate = obterCaixaDelegate(client);

  if (caixaDelegate?.findFirst) {
    const caixaAberto = await caixaDelegate.findFirst({
      where: {
        status: "ABERTO",
      },
      orderBy: {
        dataAbertura: "desc",
      },
      select: {
        id: true,
        valorAbertura: true,
        dataAbertura: true,
      },
    });

    if (!caixaAberto?.id || !caixaAberto.dataAbertura) {
      throw new Error("Nao existe caixa aberto para fechamento.");
    }

    const totaisVenda = await client.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM("valorTotal"), 0) AS total
      FROM "Venda"
      WHERE "caixaSessionId" = ${String(caixaAberto.id)}
    `;

    const valorAbertura = Number(caixaAberto.valorAbertura ?? 0);
    const totalVendasSessao = Number(totaisVenda?.[0]?.total ?? 0);

    return {
      caixaId: String(caixaAberto.id),
      valorAbertura,
      totalVendasSessao,
      valorSugeridoFechamento: valorAbertura + totalVendasSessao,
      dataAbertura: new Date(caixaAberto.dataAbertura).toISOString(),
    };
  }

  return obterResumoCaixaAbertoAtualViaSql(client);
}

export async function verificarStatusCaixa(): Promise<boolean> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const { prisma } = contexto;
  const prismaAny = prisma as CaixaClient;
  const caixaDelegate = obterCaixaDelegate(prismaAny);

  if (caixaDelegate?.findFirst) {
    const caixaAberto = await caixaDelegate.findFirst({
      where: {
        status: "ABERTO",
      },
      orderBy: {
        dataAbertura: "desc",
      },
      select: {
        id: true,
      },
    });

    return Boolean(caixaAberto?.id);
  }

  const caixaAberto = await buscarCaixaAbertoViaSql(prismaAny);
  return Boolean(caixaAberto?.id);
}

export async function abrirNovaCaixaSession(valorAbertura: number) {
  // C1: exige sessao valida antes de abrir o caixa.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "caixa.abrir");
  const { prisma } = contexto;

  const valorNumerico = Number(valorAbertura);

  if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
    throw new Error("Informe um valor inicial válido para abrir o caixa.");
  }

  const novaSessao = await prisma.$transaction(async (tx) => {
    const txAny = tx as CaixaClient;
    const txCaixaDelegate = obterCaixaDelegate(txAny);
    let resultado: { id: string; valorAbertura: number; dataAbertura: string };

    if (txCaixaDelegate?.findFirst && txCaixaDelegate?.create) {
      const caixaAberto = await txCaixaDelegate.findFirst({
        where: {
          status: "ABERTO",
        },
        select: {
          id: true,
        },
      });

      if (caixaAberto?.id) {
        throw new Error("Ja existe um caixa aberto. Feche o caixa atual antes de abrir um novo.");
      }

      const sessao = await txCaixaDelegate.create({
        data: {
          status: "ABERTO",
          valorAbertura: valorNumerico,
          abertoPorId: contexto.usuarioOperacional.id || null,
        },
        select: {
          id: true,
          valorAbertura: true,
          dataAbertura: true,
        },
      });

      resultado = {
        id: String(sessao.id),
        valorAbertura: Number(sessao.valorAbertura),
        dataAbertura: new Date(sessao.dataAbertura).toISOString(),
      };
    } else {
      const caixaAbertoSql = await buscarCaixaAbertoViaSql(txAny);

      if (caixaAbertoSql?.id) {
        throw new Error("Ja existe um caixa aberto. Feche o caixa atual antes de abrir um novo.");
      }

      resultado = await criarCaixaViaSql(txAny, valorNumerico, contexto.usuarioOperacional.id || null);
    }

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/caixa-pdv.ts:abrirNovaCaixaSession"),
      {
        acao: ACOES_AUDITORIA.ABRIR_CAIXA,
        entidade: ENTIDADES_AUDITORIA.CAIXA_SESSION,
        entidadeId: resultado.id,
        dadosDepois: {
          valorAberturaCentavos: Math.round(resultado.valorAbertura * 100),
          dataAbertura: resultado.dataAbertura,
        },
      }
    );

    return resultado;
  });

  revalidatePath("/pdv");

  return {
    id: novaSessao.id,
    valorAbertura: novaSessao.valorAbertura,
    dataAbertura: novaSessao.dataAbertura,
  };
}

export async function obterResumoCaixaAbertoAtual(): Promise<ResumoCaixaAbertoAtual> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const prismaAny = contexto.prisma as CaixaClient;
  return obterResumoCaixaAbertoAtualInterno(prismaAny);
}

// Soma de muitos valores em ponto flutuante (um por venda) acumula erro de
// arredondamento (0.1 + 0.2 !== 0.3) — o suficiente pra "contagem bate
// exatamente" nunca fechar em zero. Mesmo padrão centavos-inteiros de
// app/actions/caixa.ts, duplicado aqui (não importado) porque os dois
// arquivos são deliberadamente desacoplados nesta fase.
const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

export interface FormaPagamentoResumoSessao {
  formaPagamento: string;
  total: number;
}

export interface MovimentoCaixaSessao {
  id: string;
  hora: string;
  descricao: string;
  valor: number;
}

export interface ResumoSessaoAbertaDetalhado extends ResumoCaixaAbertoAtual {
  quantidadeVendas: number;
  ticketMedio: number;
  totalDinheiroSessao: number;
  totalCartaoPixSessao: number;
  dinheiroEsperadoGaveta: number;
  porForma: FormaPagamentoResumoSessao[];
  movimentos: MovimentoCaixaSessao[];
}

/**
 * Detalhamento da sessão aberta pra tela de Caixa (Fase 3-2C): os 3 cartões
 * (vendas do dia / dinheiro na gaveta / cartão e PIX), a régua "Entradas por
 * forma" e a lista de movimentações. Mesma lógica de rateio por forma de
 * pagamento de app/actions/caixa.ts (VendaPagamento quando a venda teve
 * pagamento misto, senão o formaPagamento da própria Venda), só que
 * recortada pela sessão de caixa aberta em vez do dia calendário — são
 * escopos diferentes e não dá pra reaproveitar a consulta de lá.
 */
export async function obterResumoSessaoAbertaDetalhado(): Promise<ResumoSessaoAbertaDetalhado> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const { prisma } = contexto;
  const prismaAny = prisma as CaixaClient;

  const resumoBase = await obterResumoCaixaAbertoAtualInterno(prismaAny);

  const vendas = await prisma.venda.findMany({
    where: { caixaSessionId: resumoBase.caixaId },
    select: {
      id: true,
      criadoEm: true,
      valorTotal: true,
      formaPagamento: true,
      cliente: { select: { nomeRazaoSocial: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  const idsVenda = vendas.map((venda) => venda.id);
  let pagamentos: Array<{ vendaId: string; formaPagamento: string; valorBruto: number }> = [];

  if (idsVenda.length > 0) {
    try {
      pagamentos = await prisma.$queryRaw<Array<{ vendaId: string; formaPagamento: string; valorBruto: number }>>`
        SELECT vp."vendaId" AS "vendaId", vp."formaPagamento"::text AS "formaPagamento", vp."valorBruto" AS "valorBruto"
        FROM "VendaPagamento" vp
        WHERE vp."vendaId" IN (${Prisma.join(idsVenda)})
      `;
    } catch {
      pagamentos = [];
    }
  }

  const mapaPagamentosPorVenda = new Map<string, Array<{ formaPagamento: string; valorBruto: number }>>();
  for (const pagamento of pagamentos) {
    const lista = mapaPagamentosPorVenda.get(pagamento.vendaId) ?? [];
    lista.push({ formaPagamento: pagamento.formaPagamento, valorBruto: Number(pagamento.valorBruto ?? 0) });
    mapaPagamentosPorVenda.set(pagamento.vendaId, lista);
  }

  const mapaTotaisPorFormaCentavos = new Map<string, number>();
  const registrarForma = (forma: string, valor: number) => {
    mapaTotaisPorFormaCentavos.set(forma, (mapaTotaisPorFormaCentavos.get(forma) ?? 0) + paraCentavos(valor));
  };

  for (const venda of vendas) {
    const pagamentosDaVenda = mapaPagamentosPorVenda.get(venda.id) ?? [];
    if (pagamentosDaVenda.length > 0) {
      for (const pagamento of pagamentosDaVenda) {
        registrarForma(pagamento.formaPagamento || "NAO_INFORMADO", pagamento.valorBruto);
      }
    } else {
      registrarForma(venda.formaPagamento || "NAO_INFORMADO", venda.valorTotal);
    }
  }

  const porForma: FormaPagamentoResumoSessao[] = Array.from(mapaTotaisPorFormaCentavos.entries())
    .map(([formaPagamento, totalCentavos]) => ({ formaPagamento, total: paraMoeda(totalCentavos) }))
    .sort((a, b) => b.total - a.total);

  const totalVendasSessaoCentavos = paraCentavos(resumoBase.totalVendasSessao);
  const totalDinheiroCentavos = mapaTotaisPorFormaCentavos.get("DINHEIRO") ?? 0;
  // Tudo que nao e dinheiro (cartao, PIX, boleto, crediario, empenho...) vira
  // "Cartao e PIX" nos 3 cartoes — rotulo pragmatico pro balde de "nao esta
  // na gaveta", nao uma enumeracao literal dos 10 valores de FormaPagamento.
  const totalDinheiroSessao = paraMoeda(totalDinheiroCentavos);
  const totalCartaoPixSessao = paraMoeda(Math.max(totalVendasSessaoCentavos - totalDinheiroCentavos, 0));
  const quantidadeVendas = vendas.length;
  const ticketMedio = quantidadeVendas > 0 ? resumoBase.totalVendasSessao / quantidadeVendas : 0;

  const movimentos: MovimentoCaixaSessao[] = vendas.map((venda) => ({
    id: venda.id,
    hora: new Date(venda.criadoEm).toISOString(),
    descricao: venda.cliente?.nomeRazaoSocial ?? "Cliente não identificado",
    valor: venda.valorTotal,
  }));

  return {
    ...resumoBase,
    quantidadeVendas,
    ticketMedio,
    totalDinheiroSessao,
    totalCartaoPixSessao,
    // "Esperado na gaveta" = abertura + dinheiro da sessao. A referencia
    // tambem subtrai sangrias e soma suprimentos, mas nenhum dos dois existe
    // ainda (chegam com a reconstrucao do caixa — ver botoes desabilitados
    // na tela) entao a formula fica so com os dois termos que sao reais hoje.
    // Soma em centavos inteiros: em float puro, "abertura + dinheiro" as
    // vezes fecha em 1409.8899999999999 em vez de 1409.89, e a contagem as
    // cegas nunca bate mesmo quando o operador digita o valor certo.
    dinheiroEsperadoGaveta: paraMoeda(paraCentavos(resumoBase.valorAbertura) + totalDinheiroCentavos),
    porForma,
    movimentos,
  };
}

export async function fecharCaixaSessionAtual(valorFechamento?: number | null, observacao?: string | null) {
  // C1: exige sessao valida antes de fechar o caixa.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "caixa.fechar");
  const { prisma } = contexto;

  const valorInformado = Number(valorFechamento);

  const fechamento = await prisma.$transaction(async (tx) => {
    const txAny = tx as CaixaClient;
    const txCaixaDelegate = obterCaixaDelegate(txAny);
    const resumoAtual = await obterResumoCaixaAbertoAtualInterno(txAny);
    const valorFinal = Number.isFinite(valorInformado) && valorInformado >= 0
      ? valorInformado
      : resumoAtual.valorSugeridoFechamento;
    let resultado: { id: string; valorFechamento: number; dataFechamento: string };

    if (txCaixaDelegate?.findFirst && txCaixaDelegate?.update) {
      const caixaFechado = await txCaixaDelegate.update({
        where: {
          id: resumoAtual.caixaId,
        },
        data: {
          status: "FECHADO",
          valorFechamento: valorFinal,
          dataFechamento: new Date(),
        },
        select: {
          id: true,
          valorFechamento: true,
          dataFechamento: true,
        },
      });

      resultado = {
        id: String(caixaFechado.id),
        valorFechamento: Number(caixaFechado.valorFechamento ?? valorFinal),
        dataFechamento: new Date(caixaFechado.dataFechamento ?? new Date()).toISOString(),
      };
    } else {
      resultado = await fecharCaixaViaSql(txAny, resumoAtual.caixaId, valorFinal);
    }

    // CaixaSession nao tem campo de observacao (sem migração nesta fase) — o
    // texto que o operador digita na contagem as cegas vai pro `motivo` do
    // log de auditoria, que ja existe exatamente pra guardar contexto livre
    // de uma acao. Nao aparece hoje em nenhuma tela de "Últimos fechamentos"
    // (essas leem só a tabela CaixaSession), só no log de auditoria.
    const observacaoNormalizada = observacao?.trim() || undefined;

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/caixa-pdv.ts:fecharCaixaSessionAtual"),
      {
        acao: ACOES_AUDITORIA.FECHAR_CAIXA,
        entidade: ENTIDADES_AUDITORIA.CAIXA_SESSION,
        entidadeId: resultado.id,
        motivo: observacaoNormalizada,
        dadosDepois: {
          valorAberturaCentavos: Math.round(resumoAtual.valorAbertura * 100),
          valorFechamentoCentavos: Math.round(resultado.valorFechamento * 100),
          totalVendasSessaoCentavos: Math.round(resumoAtual.totalVendasSessao * 100),
          dataFechamento: resultado.dataFechamento,
        },
      }
    );

    return resultado;
  });

  revalidatePath("/pdv");

  return fechamento;
}
