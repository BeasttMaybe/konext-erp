/**
 * Regras do PDV de celular — fora do componente, para teste sem tela.
 *
 * No celular a venda e uma tela so: cliente, itens, pagamento. Diferente do
 * balcao do computador, o cliente e OBRIGATORIO aqui (decisao do dono): a
 * venda feita pelo celular e a do tecnico ou vendedor andando pela loja, e
 * venda sem cliente nao tem a quem ligar a garantia nem o recibo.
 */

type ClienteBuscavel = { nomeRazaoSocial: string; documento: string | null; telefone: string };

/** Minusculo, sem acento e so letras e numeros: "(11) 98765-4321" vira "11987654321". */
export function normalizarParaBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function filtrarClientes<C extends ClienteBuscavel>(clientes: readonly C[], termo: string, limite = 8): C[] {
  const busca = normalizarParaBusca(termo);
  if (busca.length < 2) return [];
  return clientes
    .filter((cliente) =>
      [cliente.nomeRazaoSocial, cliente.documento ?? "", cliente.telefone].some((campo) =>
        normalizarParaBusca(campo).includes(busca)
      )
    )
    .slice(0, limite);
}

type ProdutoBuscavel = { nome: string; codigoBarras?: string | null };

export function filtrarProdutos<P extends ProdutoBuscavel>(produtos: readonly P[], termo: string, limite = 8): P[] {
  const busca = termo.trim().toLowerCase();
  if (busca.length < 2) return [];
  return produtos
    .filter((p) => p.nome.toLowerCase().includes(busca) || Boolean(p.codigoBarras?.toLowerCase().includes(busca)))
    .slice(0, limite);
}

export type PendenciaDaVenda = "cliente" | "itens" | "caixa" | "pagamento";

/**
 * O primeiro motivo que impede finalizar, na ordem da tela — e para ele que
 * a tela rola quando a pessoa toca "Finalizar". `null` quando pode vender.
 */
export function pendenciaDaVendaNoCelular(estado: {
  clienteId: string;
  quantidadeItens: number;
  temOS: boolean;
  caixaAberto: boolean;
  pagamentoFechado: boolean;
}): PendenciaDaVenda | null {
  if (!estado.clienteId) return "cliente";
  if (estado.quantidadeItens === 0 && !estado.temOS) return "itens";
  if (!estado.caixaAberto) return "caixa";
  if (!estado.pagamentoFechado) return "pagamento";
  return null;
}

export const MENSAGEM_DA_PENDENCIA: Readonly<Record<PendenciaDaVenda, string>> = {
  cliente: "Escolha o cliente da venda.",
  itens: "Leia ou busque ao menos um produto.",
  caixa: "Abra o caixa para vender.",
  pagamento: "Escolha a forma de pagamento.",
};
