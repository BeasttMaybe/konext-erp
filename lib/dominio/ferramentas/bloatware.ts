/**
 * Limpeza de apps (bloatware) — regras puras: classificar os apps instalados
 * de fábrica em "pode tirar", "essencial (nunca mexer)" ou "resto do
 * sistema", para a ferramenta nunca oferecer desativar algo que quebre o
 * aparelho.
 *
 * Decisão conservadora de propósito: só entra em BLOATWARE o que é
 * reconhecidamente seguro desativar (apps de propaganda, promoções, jogos de
 * fábrica, duplicatas). Tudo que não é claramente bloat fica como "sistema" e
 * NÃO ganha botão de desativar — some do caminho de um clique errado.
 */

export type ClasseDoApp = "USUARIO" | "BLOATWARE" | "ESSENCIAL" | "SISTEMA";

export type AppDoSistema = {
  pacote: string;
  /** Veio pré-instalado (app de sistema) ou foi o usuário que instalou. */
  doSistema: boolean;
  desativado: boolean;
};

export type AppClassificado = AppDoSistema & {
  classe: ClasseDoApp;
  /** Rótulo amigável do bloatware conhecido. */
  rotulo: string | null;
  motivo: string | null;
};

/**
 * NUNCA desativar: telefonia, SIM, ajustes, interface do sistema, Play
 * Services/Store, discador, contatos, teclado base. Desativar qualquer um
 * destes pode deixar o aparelho inutilizável.
 */
const ESSENCIAIS: readonly RegExp[] = [
  /^android$/,
  /^com\.android\.systemui$/,
  /^com\.android\.settings/,
  /^com\.android\.phone$/,
  /^com\.android\.server\.telecom$/,
  /^com\.android\.providers\./,
  /^com\.android\.vending$/, // Play Store
  /^com\.google\.android\.gms$/, // Play Services
  /^com\.google\.android\.gsf$/,
  /^com\.android\.cellbroadcast/,
  /^com\.android\.stk$/, // SIM Toolkit
  /^com\.android\.keychain$/,
  /^com\.android\.inputmethod/,
  /^com\.google\.android\.inputmethod/, // Gboard
  /^com\.samsung\.android\.(dialer|incallui|telephonyui|messaging|contacts)$/,
  /^com\.samsung\.android\.app\.telephonyui/,
  /^com\.sec\.android\.app\.launcher$/, // launcher Samsung
  /^com\.sec\.android\.app\.camera$/,
  /^com\.google\.android\.apps\.nexuslauncher$/,
  /^com\.miui\.home$/, // launcher Xiaomi
  /^com\.android\.launcher/,
  /^com\.motorola\.launcher/,
  /^com\.android\.nfc$/,
  /^com\.android\.bluetooth$/,
  /^com\.android\.se$/,
];

