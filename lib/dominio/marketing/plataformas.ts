/**
 * Marketing — catálogo das plataformas e regras puras de publicação.
 *
 * O que trava cada integração (o dono precisa fazer, não o sistema): cada
 * plataforma exige criar um "app de desenvolvedor" e passar por aprovação
 * dela. Até isso existir, a conexão fica NAO_CONFIGURADA e a tela explica o
 * passo. Nada aqui fala com a rede — só descreve e valida.
 */

export type IdPlataformaMarketing = "META" | "GOOGLE_ADS" | "TIKTOK_ADS" | "GOOGLE_PERFIL";
export type CanalMarketing = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "GOOGLE_PERFIL";

export type DefinicaoPlataforma = {
  id: IdPlataformaMarketing;
  nome: string;
  /** Canais de publicação que essa conexão habilita. */
  canais: readonly CanalMarketing[];
  /** Serve para posts orgânicos? E para anúncios pagos? */
  organico: boolean;
  anuncios: boolean;
  /** O que o dono precisa criar/aprovar antes de conectar. */
  preRequisito: string;
  /** Variáveis de ambiente (client id/secret) que ligam a integração. */
  variaveis: readonly string[];
};

export const PLATAFORMAS: readonly DefinicaoPlataforma[] = [
  {
    id: "META",
    nome: "Meta (Instagram e Facebook)",
    canais: ["INSTAGRAM", "FACEBOOK"],
    organico: true,
    anuncios: true,
    preRequisito:
      "Criar um app no Meta for Developers, com o Instagram e a Página do Facebook da loja vinculados, e pedir a análise das permissões de publicação e de anúncios (Marketing API).",
    variaveis: ["META_APP_ID", "META_APP_SECRET"],
  },
  {
    id: "GOOGLE_ADS",
    nome: "Google Ads",
    canais: [],
    organico: false,
    anuncios: true,
    preRequisito:
      "Ter conta no Google Ads, solicitar um token de desenvolvedor (developer token) aprovado pelo Google e criar as credenciais OAuth no Google Cloud.",
    variaveis: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
  },
  {
    id: "TIKTOK_ADS",
    nome: "TikTok Ads",
    canais: ["TIKTOK"],
    organico: true,
    anuncios: true,
    preRequisito:
      "Criar um app no TikTok for Business (Marketing API), vincular a conta de anúncios da loja e aguardar a aprovação do app.",
    variaveis: ["TIKTOK_APP_ID", "TIKTOK_APP_SECRET"],
  },
  {
    id: "GOOGLE_PERFIL",
    nome: "Perfil da Empresa no Google",
    canais: ["GOOGLE_PERFIL"],
    organico: true,
    anuncios: false,
    preRequisito:
      "Ter o Perfil da Empresa no Google verificado e pedir acesso à Business Profile API (o Google precisa liberar o projeto na lista de acesso).",
    variaveis: ["GOOGLE_PERFIL_CLIENT_ID", "GOOGLE_PERFIL_CLIENT_SECRET"],
  },
];

const POR_ID = new Map(PLATAFORMAS.map((p) => [p.id, p]));

export function plataformaPorId(id: string): DefinicaoPlataforma | undefined {
  return POR_ID.get(id as IdPlataformaMarketing);
}

export function ehIdDePlataforma(id: string): id is IdPlataformaMarketing {
  return POR_ID.has(id as IdPlataformaMarketing);
}

const CANAL_PARA_PLATAFORMA: Record<CanalMarketing, IdPlataformaMarketing> = {
  INSTAGRAM: "META",
  FACEBOOK: "META",
  TIKTOK: "TIKTOK_ADS",
  GOOGLE_PERFIL: "GOOGLE_PERFIL",
};

export function plataformaDoCanal(canal: CanalMarketing): IdPlataformaMarketing {
  return CANAL_PARA_PLATAFORMA[canal];
}

export const ROTULO_CANAL: Record<CanalMarketing, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  GOOGLE_PERFIL: "Perfil do Google",
};

/** Todos os canais de publicação orgânica, na ordem de exibição. */
export const CANAIS_ORGANICOS: readonly CanalMarketing[] = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "GOOGLE_PERFIL"];

/**
 * Qual plataforma de env ligada? Recebe quais variáveis existem (nomes) e diz
 * se a plataforma está "pronta para conectar" (o dono já configurou o app).
 */
export function plataformaConfiguravel(
  plataforma: IdPlataformaMarketing,
  variaveisPresentes: ReadonlySet<string>
): boolean {
  const def = plataformaPorId(plataforma);
  if (!def) return false;
  return def.variaveis.every((v) => variaveisPresentes.has(v));
}
