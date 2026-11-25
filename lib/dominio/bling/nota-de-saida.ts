/**
 * Traduz uma nota fiscal do Bling para o que a Konext entende.
 *
 * Puro de propósito: nenhuma rede, nenhum banco. É aqui que mora tudo o que
 * pode dar errado em silêncio na importação, então é aqui que os testes
 * precisam alcançar.
 *
 * O QUE A RESPOSTA REAL DO BLING TEM DE ARMADILHA
 *
 * As três foram vistas num registro de verdade, não imaginadas:
 *
 * 1. **`"dataOperacao": "0000-00-00 00:00:00"`** — data-zero do MySQL. Não é
 *    "sem data": é um valor que PARECE data e vira `Invalid Date`. Gravado
 *    sem guarda, a nota apareceria com data vazia ou quebraria a tela.
 *
 * 2. **`"dataEmissao": "2026-11-03 15:11:00"` sem fuso.** É exatamente a
 *    classe de bug que tirou os boletos do dia 30 do filtro de período:
 *    `new Date()` nessa string ancora no fuso de quem executa. Data de
 *    emissão de nota é DATA DE CALENDÁRIO — o dia 3 é dia 3 em qualquer
 *    lugar —, então só a parte da data é lida.
 *
 * 3. **`"numero": "000079"` é texto, com zeros à esquerda.** Virar número
 *    perderia os zeros e o número impresso na nota deixaria de bater com o
 *    número na tela.
 *
 * E uma quarta, que não é armadilha e sim limite: **a listagem não traz o
 * valor da nota**. Ele vem só no detalhe, uma requisição por nota.
 */

import { dataDeCalendario } from "@/lib/datas";

/** Como o Bling classifica a nota. Confirmado na documentação do Bling. */
export const SITUACOES_DO_BLING: Record<number, string> = {
  1: "Pendente",
  2: "Cancelada",
  3: "Aguardando recibo",
  4: "Rejeitada",
  5: "Autorizada",
  6: "Emitida DANFE",
  7: "Registrada",
  8: "Aguardando protocolo",
  9: "Denegada",
  10: "Consulta situação",
  11: "Bloqueada",
};

/** 0 = entrada, 1 = saída. Só saída interessa a esta tela. */
export const TIPO_SAIDA_NO_BLING = 1;

export type StatusDaNota = "EMITIDA" | "CANCELADA" | "PENDENTE";

/**
 * Agrupa as onze situações do Bling nos três estados que importam.
 *
 * A Konext não precisa saber a diferença entre "aguardando recibo" e
 * "aguardando protocolo" para decidir o que mostrar — mas o código cru é
 * guardado junto, e é ele que a tela exibe por extenso. Assim a lista pode
 * dizer "Rejeitada" com precisão sem que o resto do sistema precise aprender
 * onze estados.
 *
 * Rejeitada (4) fica em PENDENTE, não em CANCELADA: uma nota rejeitada não
 * virou nota nenhuma e ainda espera uma ação do dono. Chamá-la de cancelada
 * esconderia um problema que precisa ser resolvido.
 *
 * Denegada (9) vai para CANCELADA: a nota existe no SEFAZ e nunca vai
 * produzir efeito — não há o que corrigir.
 */
export function statusDaSituacaoDoBling(situacao: number): StatusDaNota {
  if (situacao === 2 || situacao === 9) return "CANCELADA";
  if (situacao === 5 || situacao === 6 || situacao === 7) return "EMITIDA";
  return "PENDENTE";
}

export function rotuloDaSituacaoDoBling(situacao: number | null | undefined): string {
  if (situacao === null || situacao === undefined) return "—";
  return SITUACOES_DO_BLING[situacao] ?? `Situação ${situacao}`;
}

export type NotaDeSaidaLida = {
  /** Id do Bling, como TEXTO: são 11 dígitos e crescem. */
  blingId: string;
  numero: string;
  serie: string | null;
  chaveAcesso: string | null;
  status: StatusDaNota;
  situacaoBling: number | null;
  /** Data de calendário em meia-noite UTC, ou nulo se o Bling não mandou uma. */
  dataEmissao: Date | null;
  clienteNome: string | null;
  clienteDocumento: string | null;
};

