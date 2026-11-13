"use server";

import { revalidatePath } from "next/cache";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { chamarBling, ErroDoBling, esperarPelaVazao } from "@/lib/bling/api";
import { obterAccessTokenValido, registrarSincronizacao } from "@/lib/bling/conexao";
import { hojeComoDataDeCalendario, somarDiasEmDataDeCalendario, FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { deDecimal, paraDecimal } from "@/lib/dinheiro";
import {
  casarNotaComVenda,
  explicarNaoCasamento,
  type VendaCandidata,
} from "@/lib/dominio/bling/casamento-de-venda";
import { borderosDaConta, dataDeBaixaJaConhecida, lerBordero } from "@/lib/dominio/bling/bordero";
import {
  lerPaginaDeContas,
  referenciaDaConta,
} from "@/lib/dominio/bling/conta-a-receber";
import {
  lerDetalheDaNota,
  lerPaginaDeNotas,
  TIPO_SAIDA_NO_BLING,
  type NotaDeSaidaLida,
} from "@/lib/dominio/bling/nota-de-saida";
import { paraMensagemSegura } from "@/lib/erros";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Traz para o Konext as notas de saída emitidas no Bling.
 *
 * O desenho é o que o dono escolheu: ele emite no Bling, aqui só se lê. Nada
 * nesta função escreve no Bling.
 *
 * ELA É LIMITADA DE PROPÓSITO, EM DOIS EIXOS
 *
 * - **O Bling aceita 3 requisições por segundo**, e a listagem não traz o
 *   valor da nota: o valor vem no detalhe, uma requisição por nota. Então uma
 *   sincronização de cem notas são cem requisições, que não cabem no tempo de
 *   uma função.
 * - **Por isso o trabalho é dividido em duas fases.** A primeira é barata:
 *   lista as notas e grava o cabeçalho (número, chave, data, situação,
 *   cliente), com o valor em branco. A segunda é cara: busca o detalhe só das
 *   notas cujo valor ainda não foi lido, e para quando atinge o teto.
 *
 * O resultado é que a lista aparece inteira na primeira passada, e os valores
 * vão preenchendo nas seguintes. Isso é melhor que o contrário — uma tela
 * vazia por dois minutos — e é por isso que `valorTotal` aceita nulo: nota
 * sem valor lido mostra travessão, nunca R$ 0,00.
 */

/**
 * Quanto tempo a fase de detalhes pode gastar.
 *
 * Orçamento de relógio, não contagem fixa de notas: o limite real é o tempo
 * da função, e ele muda com o plano da hospedagem. Oito segundos cabem até
 * no menor deles, e a execução para sozinha quando o tempo acaba — a
 * seguinte continua de onde parou, porque o que decide quem falta é o banco
 * (`valorTotal` nulo), não um contador em memória.
 */
const ORCAMENTO_DE_DETALHES_EM_MS = 8_000;

/** Teto duro, para o caso de a rede estar muito rápida. */
const TETO_DE_DETALHES_POR_EXECUCAO = 40;

/**
 * Até quantos anos para trás buscar.
 *
 * A primeira versão olhava 90 dias, e foi assim que 79 notas do dono viraram
 * 19 aqui: as outras 60 eram mais antigas que a janela e nunca foram
 * procuradas. Nada no sistema dizia isso — a tela mostrava 19 notas com a
 * mesma cara de quem mostra todas.
 *
 * O histórico é varrido em janelas de um ano, do mais recente para o mais
 * antigo. Cinco anos cobre a vida de qualquer loja que vá adotar este
 * sistema, e a varredura é barata: uma requisição por ano, por execução.
 */
const ANOS_DE_HISTORICO = 5;

/** Páginas por janela de um ano. Cada uma traz até 100 notas. */
const TETO_DE_PAGINAS_POR_ANO = 10;

export type ResumoDaSincronizacao = {
  sucesso: boolean;
  mensagem: string;
  notasLidas: number;
  notasNovas: number;
  detalhesBuscados: number;
  vinculadasAVenda: number;
  contasCriadas: number;
  /** Quantas ainda esperam o valor. A próxima execução continua de onde parou. */
  faltamDetalhes: number;
  /**
   * O erro cru, quando houve. Só a tela do dono mostra, e só quando falha.
   *
   * Sem isto, uma falha de validação do Prisma vira "tente novamente em
   * instantes" — uma frase que manda tentar para sempre e não ajuda ninguém
   * a consertar.
   */
  detalhe?: string;
};

type DelegateGenerico = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findFirst?: (args?: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
};

function delegado(prisma: unknown, nome: string, alternativo: string): DelegateGenerico {
  const raiz = prisma as Record<string, DelegateGenerico | undefined>;
  const encontrado = raiz[nome] ?? raiz[alternativo];

  if (!encontrado?.findMany) {
    throw new ErroDoBling(`Delegate Prisma de ${nome} nao disponivel.`, null);
  }

  return encontrado;
}

type PrismaComRaw = {
  $queryRaw: <T>(consulta: TemplateStringsArray, ...valores: unknown[]) => Promise<T>;
};

/**
 * Acha o cliente pelo documento, comparando SÓ OS DÍGITOS dos dois lados.
 *
 * O Bling manda o documento limpo ("07945562000157"); o cadastro da Konext
 * grava de formas diferentes conforme o caminho — alguns pontos salvam só
 * dígitos, outros salvam o que a pessoa digitou, com ponto e barra. Comparar
 * texto cru faria o vínculo nunca acontecer para quem foi cadastrado à mão,
 * e o sintoma seria "o Bling não acha meus clientes", sem pista nenhuma.
 *
 * `regexp_replace` no banco resolve os dois lados de uma vez. É SQL direto
 * porque o Prisma não compara coluna normalizada, e normalizar em memória
 * exigiria carregar o cadastro inteiro a cada conta.
 */
async function acharClientePorDocumento(
  prisma: PrismaComRaw,
  documento: string | null
): Promise<{ id: string } | null> {
  const digitos = (documento ?? "").replace(/\D/g, "");
  if (digitos.length !== 11 && digitos.length !== 14) return null;

  const encontrados = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Cliente"
     WHERE regexp_replace(documento, '[^0-9]', '', 'g') = ${digitos}
     LIMIT 1
  `;

  return encontrados[0] ?? null;
}

type NotaGravada = {
  id: string;
  blingId: string | null;
  numero: string;
  valorTotal: unknown;
  pedidoId: string | null;
  clienteDocumento: string | null;
  dataEmissao: Date | null;
};

/**
 * Grava o cabeçalho das notas lidas da listagem.
 *
 * Atualiza em vez de duplicar porque `blingId` é único — e atualizar importa:
 * uma nota cancelada no Bling depois de emitida precisa chegar cancelada
 * aqui, senão a tela continuaria mostrando como válida uma nota que não é.
 */
async function gravarCabecalhos(
  notaFiscal: DelegateGenerico,
  lidas: NotaDeSaidaLida[]
): Promise<{ novas: number }> {
  let novas = 0;

  for (const lida of lidas) {
    const existente = (await notaFiscal.findFirst?.({
      where: { blingId: lida.blingId },
      select: { id: true },
    })) as { id: string } | null;

    const dados = {
      numero: lida.numero,
      serie: lida.serie,
      chaveAcesso: lida.chaveAcesso,
      status: lida.status,
      situacaoBling: lida.situacaoBling,
      dataEmissao: lida.dataEmissao,
      clienteNome: lida.clienteNome,
      clienteDocumento: lida.clienteDocumento,
    };

    if (existente) {
      await notaFiscal.update({ where: { id: existente.id }, data: dados });
    } else {
      await notaFiscal.create({ data: { ...dados, blingId: lida.blingId } });
      novas += 1;
    }
  }

  return { novas };
}

/**
 * Tenta reconhecer a venda do Konext que esta nota documenta.
 *
 * As candidatas são buscadas por CLIENTE, não por valor: a comparação de
 * valor é feita em centavos inteiros, e filtrar `Decimal` no banco por
 * igualdade de dinheiro é o tipo de coisa que funciona até o dia em que o
 * arredondamento difere. Buscar por cliente traz poucas linhas e deixa a
 * decisão inteira com a regra testada.
 */
async function tentarVincular({
  prisma,
  notaFiscal,
  nota,
  valorCentavos,
}: {
  prisma: PrismaComRaw;
  notaFiscal: DelegateGenerico;
  nota: NotaGravada;
  valorCentavos: number;
}): Promise<boolean> {
  const documento = (nota.clienteDocumento ?? "").replace(/\D/g, "");

  if (documento.length !== 11 && documento.length !== 14) {
    await notaFiscal.update({
      where: { id: nota.id },
      data: { motivoSemVinculo: explicarNaoCasamento("NOTA_SEM_DOCUMENTO") },
    });
    return false;
  }

  // Comparação por DÍGITOS, no banco. A versão anterior filtrava por
  // `contains: documento.slice(0, 11)` — um recorte arbitrário (os 11
  // primeiros dígitos de um CNPJ de 14 não significam nada) que, além disso,
  // nunca casaria um documento gravado com ponto e barra.
  const brutas = await prisma.$queryRaw<
    Array<{ id: string; total: string; dataCriacao: Date; documento: string }>
  >`
    SELECT pv.id, pv.total::text AS total, pv."dataCriacao", c.documento
      FROM "PedidoVenda" pv
      JOIN "Cliente" c ON c.id = pv."clienteId"
     WHERE regexp_replace(c.documento, '[^0-9]', '', 'g') = ${documento}
     LIMIT 50
  `;

  const candidatas: VendaCandidata[] = brutas.map((bruta) => ({
    id: bruta.id,
    clienteDocumento: bruta.documento,
    valorCentavos: deDecimal(bruta.total),
    data: bruta.dataCriacao,
  }));

  const resultado = casarNotaComVenda({
    nota: {
      clienteDocumento: nota.clienteDocumento,
      valorCentavos,
      dataEmissao: nota.dataEmissao,
    },
    candidatas,
  });

  await notaFiscal.update({
    where: { id: nota.id },
    data: resultado.casou
      ? { pedidoId: resultado.vendaId, motivoSemVinculo: null }
      : { pedidoId: null, motivoSemVinculo: explicarNaoCasamento(resultado.motivo) },
  });

  return resultado.casou;
}

/**
 * Traz as contas a receber do Bling, com a situação que elas têm LÁ.
 *
 * Esta fase substitui a criação de contas a partir das parcelas da nota. A
 * diferença é o campo `situacao`: a parcela da nota é plano de pagamento e
 * não tem estado; a conta tem, e é por isso que ela é a fonte certa.
 *
 * Quando o CPF/CNPJ da conta bate com alguém do cadastro, a conta é
 * VINCULADA a esse cliente — assim ela aparece com nome de cliente nas telas
 * que já sabem mostrar cliente, em vez de depender do texto da descrição.
 */
/**
 * A data em que a conta foi efetivamente baixada no Bling.
 *
 * Custa duas chamadas: o detalhe da conta (que tem os ids de bordero) e o
 * bordero (que tem a data). Nao ha caminho mais curto -- a lista nao traz
 * nenhum dos dois.
 *
 * O CACHE DE BORDEROS E O QUE TORNA ISTO VIAVEL
 *
 * Um bordero e um LOTE: varias contas baixadas juntas compartilham o mesmo.
 * Sem cache, uma baixa de trinta contas custaria trinta leituras do mesmo
 * bordero, a 3 requisicoes por segundo.
 *
 * Devolve `null` quando nao da para saber -- conta sem bordero, bordero sem
 * data, erro de rede. `null` deixa a conta FORA do faturamento, que e o
 * comportamento certo: numero ausente numa tela de dinheiro e melhor que
 * numero errado.
 */
async function buscarDataDaBaixa(
  accessToken: string,
  blingIdDaConta: string,
  cache: Map<string, Date | null>
): Promise<Date | null> {
  try {
    await esperarPelaVazao();
    const detalhe = await chamarBling({
      accessToken,
      caminho: `/contas/receber/${blingIdDaConta}`,
    });

    const [idDoBordero] = borderosDaConta(detalhe);
    if (!idDoBordero) return null;

    if (cache.has(idDoBordero)) return cache.get(idDoBordero) ?? null;

    await esperarPelaVazao();
    const resposta = await chamarBling({ accessToken, caminho: `/borderos/${idDoBordero}` });
    const bordero = lerBordero(resposta);

    cache.set(idDoBordero, bordero?.data ?? null);
    return bordero?.data ?? null;
  } catch (erro) {
    // Uma conta sem data nao pode derrubar a sincronizacao inteira: as
    // outras contas e as notas continuam valendo.
    console.error(`Nao consegui ler a data de baixa da conta ${blingIdDaConta} no Bling:`, erro);
    return null;
  }
}

async function importarContasAReceber({
  accessToken,
  contaReceber,
  prisma,
  hoje,
  comoData,
}: {
  accessToken: string;
  contaReceber: DelegateGenerico;
  prisma: PrismaComRaw;
  hoje: Date;
  comoData: (data: Date) => string;
}): Promise<number> {
  let criadas = 0;
  /** Bordero ja lido nesta sincronizacao -> data. Ver `buscarDataDaBaixa`. */
  const cacheDeBorderos = new Map<string, Date | null>();

  for (let ano = 0; ano < ANOS_DE_HISTORICO; ano += 1) {
    const fimDaJanela = somarDiasEmDataDeCalendario(hoje, -365 * ano);
    const inicioDaJanela = somarDiasEmDataDeCalendario(hoje, -365 * (ano + 1) + 1);

    for (let pagina = 1; pagina <= TETO_DE_PAGINAS_POR_ANO; pagina += 1) {
      await esperarPelaVazao();

      const resposta = await chamarBling({
        accessToken,
        caminho: "/contas/receber",
        parametros: {
          dataInicial: comoData(inicioDaJanela),
          dataFinal: comoData(fimDaJanela),
          limite: 100,
          pagina,
        },
      });

      const daPagina = lerPaginaDeContas(resposta);
      if (daPagina.length === 0) break;

      for (const conta of daPagina) {
        const referencia = referenciaDaConta(conta.blingId);

        const existente = (await contaReceber.findFirst?.({
          where: { blingParcelaRef: referencia },
          select: { id: true, status: true, dataRecebimento: true },
        })) as { id: string; status: string | null; dataRecebimento: Date | null } | null;

        // Busca o cliente pelo documento. Sem documento não procura: nome
        // não identifica ninguém com segurança, e vincular a conta ao
        // cliente errado é pior que deixá-la sem cliente.
        const clienteLocal = await acharClientePorDocumento(prisma, conta.clienteDocumento);

        // A DATA EM QUE O DINHEIRO ENTROU, para conta ja recebida.
        //
        // Nem a lista nem o detalhe da conta tem essa data: o detalhe traz
        // `vencimento`, `dataEmissao`, `competencia` e `vencimentoOriginal`,
        // todos definidos na CRIACAO. A data da baixa mora no bordero, que o
        // detalhe referencia por id -- duas chamadas a mais por conta.
        //
        // Vale o custo: a primeira conta real do dono vencia em 08/01 e foi
        // paga em 15/01. Usar o vencimento como atalho jogaria a receita para
        // a semana errada, e numa conta que vence dia 28 e e paga dia 3, para
        // o MES errado.
        //
        // So se paga esse custo UMA vez por conta: a data ja gravada e
        // reaproveitada (ver `dataDeBaixaJaConhecida`). Antes, toda
        // sincronizacao refazia as chamadas de todas as contas recebidas.
        const dataRecebimento =
          conta.status === "RECEBIDO"
            ? (dataDeBaixaJaConhecida(conta.status, existente) ??
              (await buscarDataDaBaixa(accessToken, conta.blingId, cacheDeBorderos)))
            : null;

        const dados = {
          descricao: conta.descricao,
          valor: paraDecimal(deDecimal(conta.valorReais)),
          dataVencimento: conta.vencimento,
          dataRecebimento,
          status: conta.status,
          origem: "BLING" as const,
          formaRecebimento: "NAO_INFORMADO" as const,
          clienteId: clienteLocal?.id ?? null,
        };

        if (existente) {
          // Atualizar importa tanto quanto criar: uma conta baixada no Bling
          // depois da última sincronização precisa deixar de aparecer como
          // devida aqui.
          await contaReceber.update({ where: { id: existente.id }, data: dados });
        } else {
          await contaReceber.create({ data: { ...dados, blingParcelaRef: referencia } });
          criadas += 1;
        }
      }

      if (daPagina.length < 100) break;
    }
  }

  return criadas;
}

export async function sincronizarNotasDoBling(): Promise<ResumoDaSincronizacao> {
  const vazio = {
    notasLidas: 0,
    notasNovas: 0,
    detalhesBuscados: 0,
    vinculadasAVenda: 0,
    contasCriadas: 0,
    faltamDetalhes: 0,
  };

  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.editar");

    const { prisma } = contexto;
    const notaFiscal = delegado(prisma, "notaFiscal", "NotaFiscal");
    const contaReceber = delegado(prisma, "contaReceber", "ContaReceber");

    const accessToken = await obterAccessTokenValido(prisma, contexto.empresaId);

    const hoje = hojeComoDataDeCalendario(contexto.fusoHorario ?? FUSO_HORARIO_PADRAO);
    const comoData = (data: Date) => data.toISOString().slice(0, 10);

    // ── Fase barata: a listagem, ano a ano para trás ───────────────────────
    //
    // A varredura é sempre do histórico inteiro, não só do que mudou. Isso é
    // de propósito: nota muda de situação DEPOIS de emitida (uma cancelada em
    // janeiro continua cancelada e precisa chegar assim aqui), e `blingId`
    // único faz cada leitura atualizar em vez de duplicar. O custo é uma
    // requisição por ano.
    let lidas = 0;
    let novas = 0;

    for (let ano = 0; ano < ANOS_DE_HISTORICO; ano += 1) {
      const fimDaJanela = somarDiasEmDataDeCalendario(hoje, -365 * ano);
      const inicioDaJanela = somarDiasEmDataDeCalendario(hoje, -365 * (ano + 1) + 1);

      for (let pagina = 1; pagina <= TETO_DE_PAGINAS_POR_ANO; pagina += 1) {
        await esperarPelaVazao();

        const resposta = await chamarBling({
          accessToken,
          caminho: "/nfe",
          parametros: {
            tipo: TIPO_SAIDA_NO_BLING,
            dataEmissaoInicial: `${comoData(inicioDaJanela)} 00:00:00`,
            dataEmissaoFinal: `${comoData(fimDaJanela)} 23:59:59`,
            limite: 100,
            pagina,
          },
        });

        const daPagina = lerPaginaDeNotas(resposta);
        if (daPagina.length === 0) break;

        const resultado = await gravarCabecalhos(notaFiscal, daPagina);
        lidas += daPagina.length;
        novas += resultado.novas;

        // Página incompleta é a última: não existe próxima para buscar.
        if (daPagina.length < 100) break;
      }

      // Repare que um ano VAZIO não interrompe o laço de fora: uma loja pode
      // ter parado de emitir por um período e voltado. Parar no primeiro ano
      // sem notas deixaria todo o histórico anterior invisível para sempre.
    }

    // ── Fase cara: o detalhe, só de quem ainda não tem valor ───────────────
    const semValor = (await notaFiscal.findMany({
      where: { blingId: { not: null }, valorTotal: null },
      select: {
        id: true,
        blingId: true,
        numero: true,
        valorTotal: true,
        pedidoId: true,
        clienteDocumento: true,
        dataEmissao: true,
      },
      orderBy: { dataEmissao: "desc" },
      take: TETO_DE_DETALHES_POR_EXECUCAO,
    })) as NotaGravada[];

    let detalhesBuscados = 0;
    let vinculadas = 0;
    let contasCriadas = 0;

    const comecouEm = Date.now();

    for (const nota of semValor) {
      if (!nota.blingId) continue;

      // Para quando o tempo acaba, não quando a lista acaba. A próxima
      // execução recomeça pelas que ainda estão sem valor.
      if (Date.now() - comecouEm > ORCAMENTO_DE_DETALHES_EM_MS) break;

      await esperarPelaVazao();

      const detalhe = lerDetalheDaNota(
        await chamarBling({ accessToken, caminho: `/nfe/${nota.blingId}` })
      );

      detalhesBuscados += 1;
      if (!detalhe || detalhe.valorNotaReais === null) continue;

      const valorCentavos = deDecimal(detalhe.valorNotaReais);

      await notaFiscal.update({
        where: { id: nota.id },
        data: {
          valorTotal: paraDecimal(valorCentavos),
          serie: detalhe.serie,
          linkXml: detalhe.linkXml,
          linkDanfe: detalhe.linkDanfe,
          descricaoItens: detalhe.descricaoDosItens,
        },
      });

      const casou = await tentarVincular({
        prisma: prisma as unknown as PrismaComRaw,
        notaFiscal,
        nota,
        valorCentavos,
      });
      if (casou) vinculadas += 1;

      // A conta a receber NÃO nasce mais daqui.
      //
      // As parcelas da nota são o PLANO de pagamento — "R$ 250 em 01/12" — e
      // plano não tem estado: não existe ali campo nenhum dizendo se foi
      // pago. Criar a conta a partir delas fez notas de janeiro, já baixadas
      // no Bling, aparecerem como dívida atrasada no Contas a Receber.
      //
      // Quem sabe o que foi recebido é `/contas/receber`, com o campo
      // `situacao`. É de lá que as contas vêm agora — ver a fase abaixo.
    }

    // ── Fase das contas a receber ──────────────────────────────────────────
    contasCriadas = await importarContasAReceber({
      accessToken,
      contaReceber,
      prisma: prisma as unknown as PrismaComRaw,
      hoje,
      comoData,
    });

    const [faltamDetalhes, totalNoKonext] = await Promise.all([
      notaFiscal.count({ where: { blingId: { not: null }, valorTotal: null } }),
      notaFiscal.count({ where: { blingId: { not: null } } }),
    ]);

    await registrarSincronizacao({ prisma, erro: null });

    revalidatePath("/financeiro/notas-fiscais");
    revalidatePath("/financeiro/receber");

    return {
      sucesso: true,
      // A mensagem diz quantas EXISTEM aqui, não quantas foram lidas agora:
      // é o número que o dono compara com o Bling. Dizer só "lidas" escondeu
      // que 60 notas nunca tinham sido procuradas.
      mensagem:
        faltamDetalhes > 0
          ? `${totalNoKonext} notas e ${contasCriadas} contas novas. Faltam ${faltamDetalhes} valores — clique de novo para continuar.`
          : `${totalNoKonext} notas no Konext, tudo em dia. ${contasCriadas} contas a receber novas.`,
      notasLidas: lidas,
      notasNovas: novas,
      detalhesBuscados,
      vinculadasAVenda: vinculadas,
      contasCriadas,
      faltamDetalhes,
    };
  } catch (erro) {
    const mensagem = erro instanceof ErroDoBling ? erro.message : paraMensagemSegura(erro);

    // O DETALHE CRU vai para `ultimoErro`, que só a tela do dono mostra.
    //
    // A mascara de `paraMensagemSegura` existe para não vazar interno para o
    // cliente, e está certa. Mas ela transformou um erro de validação do
    // Prisma — campo obrigatório faltando — em "Não foi possível concluir a
    // operação. Tente novamente em instantes.", que mandava o dono tentar de
    // novo para sempre, e não dizia nada a quem fosse consertar.
    //
    // Guardar o texto real num campo que só o dono vê não vaza nada e é a
    // diferença entre diagnosticar em um minuto ou em uma hora.
    const detalhe = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
    console.error("[bling] falha na sincronizacao:", erro);

    try {
      const contexto = await exigirContextoTenant();
      await registrarSincronizacao({ prisma: contexto.prisma, erro: detalhe });
    } catch {
      // Se nem o contexto abre, não há onde registrar — a mensagem volta na tela.
    }

    return { sucesso: false, mensagem, detalhe, ...vazio };
  }
}
