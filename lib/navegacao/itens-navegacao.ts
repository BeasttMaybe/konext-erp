import type { Permissao } from "@/lib/auth/permissoes";

export type SubItemNavegacao = {
  label: string;
  path: string;
  /** Ausente = visível pra qualquer usuário logado. Presente = precisa de ALGUMA dessas permissões. */
  permissoesRequeridas?: readonly Permissao[];
};

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
    label: "Ordens de Serviço",
    path: "/os",
    iconKey: "OS",
    filhos: [
      // "Em andamento" aponta para /os puro: "Hub Central" levava ao MESMO
      // lugar e saiu. O item se chamava "Kanban"; desde que a tela passou a
      // oferecer quadro OU lista, o nome diz o QUE se ve, nao o formato. Sem parametro, ele tambem vale para quem chega a /os por
      // qualquer outro link — e nas outras abas perde pela especificidade
      // (`indiceFilhoAtivo`), entao o destaque continua certo.
      { label: "Em andamento", path: "/os" },
      { label: "Finalizadas", path: "/os?modo=lista" },
      { label: "Garantias", path: "/os?modo=garantia" },
      // A tela existia e funcionava desde que as marcas de peça entraram —
      // custo lançado na OS contra o valor cobrado, agrupado por tipo e
      // marca, que é o relatório de lucro de peça que o dono pediu. O que
      // faltava era a porta: nenhum link no sistema levava até ela, e sem
      // link uma tela pronta vale o mesmo que uma tela que não existe.
      { label: "Relatório de peças", path: "/os/relatorio-pecas" },
    ],
  },
  {
    label: "Clientes (CRM)",
    path: "/crm",
    iconKey: "CRM",
    filhos: [
      // O "Hub Central" era uma tela de indicadores com valores fixos em zero
      // e textos de alerta escritos no codigo — removida em 02/11/2026. O /crm
      // passou a ser a propria tela de clientes, e Oportunidades e o funil
      // sairam por decisao do dono: o CRM dele e cadastro de cliente e
      // proposta, nao pipeline comercial.
      { label: "Clientes", path: "/crm" },
      { label: "Propostas", path: "/crm/propostas" },
    ],
  },
  { label: "PDV", path: "/pdv", iconKey: "PDV" },
  // Vendas não tem submenu porque virou UMA tela: a lista de vendas.
  //
  // Antes eram três filhos — "Hub Central", "Novo Pedido" e "Histórico" —
  // apontando para um hub de oito cartões (cinco levavam a `#`), um
  // formulário em branco e a lista de verdade, que era a única com conteúdo
  // e a que ninguém alcançava. O hub foi apagado, a lista tomou o lugar
  // dele em /vendas, e "novo pedido" é um botão na própria tela, que é onde
  // alguém decide criar um.
  { label: "Vendas", path: "/vendas", iconKey: "Vendas" },
  {
    label: "Estoque",
    path: "/estoque",
    iconKey: "Estoque",
    filhos: [
      { label: "Produtos", path: "/estoque" },
      { label: "Entrada de nota", path: "/estoque/notas/nova", permissoesRequeridas: ["estoque.editar"] },
    ],
  },
  {
    label: "Financeiro",
    path: "/financeiro",
    iconKey: "Financeiro",
    filhos: [
      { label: "Visão Geral", path: "/financeiro", permissoesRequeridas: ["financeiro.ver"] },
      { label: "Contas a Receber", path: "/financeiro/receber", permissoesRequeridas: ["financeiro.ver"] },
      { label: "Contas a Pagar", path: "/financeiro/pagar", permissoesRequeridas: ["financeiro.ver"] },
      { label: "Fluxo e Relatórios", path: "/financeiro/fluxo", permissoesRequeridas: ["dashboard.financeiro"] },
      { label: "Notas Fiscais", path: "/financeiro/notas-fiscais", permissoesRequeridas: ["financeiro.ver"] },
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

/**
 * Fase 1D-2, Parte 4: uma página bloqueada por `AcessoNegado` some do menu —
 * quem não pode abrir a página não vê o link. Filhos sem `permissoesRequeridas`
 * ficam visíveis pra qualquer usuário logado.
 */
export function filhosVisiveis(
  item: ItemNavegacao,
  temAlgumaPermissao: (permissoes: readonly Permissao[]) => boolean
): readonly SubItemNavegacao[] {
  if (!item.filhos) return [];

  return item.filhos.filter(
    (filho) => !filho.permissoesRequeridas || temAlgumaPermissao(filho.permissoesRequeridas)
  );
}

/**
 * Caminho pro qual o item pai deve linkar: o próprio `item.path` quando ele
 * segue visível entre os filhos filtrados, senão o primeiro filho visível —
 * evita levar o usuário pro hub bloqueado quando só um filho secundário
 * (ex.: Inteligência) permanece acessível pra ele.
 */
export function caminhoDoItem(item: ItemNavegacao, filhosFiltrados: readonly SubItemNavegacao[]): string {
  if (!item.filhos?.length) return item.path;
  if (filhosFiltrados.some((filho) => filho.path === item.path)) return item.path;
  return filhosFiltrados[0]?.path ?? item.path;
}