function texto(valor: unknown): string | null {
  if (typeof valor === "string") {
    const limpo = valor.trim();
    return limpo === "" ? null : limpo;
  }
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/**
 * Lê a data do jeito do Bling: `"2026-11-03 15:11:00"`.
 *
 * Só a parte da data é aproveitada, e ela vira meia-noite UTC — a convenção
 * de data de calendário do projeto. A hora da emissão existe no Bling, mas
 * guardá-la aqui traria de volta o bug que acabou de ser consertado no
 * financeiro, em troca de uma informação que ninguém consulta.
 *
 * `"0000-00-00 00:00:00"` devolve nulo, que é a verdade: o Bling não mandou
 * data nenhuma. É melhor uma nota sem data na tela do que uma nota com data
 * inventada.
 */
export function lerDataDoBling(valor: unknown): Date | null {
  const bruto = texto(valor);
  if (!bruto) return null;

  const encontrado = /^(\d{4})-(\d{2})-(\d{2})/.exec(bruto);
  if (!encontrado) return null;

  const [, ano, mes, dia] = encontrado;

  // A data-zero do MySQL passa pelo formato e não é data. `dataDeCalendario`
  // recusa mês 00 e dia 00, mas a checagem fica explícita porque é o caso que
  // apareceu no primeiro registro real lido do Bling.
  if (ano === "0000" || mes === "00" || dia === "00") return null;

  return dataDeCalendario(`${ano}-${mes}-${dia}`);
}

/**
 * Tira a série da chave de acesso.
 *
 * A listagem não traz a série num campo próprio, mas a chave de 44 dígitos
 * traz: posições 22-24. Número e série juntos são o que identifica uma nota
 * para o contador, e mostrar só o número deixaria a tela ambígua para quem
 * usa mais de uma série.
 */
export function serieDaChave(chave: string | null): string | null {
  if (!chave || !/^\d{44}$/.test(chave)) return null;
  return chave.slice(22, 25);
}

/**
 * Converte um item da listagem `/nfe`.
 *
 * Devolve `null` para o que não é nota de saída ou não tem identificação —
 * importar uma nota sem id seria criar uma linha que nunca mais poderia ser
 * atualizada nem reconhecida numa próxima sincronização.
 */
export function lerNotaDeSaidaDoBling(bruto: unknown): NotaDeSaidaLida | null {
  const nota = objeto(bruto);
  if (!nota) return null;

  const blingId = texto(nota.id);
  if (!blingId) return null;

  // Nota de ENTRADA é compra, não venda: ela tem o seu próprio caminho na
  // Konext (a entrada de nota de compra) e não pertence a esta tela.
  if (typeof nota.tipo === "number" && nota.tipo !== TIPO_SAIDA_NO_BLING) return null;

  const situacao = typeof nota.situacao === "number" ? nota.situacao : null;
  const chaveAcesso = texto(nota.chaveAcesso);
  const contato = objeto(nota.contato);

  return {
    blingId,
    numero: texto(nota.numero) ?? blingId,
    serie: serieDaChave(chaveAcesso),
    chaveAcesso: chaveAcesso && /^\d{44}$/.test(chaveAcesso) ? chaveAcesso : null,
    status: statusDaSituacaoDoBling(situacao ?? 1),
    situacaoBling: situacao,
    dataEmissao: lerDataDoBling(nota.dataEmissao),
    clienteNome: contato ? texto(contato.nome) : null,
    clienteDocumento: contato ? texto(contato.numeroDocumento)?.replace(/\D/g, "") ?? null : null,
  };
}

/** Converte a página inteira, descartando o que não é nota de saída. */
export function lerPaginaDeNotas(resposta: unknown): NotaDeSaidaLida[] {
  const envelope = objeto(resposta);
  const dados = envelope?.data;

  if (!Array.isArray(dados)) return [];

  return dados
    .map(lerNotaDeSaidaDoBling)
    .filter((nota): nota is NotaDeSaidaLida => nota !== null);
}

/**
 * O detalhe da nota: `/nfe/{id}`.
 *
 * Existe porque a LISTAGEM não traz o valor. O detalhe traz — e traz mais
 * duas coisas que mudam o que dá para fazer:
 *
 * - **`parcelas`**, cada uma com `data` e `valor`. É daqui que sai a conta a
 *   receber, com a data de vencimento que o dono pediu, sem precisar bater
 *   na API de contas: já veio junto.
 * - **`xml` e `linkDanfe`**, endereços diretos do arquivo e do documento no
 *   Bling. São eles que permitem baixar a nota sem sair do Konext.
 *
 * `serie` aqui é NÚMERO (`1`), enquanto na chave de acesso é `"001"`. A da
 * chave é a que o contador lê, então ela continua sendo a preferida; esta é
 * a reserva para quando não houver chave.
 */

export type ParcelaDaNota = {
  /** Vencimento, como data de calendário. */
  vencimento: Date;
  valorReais: number;
};

/**
 * Um item da nota, como o detalhe do Bling descreve. Valores em REAIS; a
 * conversão para centavos é de quem grava. `ordem` é a posição (1, 2, 3...),
 * usada como chave de idempotência ao gravar.
 */
export type ItemDaNota = {
  ordem: number;
  descricao: string;
  quantidade: number;
  valorUnitarioReais: number;
  valorTotalReais: number;
};

export type DetalheDaNota = {
  blingId: string;
  /** Em REAIS, como o Bling manda. A conversão para centavos é de quem grava. */
  valorNotaReais: number | null;
  serie: string | null;
  linkXml: string | null;
  linkDanfe: string | null;
  parcelas: ParcelaDaNota[];
  itens: ItemDaNota[];
  /** Total de tributos da nota, em REAIS, quando o Bling o traz. NULO = desconhecido. */
  impostosReais: number | null;
  /** Descrição dos itens, para a tela dizer o que foi vendido. */
  descricaoDosItens: string | null;
};

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : null;
  }
  return null;
}

