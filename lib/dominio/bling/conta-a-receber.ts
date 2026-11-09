/**
 * Conta a receber do Bling.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * A primeira versão criava as contas a partir das PARCELAS DA NOTA. As
 * parcelas da nota são o plano de pagamento — "R$ 250 em 01/12" —, e plano
 * não tem estado: não existe ali campo nenhum dizendo se foi pago. Então
 * tudo nascia PENDENTE, e notas de janeiro apareceram como dívida atrasada
 * num Contas a Receber que o dono olha para saber quanto tem a receber.
 *
 * Quem sabe o que foi baixado é `/contas/receber`, onde cada conta tem
 * `situacao`. O dado sempre esteve lá — a primeira amostra que o dono mandou
 * já vinha com `situacao: 2`, "Recebido", e eu não usei.
 *
 * A lição que fica no código: ao integrar, a fonte certa é a que carrega o
 * ESTADO, não a que carrega a intenção.
 */

import { dataDeCalendario } from "@/lib/datas";

/** Códigos de `situacao` das contas a receber do Bling. */
export const SITUACOES_DE_CONTA = {
  EM_ABERTO: 1,
  RECEBIDO: 2,
  PARCIALMENTE_RECEBIDO: 3,
  DEVOLVIDO: 4,
  CANCELADO: 5,
} as const;

/** Os estados que a Konext usa. */
export type StatusDaConta = "PENDENTE" | "RECEBIDO" | "ESTORNADO";

/**
 * Traduz a situação do Bling para o estado da Konext.
 *
 * `PARCIALMENTE_RECEBIDO` vira PENDENTE, e não RECEBIDO: ainda há saldo a
 * receber. O valor que sobra só existe no detalhe da conta (campo `saldo`),
 * que esta importação não busca — então a conta aparece pelo valor cheio.
 * Isso superestima o que falta receber, e é o erro certo a cometer: uma
 * conta que aparece como devida e já foi parcialmente paga é corrigida ao
 * dar baixa; uma que some porque foi chamada de recebida não volta sozinha.
 *
 * `DEVOLVIDO` e `CANCELADO` viram ESTORNADO — o estado que a Konext usa para
 * "existiu e não vai ser recebida", que fica fora dos dois totais e continua
 * consultável.
 */
export function statusDaSituacaoDaConta(situacao: number): StatusDaConta {
  if (situacao === SITUACOES_DE_CONTA.RECEBIDO) return "RECEBIDO";
  if (
    situacao === SITUACOES_DE_CONTA.DEVOLVIDO ||
    situacao === SITUACOES_DE_CONTA.CANCELADO
  ) {
    return "ESTORNADO";
  }

  return "PENDENTE";
}

export type ContaDoBlingLida = {
  /** Id da conta no Bling, como texto. */
  blingId: string;
  descricao: string;
  valorReais: number;
  vencimento: Date;
  status: StatusDaConta;
  situacaoBling: number | null;
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

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : null;
  }
  return null;
}

/**
 * Monta o nome que aparece na lista.
 *
 * "(Bling)" na frente foi pedido pelo dono: é o que deixa claro de onde a
 * conta veio sem precisar abrir nada. Depois vem o que identifica a venda —
 * o tipo e o número da origem no Bling, que é por onde ele acha lá.
 */
function montarDescricao(conta: Record<string, unknown>, clienteNome: string | null): string {
  const origem = objeto(conta.origem);
  const tipo = texto(origem?.tipoOrigem);
  const numeroOrigem = texto(origem?.numero);

  const referencia =
    tipo && numeroOrigem
      ? `${tipo} ${numeroOrigem}`
      : (texto(conta.id) ?? "conta");

  return `(Bling) ${referencia}${clienteNome ? ` — ${clienteNome}` : ""}`.slice(0, 180);
}

export function lerContaDoBling(bruto: unknown): ContaDoBlingLida | null {
  const conta = objeto(bruto);
  if (!conta) return null;

  const blingId = texto(conta.id);
  const vencimento = dataDeCalendario(texto(conta.vencimento) ?? "");
  const valorReais = numero(conta.valor);

  // Sem id não há como reconhecer na próxima leitura; sem vencimento ou sem
  // valor a conta não tem quando nem quanto. Nenhum dos três é opcional para
  // uma linha que vai somar no total a receber.
  if (!blingId || !vencimento || valorReais === null) return null;

  const contato = objeto(conta.contato);
  const clienteNome = contato ? texto(contato.nome) : null;
  const situacao = typeof conta.situacao === "number" ? conta.situacao : null;

  return {
    blingId,
    descricao: montarDescricao(conta, clienteNome),
    valorReais,
    vencimento,
    status: statusDaSituacaoDaConta(situacao ?? SITUACOES_DE_CONTA.EM_ABERTO),
    situacaoBling: situacao,
    clienteNome,
    clienteDocumento: contato ? (texto(contato.numeroDocumento)?.replace(/\D/g, "") ?? null) : null,
  };
}

export function lerPaginaDeContas(resposta: unknown): ContaDoBlingLida[] {
  const envelope = objeto(resposta);
  const dados = envelope?.data;

  if (!Array.isArray(dados)) return [];

  return dados.map(lerContaDoBling).filter((conta): conta is ContaDoBlingLida => conta !== null);
}

/** A chave de idempotência da conta importada. */
export function referenciaDaConta(blingId: string): string {
  return `conta:${blingId}`;
}