/** Bloatware conhecido e seguro de desativar: prefixo -> rótulo. */
const BLOATWARE: ReadonlyArray<{ re: RegExp; rotulo: string }> = [
  // Propaganda e serviços pré-instalados
  { re: /^com\.facebook\.(appmanager|services|system|katana)$/, rotulo: "Facebook (pré-instalado)" },
  { re: /^com\.facebook\.app\.manager$/, rotulo: "Facebook (gerenciador)" },
  { re: /^com\.microsoft\.(skydrive|office\.officehubrow|office\.officehub)/, rotulo: "Microsoft Office / OneDrive" },
  { re: /^com\.linkedin\.android$/, rotulo: "LinkedIn (pré-instalado)" },
  { re: /^com\.netflix\.partner\.activation$/, rotulo: "Netflix (ativação)" },
  { re: /^com\.spotify\.music$/, rotulo: "Spotify (pré-instalado)" },
  // Samsung
  { re: /^com\.samsung\.android\.app\.spage$/, rotulo: "Samsung Free / Notícias" },
  { re: /^com\.samsung\.android\.bixby/, rotulo: "Bixby" },
  { re: /^com\.samsung\.android\.visionintelligence$/, rotulo: "Bixby Vision" },
  { re: /^com\.samsung\.android\.game\.(gamehome|gametools|gos)$/, rotulo: "Game Launcher / Booster" },
  { re: /^com\.samsung\.android\.app\.tips$/, rotulo: "Samsung Dicas" },
  { re: /^com\.samsung\.android\.arzone$/, rotulo: "AR Zone" },
  { re: /^com\.samsung\.android\.aremoji/, rotulo: "AR Emoji" },
  { re: /^com\.samsung\.android\.app\.watchmanager$/, rotulo: "Galaxy Wearable" },
  { re: /^com\.samsung\.android\.scloud$/, rotulo: "Samsung Cloud" },
  // Xiaomi / MIUI (propaganda)
  { re: /^com\.miui\.msa\.global$/, rotulo: "MSA (propaganda MIUI)" },
  { re: /^com\.miui\.(player|video|cleaner|cleanmaster)$/, rotulo: "App MIUI pré-instalado" },
  { re: /^com\.mi\.globalbrowser$/, rotulo: "Mi Browser" },
  { re: /^com\.xiaomi\.mipicks$/, rotulo: "GetApps (loja Xiaomi)" },
  { re: /^com\.xiaomi\.glgm$/, rotulo: "Jogos Xiaomi" },
  // Motorola
  { re: /^com\.motorola\.mausamactivation$/, rotulo: "Motorola (ativação)" },
  // Jogos de fábrica
  { re: /^com\.gameloft\./, rotulo: "Jogo Gameloft (fábrica)" },
  { re: /^com\.king\.(candycrushsaga|candycrushsodasaga)$/, rotulo: "Candy Crush (fábrica)" },
  { re: /^com\.ironsource\./, rotulo: "Jogo pré-instalado" },
  // Outros promocionais comuns no Brasil
  { re: /^com\.booking$/, rotulo: "Booking.com (pré-instalado)" },
  { re: /^com\.amazon\.mShop\.android\.shopping$/, rotulo: "Amazon Shopping (pré-instalado)" },
];

function casaAlgum(pacote: string, lista: readonly RegExp[]): boolean {
  return lista.some((re) => re.test(pacote));
}

export function ehEssencial(pacote: string): boolean {
  return casaAlgum(pacote, ESSENCIAIS);
}

export function classificarApp(app: AppDoSistema): AppClassificado {
  if (ehEssencial(app.pacote)) {
    return { ...app, classe: "ESSENCIAL", rotulo: null, motivo: "App essencial do sistema — não mexa." };
  }
  if (!app.doSistema) {
    return { ...app, classe: "USUARIO", rotulo: null, motivo: "Instalado pelo usuário." };
  }
  const bloat = BLOATWARE.find((b) => b.re.test(app.pacote));
  if (bloat) {
    return { ...app, classe: "BLOATWARE", rotulo: bloat.rotulo, motivo: "Pré-instalado e seguro de desativar." };
  }
  return { ...app, classe: "SISTEMA", rotulo: null, motivo: "App de sistema — desative só se souber o que é." };
}

/** Ordem: bloatware primeiro, depois user, depois sistema, essencial por último. */
const ORDEM: Record<ClasseDoApp, number> = { BLOATWARE: 0, USUARIO: 1, SISTEMA: 2, ESSENCIAL: 3 };

export function classificarLista(apps: readonly AppDoSistema[]): AppClassificado[] {
  return apps
    .map(classificarApp)
    .sort((a, b) => ORDEM[a.classe] - ORDEM[b.classe] || a.pacote.localeCompare(b.pacote));
}

export function contarBloatware(apps: readonly AppClassificado[]): number {
  return apps.filter((a) => a.classe === "BLOATWARE" && !a.desativado).length;
}
