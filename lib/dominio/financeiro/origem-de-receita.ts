/**
 * De onde a conta a receber veio.
 *
 * Mesma razão do filtro de categoria em Contas a Pagar: a loja roda dezenas
 * de ordens de serviço por mês, cada uma vira recebível, e procurar o
 * crediário de um cliente no meio disso é rolar a tela. O dono pediu "deixar
 * o contas a receber apenas pra recebíveis futuros" — o que ele quer, na
 * prática, é poder tirar da frente o que é fluxo de OS.
 *
 * `origem` já existe na coluna do banco (`OrigemReceita`) desde sempre; só
 * nunca chegou à tela.
 */

export type OrigemDeReceita =
  | "VENDA_PDV"
  | "ORDEM_SERVICO"
  | "CONTRATO_RECORRENTE"
  | "LICITACAO"
  | "AVULSO"
  | "BLING";

const ROTULOS: Record<OrigemDeReceita, string> = {
  VENDA_PDV: "Venda no balcão",
  ORDEM_SERVICO: "Ordem de serviço",
  CONTRATO_RECORRENTE: "Contrato recorrente",
  LICITACAO: "Licitação",
  AVULSO: "Lançamento avulso",
  // Parcela de nota emitida no Bling que não corresponde a nenhuma venda
  // daqui. Filtrar por ela é o que o dono pediu para conseguir isolar, na
  // lista, o que veio de lá.
  BLING: "Nota do Bling",
};

export const ORIGENS_DE_RECEITA: ReadonlyArray<{
  valor: OrigemDeReceita | "TODAS";
  rotulo: string;
}> = [
  { valor: "TODAS", rotulo: "Todas as origens" },
  ...(Object.keys(ROTULOS) as OrigemDeReceita[]).map((valor) => ({
    valor,
    rotulo: ROTULOS[valor],
  })),
];

/**
 * Origem desconhecida devolve o próprio valor em vez de "—".
 *
 * Se o enum do banco ganhar um valor novo e esta tabela não for atualizada, é
 * melhor a tela mostrar `CONSIGNACAO` do que esconder a informação atrás de
 * um travessão: o rótulo feio aparece, alguém percebe e corrige.
 */
export function rotuloDaOrigemDeReceita(origem: string | null | undefined): string {
  if (!origem) return "Sem origem";
  return ROTULOS[origem as OrigemDeReceita] ?? origem;
}