/**
 * Só aceita endereço https do próprio Bling.
 *
 * Estes links são guardados e viram botão na tela. Guardar e clicar no que
 * veio de fora sem conferir o destino é como um link de terceiro entra num
 * sistema — e o fato de a resposta ser do Bling hoje não é razão para a tela
 * abrir qualquer endereço que apareça nesse campo amanhã.
 */
function linkDoBling(valor: unknown): string | null {
  const bruto = texto(valor);
  if (!bruto) return null;

  try {
    const url = new URL(bruto);
    const ehDoBling = url.hostname === "bling.com.br" || url.hostname.endsWith(".bling.com.br");

    return url.protocol === "https:" && ehDoBling ? bruto : null;
  } catch {
    return null;
  }
}

export function lerDetalheDaNota(resposta: unknown): DetalheDaNota | null {
  const envelope = objeto(resposta);
  const nota = objeto(envelope?.data) ?? envelope;
  if (!nota) return null;

  const blingId = texto(nota.id);
  if (!blingId) return null;

  const serieBruta = texto(nota.serie);
  const brutosItens = Array.isArray(nota.itens) ? nota.itens : [];

  const itens: ItemDaNota[] = [];
  for (const bruto of brutosItens) {
    const item = objeto(bruto);
    const descricao = item ? texto(item.descricao) : null;
    if (!item || !descricao) continue;

    const quantidade = numero(item.quantidade) ?? 1;
    const valorUnitarioReais = numero(item.valor) ?? 0;
    // O detalhe nem sempre traz o total da linha; quando falta, é quantidade ×
    // valor unitário. Preferimos o campo do Bling quando ele existe.
    const valorTotalReais = numero(item.valorTotal) ?? quantidade * valorUnitarioReais;

    itens.push({
      ordem: itens.length + 1,
      descricao,
      quantidade,
      valorUnitarioReais,
      valorTotalReais,
    });
  }

  const descricoes = itens.map((item) => item.descricao);

  const parcelas: ParcelaDaNota[] = (Array.isArray(nota.parcelas) ? nota.parcelas : [])
    .map((bruta) => {
      const parcela = objeto(bruta);
      if (!parcela) return null;

      const vencimento = lerDataDoBling(parcela.data);
      const valorReais = numero(parcela.valor);

      // Parcela sem data ou sem valor não vira conta a receber: ela não teria
      // quando vencer nem quanto cobrar, e uma conta assim na tela é pior que
      // conta nenhuma.
      if (!vencimento || valorReais === null) return null;

      return { vencimento, valorReais };
    })
    .filter((parcela): parcela is ParcelaDaNota => parcela !== null);

  // Total de tributos: o Bling guarda num objeto `tributos`. Quando não vier,
  // fica NULO — o cálculo de lucro líquido trata imposto desconhecido como
  // zero, mas sinaliza na tela que não foi considerado.
  const tributos = objeto(nota.tributos);
  const impostosReais = tributos
    ? numero(tributos.totalTributos) ?? numero(tributos.valorTotalTributos)
    : numero(nota.totalImpostos);

  return {
    blingId,
    valorNotaReais: numero(nota.valorNota),
    serie: serieDaChave(texto(nota.chaveAcesso)) ?? serieBruta,
    linkXml: linkDoBling(nota.xml),
    linkDanfe: linkDoBling(nota.linkDanfe),
    parcelas,
    itens,
    impostosReais,
    descricaoDosItens: descricoes.length > 0 ? descricoes.join(", ").slice(0, 300) : null,
  };
}
