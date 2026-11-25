/**
 * Catalogo de modulos — a base para vender o Konext por partes.
 *
 * Cada modulo diz quais TELAS (prefixo de rota) e quais PERMISSOES sao dele.
 * Desligar um modulo numa loja:
 *
 * - tira as permissoes dele de todo mundo da loja (exigirContextoTenant). Como
 *   toda action de dados ja confere permissao, o servidor recusa sozinho, e os
 *   botoes que dependem de permissao somem;
 * - tira o modulo do menu;
 * - troca as telas dele por um aviso de "modulo nao contratado".
 *
 * NUCLEO (sempre ligado, nao esta no catalogo): Dashboard, Clientes, Agenda,
 * Configuracoes, Ajuda e Meu perfil — o minimo para qualquer plano funcionar.
 *
 * QUEM LIGA E DESLIGA: o sistema master, gravando em ModuloEmpresa (banco
 * central). Sem linha = ligado: toda loja que ja existe continua com tudo.
 *
 * SEM IMPORTS DE PROPOSITO: o sistema master (pasta master/) le este mesmo
 * arquivo, e ele nao tem o resto do ERP.
 *
 * DEPENDENCIAS: um modulo ligado cujo requisito esta desligado tambem fica
 * desligado (ex.: PDV sem Estoque nao teria o que vender).
 */

export const IDS_DE_MODULO = ["os", "estoque", "pdv", "vendas", "propostas", "financeiro", "fiscal", "metas", "marketing", "ferramentas"] as const;
export type IdModulo = (typeof IDS_DE_MODULO)[number];

export type Modulo = {
  id: IdModulo;
  nome: string;
  descricao: string;
  /** Prefixos de rota das telas do modulo (dashboard e impressao). */
  rotas: readonly string[];
  /** Prefixos de permissao ("os" casa com "os.criar") ou permissoes exatas. */
  permissoes: readonly string[];
  dependeDe?: readonly IdModulo[];
};

export const MODULOS: readonly Modulo[] = [
  {
    id: "os",
    nome: "Ordens de Serviço",
    descricao: "Abertura, quadro, orçamento, fotos, impressão, garantias e relatório de peças.",
    rotas: ["/os"],
    permissoes: ["os"],
  },
  {
    id: "estoque",
    nome: "Estoque",
    descricao: "Produtos, saldos, etiquetas e entrada de nota.",
    rotas: ["/estoque"],
    permissoes: ["estoque"],
  },
  {
    id: "pdv",
    nome: "PDV e Caixa",
    descricao: "Venda no balcão, recibo, abertura e fechamento de caixa.",
    rotas: ["/pdv", "/recibo"],
    permissoes: ["pdv", "caixa"],
    dependeDe: ["estoque"],
  },
  {
    id: "vendas",
    nome: "Vendas",
    descricao: "Lista de vendas e pedidos de venda.",
    rotas: ["/vendas"],
    permissoes: ["vendas"],
    dependeDe: ["estoque"],
  },
  {
    id: "propostas",
    nome: "Propostas",
    descricao: "Propostas comerciais em PDF com assinatura.",
    rotas: ["/crm/propostas", "/propostas"],
    permissoes: ["propostas"],
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Contas a pagar e a receber, fluxo de caixa e relatórios.",
    // /prefeitura entra aqui: é o mesmo módulo contratável (financeiro), mesmo
    // aparecendo como item próprio no menu.
    rotas: ["/financeiro", "/prefeitura"],
    permissoes: ["financeiro", "dashboard.financeiro"],
  },
  {
    id: "fiscal",
    nome: "Notas fiscais (Bling)",
    descricao: "Notas emitidas no Bling, trazidas para o TechOS.",
    rotas: ["/financeiro/notas-fiscais"],
    permissoes: [],
    dependeDe: ["financeiro"],
  },
  {
    id: "metas",
    nome: "Metas",
    descricao: "Metas da loja e da equipe, com acompanhamento automático.",
    rotas: ["/metas"],
    permissoes: ["metas"],
  },
  {
    id: "marketing",
    nome: "Marketing",
    descricao: "Publicações e anúncios nas redes (Meta, Google, TikTok, Perfil do Google), agenda e conexões.",
    rotas: ["/marketing"],
    permissoes: ["marketing"],
  },
  {
    id: "ferramentas",
    nome: "Ferramentas",
    descricao: "Ferramentas de bancada pelo cabo USB, como a Remoção de Vírus do Android.",
    rotas: ["/ferramentas"],
    // Roda no navegador do tecnico, sem dado da loja: nao tem permissao
    // propria. Quem tem acesso a loja e o modulo ligado, usa.
    permissoes: [],
  },
];

const POR_ID = new Map(MODULOS.map((m) => [m.id, m]));

export function moduloPeloId(id: string): Modulo | undefined {
  return POR_ID.get(id as IdModulo);
}

export function ehIdDeModulo(id: string): id is IdModulo {
  return POR_ID.has(id as IdModulo);
}

/**
 * Quais modulos estao ligados, a partir do que o master gravou. Sem linha =
 * ligado. Depois, desliga em cascata quem depende de modulo desligado.
 */
export function resolverModulosAtivos(gravados: ReadonlyArray<{ modulo: string; ativo: boolean }>): Set<IdModulo> {
  const ativos = new Set<IdModulo>(IDS_DE_MODULO);
  for (const linha of gravados) {
    if (ehIdDeModulo(linha.modulo) && !linha.ativo) ativos.delete(linha.modulo);
  }
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const id of [...ativos]) {
      if (POR_ID.get(id)?.dependeDe?.some((dep) => !ativos.has(dep))) {
        ativos.delete(id);
        mudou = true;
      }
    }
  }
  return ativos;
}

/** O modulo dono de uma rota: o prefixo mais longo que casa. Rota do nucleo -> null. */
export function moduloDaRota(pathname: string): IdModulo | null {
  let melhor: { id: IdModulo; tamanho: number } | null = null;
  for (const modulo of MODULOS) {
    for (const rota of modulo.rotas) {
      if ((pathname === rota || pathname.startsWith(`${rota}/`)) && (!melhor || rota.length > melhor.tamanho)) {
        melhor = { id: modulo.id, tamanho: rota.length };
      }
    }
  }
  return melhor?.id ?? null;
}

/** O modulo dono de uma permissao, ou null se for do nucleo. */
export function moduloDaPermissao(permissao: string): IdModulo | null {
  for (const modulo of MODULOS) {
    for (const p of modulo.permissoes) {
      if (permissao === p || permissao.startsWith(`${p}.`)) return modulo.id;
    }
  }
  return null;
}

/** Tira as permissoes dos modulos desligados. */
export function filtrarPermissoesPorModulo<P extends string>(
  permissoes: Iterable<P>,
  ativos: ReadonlySet<IdModulo>
): Set<P> {
  const resultado = new Set<P>();
  for (const permissao of permissoes) {
    const modulo = moduloDaPermissao(permissao);
    if (!modulo || ativos.has(modulo)) resultado.add(permissao);
  }
  return resultado;
}
