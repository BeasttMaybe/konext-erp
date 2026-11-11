"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";
import { obterResumoReceber } from "@/app/actions/financeiro-receber";
import { obterResumoPagar } from "@/app/actions/financeiro-pagar";
import {
  agoraNaLoja,
  comoDataDeCalendario,
  diferencaEntreDatasDeCalendario,
  fimDoDia,
  fimDoMes,
  FUSO_HORARIO_PADRAO,
  inicioDoDia,
  inicioDoMes,
  somarDias,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";
import { deDecimal, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import { calcularAbertoDoMes } from "@/lib/dominio/financeiro/aberto-do-mes";
import { categoriaDaDespesa } from "@/lib/dominio/financeiro/categoria-de-despesa";

/** Nome que `os-itens.ts` grava em `Despesa.fornecedor` pra custo de peça vindo de uma OS — não existe campo de origem no schema, então é este texto exato que distingue "peça de OS" de despesa de loja de verdade (Fase 3-2D). */
// A classificação mora em lib/dominio/financeiro/categoria-de-despesa.ts:
// a string estava copiada aqui e na tela, e no dia em que o rótulo mudasse
// num lugar o indicador e o filtro passariam a discordar em silêncio.

/**
 * `Venda.criadoEm`/`ParcelaDespesa.dataPagamento` são INSTANTE (não data de
 * calendário) — o mês certo é o mês no fuso da LOJA, nunca o do processo
 * (Vercel roda em UTC). Delega pro único módulo autorizado (lib/datas.ts).
 */
function inicioFimDoMes(referencia: Date = new Date(), fusoHorario: string = FUSO_HORARIO_PADRAO) {
  return { inicio: inicioDoMes(referencia, fusoHorario), fim: fimDoMes(referencia, fusoHorario) };
}

/**
 * "Saldo em caixa hoje" — dinheiro de verdade disponível AGORA, não uma
 * projeção. É só o caixa da loja (abertura + vendas em dinheiro da sessão
 * aberta); não existe conceito de "conta bancária" neste sistema hoje, então
 * a referência visual ("Caixa da loja + conta bancária") fica só com a
 * primeira metade — a segunda não tem de onde vir, e inventar seria mentir
 * um número. Sem caixa aberto, o saldo físico não é rastreado: mostra 0 com
 * um texto explícito, não um valor calculado como se fosse confiável.
 */
export interface SaldoEmCaixaHoje {
  valor: number;
  caixaAberto: boolean;
  valorAbertura: number;
}

export async function obterSaldoEmCaixaHoje(): Promise<SaldoEmCaixaHoje> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  const caixaAberto = await prisma.caixaSession.findFirst({
    where: { status: "ABERTO" },
    orderBy: { dataAbertura: "desc" },
    select: { id: true, valorAbertura: true },
  });

  if (!caixaAberto) {
    return { valor: 0, caixaAberto: false, valorAbertura: 0 };
  }

  const pagamentosDinheiro = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM(vp."valorBruto"), 0) AS total
    FROM "VendaPagamento" vp
    INNER JOIN "Venda" v ON v.id = vp."vendaId"
    WHERE v."caixaSessionId" = ${caixaAberto.id}
      AND vp."formaPagamento"::text = 'DINHEIRO'
  `;

  const valorAberturaCentavos = deDecimal(caixaAberto.valorAbertura ?? 0);
  const dinheiroVendasCentavos = deDecimal(pagamentosDinheiro[0]?.total ?? 0);

  return {
    valor: paraMoeda(somar(valorAberturaCentavos, dinheiroVendasCentavos)),
    caixaAberto: true,
    valorAbertura: paraMoeda(valorAberturaCentavos),
  };
}

/**
 * "A receber em aberto" / "A pagar em aberto" — todas as contas/parcelas
 * pendentes, de QUALQUER período (não só o mês atual — por isso
 * `todoPeriodo: true`), com a fatia vencida separada. Mesma fonte que as
 * telas A receber/A pagar usam (`obterResumoReceber`/`obterResumoPagar`),
 * então o número daqui sempre bate com o total "Em aberto" de lá.
 *
 * `totalPendente` e `totalAtrasado` são baldes DISJUNTOS lá (não vencido vs.
 * vencido) — "em aberto" aqui é a soma dos dois: tudo que ainda não foi
 * baixado, esteja vencido ou não. `atrasado` continua exposto à parte só
 * pra destacar a fatia preocupante dentro do total.
 */
export interface AbertoComAtraso {
  total: number;
  atrasado: number;
}

/**
 * Os cartoes "A receber" e "A pagar" da visao geral.
 *
 * Eles somavam `todoPeriodo: true` — ou seja, TODA parcela em aberto que
 * existe no banco — debaixo de um titulo que diz "Visao geral do mes".
 * Pergunta e resposta nao eram a mesma, e o dono reportou o sintoma: "esta
 * escrito que tenho 60k em contas a pagar o que nao e verdade".
 *
 * Sempre esteve errado, mas passava despercebido enquanto as parcelas
 * futuras se esgotavam com o tempo. Quando a despesa fixa mensal virou
 * recorrencia de verdade, com doze meses sempre materializados a frente, o
 * estoque de parcelas futuras deixou de acabar — e um ano inteiro de
 * aluguel, internet e contador passou a aparecer como divida do mes.
 *
 * A pergunta certa e "quanto ainda devo que vence ate o fim deste mes?".
 * Inclui o atrasado de meses anteriores, porque atraso e divida de agora; e
 * exclui o que vence depois, porque isso e compromisso futuro. A regra esta
 * em lib/dominio/financeiro/aberto-do-mes.ts, com testes nas bordas de data
 * que decidem se o painel conta um mes ou treze.
 */
/**
 * O ultimo dia deste mes, como data de calendario — o corte dos dois cartoes.
 *
 * Separado para que a MESMA data va ao `where` da consulta e a regra de
 * dominio: antes a consulta nao filtrava nada, trazia a tabela inteira
 * (inclusive tudo o que ja foi pago, desde sempre) e a regra descartava
 * quase tudo na memoria do servidor. O resultado e identico; o que muda e
 * que o banco deixa de entregar o historico inteiro a cada abertura do
 * Financeiro, e o custo para de crescer com o tempo de uso do sistema.
 */
function ultimoDiaDoMesCorrente(fusoHorario: string): Date {
  return comoDataDeCalendario(fimDoMes(new Date(), fusoHorario), fusoHorario);
}

async function abertoAteOFimDoMes(
  parcelas: Array<{ dataVencimento: Date; valor: unknown; liquidada: boolean }>,
  fusoHorario: string
): Promise<AbertoComAtraso> {
  const hoje = comoDataDeCalendario(new Date(), fusoHorario);
  const ultimoDia = ultimoDiaDoMesCorrente(fusoHorario);

  const { totalCentavos, atrasadoCentavos } = calcularAbertoDoMes({
    parcelas: parcelas.map((parcela) => ({
      dataVencimento: parcela.dataVencimento,
      valorCentavos: deDecimal(parcela.valor as never),
      estaLiquidada: parcela.liquidada,
    })),
    hoje,
    fimDoMes: ultimoDia,
  });

  return { total: paraMoeda(totalCentavos), atrasado: paraMoeda(atrasadoCentavos) };
}

async function obterReceberEmAberto(): Promise<AbertoComAtraso> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  const fusoHorario = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;

  // O filtro repete, no banco, o que `calcularAbertoDoMes` decide: so o que
  // NAO esta liquidado e vence ate o fim do mes. A regra continua sendo
  // aplicada depois — o `where` e so para nao trazer o que ela descartaria.
  // Os tres status sao os mesmos do `liquidada` logo abaixo; se um mudar, o
  // outro tem que mudar junto (guardado por
  // lib/dominio/financeiro/aberto-do-mes-no-banco.test.ts).
  const contas = await contexto.prisma.contaReceber.findMany({
    where: {
      estornadaEm: null,
      status: { notIn: ["RECEBIDO", "PAGO", "ESTORNADO"] },
      dataVencimento: { lte: ultimoDiaDoMesCorrente(fusoHorario) },
    },
    select: { dataVencimento: true, valor: true, status: true },
  });

  return abertoAteOFimDoMes(
    contas.map((conta) => ({
      dataVencimento: conta.dataVencimento,
      valor: conta.valor,
      liquidada: conta.status === "RECEBIDO" || conta.status === "PAGO" || conta.status === "ESTORNADO",
    })),
    contexto.fusoHorario ?? FUSO_HORARIO_PADRAO
  );
}

async function obterPagarEmAberto(): Promise<AbertoComAtraso> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  const fusoHorario = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;

  // Mesmo raciocinio de `obterReceberEmAberto`: esta consulta nao tinha
  // `where` nenhum e trazia TODA parcela ja criada, paga ou nao.
  const parcelas = await contexto.prisma.parcelaDespesa.findMany({
    where: {
      status: { not: "PAGO" },
      dataVencimento: { lte: ultimoDiaDoMesCorrente(fusoHorario) },
    },
    select: { dataVencimento: true, valor: true, status: true },
  });

  return abertoAteOFimDoMes(
    parcelas.map((parcela) => ({
      dataVencimento: parcela.dataVencimento,
      valor: parcela.valor,
      liquidada: parcela.status === "PAGO",
    })),
    contexto.fusoHorario ?? FUSO_HORARIO_PADRAO
  );
}

/**
 * "Resultado do mês" — Entradas menos Saídas, só o que JÁ aconteceu.
 * Entradas = `obterReceitaTotalPadrao`, a mesma função que o Dashboard usa
 * pra faturamento (exclui retorno de garantia) — reaproveitada aqui de
 * propósito pra o número do Financeiro sempre bater com o do Dashboard, não
 * ter duas contas "de faturamento" divergentes no sistema.
 * Saídas = parcelas de despesa já PAGAS com pagamento dentro do mês
 * (`dataPagamento`, não `dataVencimento` — o que ainda não foi pago não é
 * saída, é o "A pagar em aberto" de cima).
 */
export interface ResultadoDoMes {
  entradas: number;
  saidas: number;
  resultado: number;
}

async function obterResultadoDoMes(): Promise<ResultadoDoMes> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes(new Date(), contexto.fusoHorario);

  const [entradas, saidasBrutas] = await Promise.all([
    obterReceitaTotalPadrao(inicio, fim, prisma),
    prisma.parcelaDespesa.findMany({
      where: { status: "PAGO", dataPagamento: { gte: inicio, lte: fim } },
      select: { valorPago: true, valor: true },
    }),
  ]);

  const saidasCentavos = somar(...saidasBrutas.map((parcela) => deDecimal(parcela.valorPago ?? parcela.valor ?? 0)));
  const entradasCentavos = deDecimal(entradas);

  return {
    entradas,
    saidas: paraMoeda(saidasCentavos),
    resultado: paraMoeda(subtrair(entradasCentavos, saidasCentavos)),
  };
}

/**
 * Fluxo de caixa semanal do mês corrente: semanas que já passaram (ou a
 * atual, até hoje) são "realizado" — Entradas de `Venda.criadoEm`, Saídas de
 * `ParcelaDespesa.dataPagamento`, ambos só o que de fato aconteceu. Semanas
 * que ainda não chegaram são "projeção" — Entradas de `ContaReceber`
 * pendente por `dataVencimento`, Saídas de `ParcelaDespesa` pendente por
 * `dataVencimento`: o que está AGENDADO pra acontecer, não uma garantia.
 */
export interface SemanaFluxoCaixa {
  rotulo: string;
  entradas: number;
  saidas: number;
  projetado: boolean;
}

async function obterFluxoDeCaixaSemanal(): Promise<SemanaFluxoCaixa[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const hoje = agoraNaLoja(contexto.fusoHorario);
  const { inicio, fim } = inicioFimDoMes(hoje, contexto.fusoHorario);

  // Semanas parciais dentro do mês, no fuso da loja — nunca `setDate`/
  // `setHours` crus (fuso do processo). Cada semana carrega DOIS pares de
  // fronteira (correção da Fase 2A-2, Parte 1 do relatório — Caso 1): um
  // par de INSTANTE (`inicio`/`fim`, timestamptz no fuso da loja — usado só
  // contra `criadoEm`/`dataPagamento`, que são instantes de verdade) e um
  // par de DATA DE CALENDÁRIO (`inicioCalendario`/`fimCalendario`, meia-noite
  // UTC pura via `comoDataDeCalendario` — usado contra `dataVencimento`, que
  // é sempre calendário). Antes desta correção, o par de instante era
  // reaproveitado pros dois tipos de coluna, deslocando por até 3h (UTC−3)
  // uma parcela vencendo bem na virada do dia — mesmo padrão já corrigido em
  // `obterProjecaoSaldo`, agora replicado aqui.
  const semanas: { inicio: Date; fim: Date; inicioCalendario: Date; fimCalendario: Date; projetado: boolean }[] = [];
  let cursor = inicio;
  let numero = 1;
  while (cursor <= fim) {
    const fimSemanaBruto = fimDoDia(somarDias(cursor, 6, contexto.fusoHorario), contexto.fusoHorario);
    const fimReal = fimSemanaBruto > fim ? fim : fimSemanaBruto;
    semanas.push({
      inicio: cursor,
      fim: fimReal,
      inicioCalendario: comoDataDeCalendario(cursor, contexto.fusoHorario),
      fimCalendario: comoDataDeCalendario(fimReal, contexto.fusoHorario),
      projetado: fimReal > hoje,
    });
    cursor = inicioDoDia(somarDias(fimReal, 1, contexto.fusoHorario), contexto.fusoHorario);
    numero += 1;
    if (numero > 6) break; // guarda-corpo — meses têm no máximo 5-6 semanas parciais
  }

  const resultados = await Promise.all(
    semanas.map(async (semana) => {
      if (!semana.projetado) {
        const [vendas, pagas] = await Promise.all([
          prisma.venda.findMany({
            where: { criadoEm: { gte: semana.inicio, lte: semana.fim } },
            select: { valorTotal: true },
          }),
          prisma.parcelaDespesa.findMany({
            where: { status: "PAGO", dataPagamento: { gte: semana.inicio, lte: semana.fim } },
            select: { valorPago: true, valor: true },
          }),
        ]);
        const entradasCentavos = somar(...vendas.map((v) => deDecimal(v.valorTotal ?? 0)));
        const saidasCentavos = somar(...pagas.map((p) => deDecimal(p.valorPago ?? p.valor ?? 0)));
        return { entradas: paraMoeda(entradasCentavos), saidas: paraMoeda(saidasCentavos) };
      }

      const [receber, pagar] = await Promise.all([
        prisma.contaReceber.findMany({
          where: {
            status: "PENDENTE",
            dataVencimento: { gte: semana.inicioCalendario, lte: semana.fimCalendario },
          },
          select: { valor: true },
        }),
        prisma.parcelaDespesa.findMany({
          where: {
            status: "PENDENTE",
            dataVencimento: { gte: semana.inicioCalendario, lte: semana.fimCalendario },
          },
          select: { valor: true },
        }),
      ]);
      const entradasCentavos = somar(...receber.map((c) => deDecimal(c.valor ?? 0)));
      const saidasCentavos = somar(...pagar.map((p) => deDecimal(p.valor ?? 0)));
      return { entradas: paraMoeda(entradasCentavos), saidas: paraMoeda(saidasCentavos) };
    })
  );

  return semanas.map((semana, indice) => ({
    rotulo: `Sem ${indice + 1}`,
    entradas: resultados[indice]!.entradas,
    saidas: resultados[indice]!.saidas,
    projetado: semana.projetado,
  }));
}

/**
 * "Saídas por categoria" — não existe taxonomia de categoria de despesa no
 * schema (só `fornecedor`/`descricao`, texto livre). A única distinção que
 * dá pra derivar sem inventar dado é a mesma usada pra marcar origem de OS:
 * `fornecedor === "Custo de peça (OS)"`. Por isso só duas categorias reais
 * aqui — "Peça de OS" e "Despesas da loja" — não uma lista rica que o
 * sistema não tem como saber.
 */
export interface FatiaCategoria {
  nome: string;
  valor: number;
}

async function obterSaidasPorCategoria(): Promise<FatiaCategoria[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes(new Date(), contexto.fusoHorario);

  const pagas = await prisma.parcelaDespesa.findMany({
    where: { status: "PAGO", dataPagamento: { gte: inicio, lte: fim } },
    select: { valorPago: true, valor: true, despesa: { select: { fornecedor: true } } },
  });

  let pecaOsCentavos = 0;
  let lojaCentavos = 0;
  for (const parcela of pagas) {
    const valorCentavos = deDecimal(parcela.valorPago ?? parcela.valor ?? 0);
    if (categoriaDaDespesa(parcela.despesa?.fornecedor) === "PECA_OS") {
      pecaOsCentavos = somar(pecaOsCentavos, valorCentavos);
    } else {
      lojaCentavos = somar(lojaCentavos, valorCentavos);
    }
  }

  return [
    { nome: "Peça de OS", valor: paraMoeda(pecaOsCentavos) },
    { nome: "Despesas da loja", valor: paraMoeda(lojaCentavos) },
  ].filter((fatia) => fatia.valor > 0);
}

/** "Entradas por forma" — pagamentos de venda recebidos no mês, por forma. */
async function obterEntradasPorForma(): Promise<FatiaCategoria[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const { inicio, fim } = inicioFimDoMes(new Date(), contexto.fusoHorario);

  const linhas = await prisma.$queryRaw<Array<{ formaPagamento: string; total: number }>>`
    SELECT vp."formaPagamento"::text AS "formaPagamento", COALESCE(SUM(vp."valorBruto"), 0) AS total
    FROM "VendaPagamento" vp
    INNER JOIN "Venda" v ON v.id = vp."vendaId"
    WHERE v."criadoEm" >= ${inicio} AND v."criadoEm" <= ${fim}
    GROUP BY vp."formaPagamento"
    ORDER BY total DESC
  `;

  const rotulos: Record<string, string> = {
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    CARTAO_DEBITO: "Cartão de Débito",
    CARTAO_CREDITO: "Cartão de Crédito",
    CARTAO_CREDITO_AVISTA: "Cartão de Crédito",
    CARTAO_CREDITO_PARCELADO: "Cartão de Crédito",
    BOLETO: "Boleto",
    CREDIARIO: "Crediário",
    TED: "TED",
    EMPENHO_PUBLICO: "Empenho público",
    NAO_INFORMADO: "Não informado",
  };

  const porRotulo = new Map<string, number>();
  for (const linha of linhas) {
    const rotulo = rotulos[linha.formaPagamento] ?? linha.formaPagamento;
    porRotulo.set(rotulo, somar(porRotulo.get(rotulo) ?? 0, deDecimal(linha.total ?? 0)));
  }

  return Array.from(porRotulo.entries())
    .map(([nome, centavos]) => ({ nome, valor: paraMoeda(centavos) }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * "Precisa de atenção" — contas a receber e parcelas a pagar vencidas (ou
 * vencendo nos próximos 7 dias), receber e pagar juntos numa lista só, mais
 * antiga primeiro. Cada item aponta pra onde se resolve (A receber/A pagar).
 */
export interface ItemAtencao {
  id: string;
  tipo: "receber" | "pagar";
  titulo: string;
  valor: number;
  dataVencimento: Date;
  diasAtraso: number;
}

async function obterPrecisaDeAtencao(limite = 8): Promise<ItemAtencao[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  // `dataVencimento` (ContaReceber/ParcelaDespesa) é DATA DE CALENDÁRIO
  // (meia-noite UTC) — "hoje"/"daqui a 7 dias" precisam da mesma convenção,
  // nunca meia-noite do fuso da loja como instante. Ver lib/datas.ts.
  const hoje = comoDataDeCalendario(new Date(), contexto.fusoHorario);
  const em7Dias = somarDiasEmDataDeCalendario(hoje, 7);

  const [receber, pagar] = await Promise.all([
    prisma.contaReceber.findMany({
      where: { status: "PENDENTE", dataVencimento: { lte: em7Dias } },
      select: { id: true, valor: true, dataVencimento: true, descricao: true, cliente: { select: { nomeRazaoSocial: true } } },
      orderBy: { dataVencimento: "asc" },
      take: limite,
    }),
    prisma.parcelaDespesa.findMany({
      where: { status: "PENDENTE", dataVencimento: { lte: em7Dias } },
      select: { id: true, valor: true, dataVencimento: true, despesa: { select: { fornecedor: true, descricao: true } } },
      orderBy: { dataVencimento: "asc" },
      take: limite,
    }),
  ]);

  const diasDeAtraso = (vencimento: Date) =>
    Math.max(0, diferencaEntreDatasDeCalendario(vencimento, hoje));

  const itensReceber: ItemAtencao[] = receber.map((conta) => ({
    id: conta.id,
    tipo: "receber",
    titulo: conta.cliente?.nomeRazaoSocial || conta.descricao || "Conta a receber",
    valor: paraMoeda(deDecimal(conta.valor)),
    dataVencimento: conta.dataVencimento,
    diasAtraso: diasDeAtraso(conta.dataVencimento),
  }));

  const itensPagar: ItemAtencao[] = pagar.map((parcela) => ({
    id: parcela.id,
    tipo: "pagar",
    titulo: parcela.despesa?.fornecedor || parcela.despesa?.descricao || "Despesa",
    valor: paraMoeda(deDecimal(parcela.valor)),
    dataVencimento: parcela.dataVencimento,
    diasAtraso: diasDeAtraso(parcela.dataVencimento),
  }));

  return [...itensReceber, ...itensPagar]
    .sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
    .slice(0, limite);
}

export interface VisaoGeralFinanceiro {
  saldoEmCaixa: SaldoEmCaixaHoje;
  receberEmAberto: AbertoComAtraso;
  pagarEmAberto: AbertoComAtraso;
  resultadoDoMes: ResultadoDoMes;
  fluxoSemanal: SemanaFluxoCaixa[];
  saidasPorCategoria: FatiaCategoria[];
  entradasPorForma: FatiaCategoria[];
  precisaDeAtencao: ItemAtencao[];
}

export async function obterVisaoGeralFinanceiro(): Promise<VisaoGeralFinanceiro> {
  const [
    saldoEmCaixa,
    receberEmAberto,
    pagarEmAberto,
    resultadoDoMes,
    fluxoSemanal,
    saidasPorCategoria,
    entradasPorForma,
    precisaDeAtencao,
  ] = await Promise.all([
    obterSaldoEmCaixaHoje(),
    obterReceberEmAberto(),
    obterPagarEmAberto(),
    obterResultadoDoMes(),
    obterFluxoDeCaixaSemanal(),
    obterSaidasPorCategoria(),
    obterEntradasPorForma(),
    obterPrecisaDeAtencao(),
  ]);

  return {
    saldoEmCaixa,
    receberEmAberto,
    pagarEmAberto,
    resultadoDoMes,
    fluxoSemanal,
    saidasPorCategoria,
    entradasPorForma,
    precisaDeAtencao,
  };
}
