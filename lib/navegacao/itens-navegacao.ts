export type SubItemNavegacao = { label: string; path: string };

export type ItemNavegacao = {
  label: string;
  path: string;
  iconKey: string;
  filhos?: readonly SubItemNavegacao[];
};

// Fonte única da navegação principal. Consumida pelo cabeçalho e pelo menu mobile.
// "Configurações" não entra aqui: vive no menu do usuário.
export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  { label: "Dashboard", path: "/", iconKey: "Dashboard" },
  {
    label: "CRM",
    path: "/crm",
    iconKey: "CRM",
    filhos: [
      { label: "Hub Central", path: "/crm" },
      { label: "Contatos", path: "/crm/contatos" },
      { label: "Oportunidades", path: "/crm/oportunidades" },
      { label: "Propostas", path: "/crm/propostas" },
    ],
  },
  { label: "PDV", path: "/pdv", iconKey: "PDV" },
  {
    label: "Vendas",
    path: "/vendas",
    iconKey: "Vendas",
    filhos: [
      { label: "Hub Central", path: "/vendas" },
      { label: "Novo Pedido", path: "/vendas/pedidos/novo" },
      { label: "Histórico", path: "/vendas/historico" },
    ],
  },
  { label: "Estoque", path: "/estoque", iconKey: "Estoque" },
  {
    label: "Ordens de Serviço",
    path: "/os",
    iconKey: "OS",
    filhos: [
      { label: "Hub Central", path: "/os" },
      { label: "Kanban", path: "/os?modo=kanban" },
      { label: "Finalizadas", path: "/os?modo=lista" },
      { label: "Garantias", path: "/os?modo=garantia" },
    ],
  },
  {
    label: "Financeiro",
    path: "/financeiro",
    iconKey: "Financeiro",
    filhos: [
      { label: "Hub Financeiro", path: "/financeiro" },
      { label: "Contas a Receber", path: "/financeiro/receber" },
      { label: "Contas a Pagar", path: "/financeiro/pagar" },
      { label: "Inteligência", path: "/financeiro/inteligencia" },
      { label: "Notas Fiscais", path: "/financeiro/notas-fiscais" },
    ],
  },
  { label: "Metas", path: "/metas", iconKey: "Metas" },
];

type LeituraParametros = Pick<URLSearchParams, "get">;

function separarCaminho(path: string): { pathname: string; parametros: Array<[string, string]> } {
  const [pathname = "", query = ""] = path.split("?");
  const parametros: Array<[string, string]> = [];

  if (query) {
    for (const [chave, valor] of new URLSearchParams(query).entries()) {
      parametros.push([chave, valor]);
    }
  }

  return { pathname, parametros };
}

/**
 * Um caminho está ativo quando a rota atual bate com ele.
 * "/" só casa com a raiz; caminhos com query exigem que todo parâmetro declarado confira.
 */
export function estaAtivo(
  path: string,
  pathname: string,
  searchParams: LeituraParametros
): boolean {
  const { pathname: alvo, parametros } = separarCaminho(path);

  if (alvo === "/") {
    return pathname === "/" && parametros.every(([chave, valor]) => searchParams.get(chave) === valor);
  }

  const casaPathname = pathname === alvo || pathname.startsWith(`${alvo}/`);

  if (!casaPathname) {
    return false;
  }

  return parametros.every(([chave, valor]) => searchParams.get(chave) === valor);
}

// Quanto mais específico o caminho (segmentos e parâmetros), maior a pontuação.
function pontuarEspecificidade(path: string): number {
  const { pathname, parametros } = separarCaminho(path);
  const segmentos = pathname.split("/").filter(Boolean).length;

  return segmentos * 10 + parametros.length;
}

/**
 * Entre filhos que casam com a rota atual, vence o mais específico.
 * É o que separa "/os", "/os?modo=kanban" e "/os?modo=lista".
 */
export function indiceFilhoAtivo(
  filhos: readonly SubItemNavegacao[],
  pathname: string,
  searchParams: LeituraParametros
): number {
  let indiceVencedor = -1;
  let melhorPontuacao = -1;

  filhos.forEach((filho, indice) => {
    if (!estaAtivo(filho.path, pathname, searchParams)) {
      return;
    }

    const pontuacao = pontuarEspecificidade(filho.path);

    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      indiceVencedor = indice;
    }
  });

  return indiceVencedor;
}

/** Um item é ativo quando ele mesmo casa com a rota ou quando algum filho casa. */
export function itemEstaAtivo(
  item: ItemNavegacao,
  pathname: string,
  searchParams: LeituraParametros
): boolean {
  if (estaAtivo(item.path, pathname, searchParams)) {
    return true;
  }

  return indiceFilhoAtivo(item.filhos ?? [], pathname, searchParams) >= 0;
}
