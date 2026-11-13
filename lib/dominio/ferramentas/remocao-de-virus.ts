/**
 * Remocao de Virus — regras puras: ler a saida dos comandos do Android (via
 * ADB pelo cabo) e decidir quais apps parecem adware/virus.
 *
 * COMO O ADWARE SE ESCONDE (e o que olhamos para achar)
 *
 * O "virus de anuncio" do Android quase nunca e um virus de verdade: e um app
 * que o cliente instalou (lanterna, limpador, papel de parede, APK de WhatsApp
 * modificado) e que, depois de alguns dias, some da tela inicial e passa a
 * abrir propaganda por cima de tudo. Os truques sao sempre os mesmos, e cada
 * um deixa rastro que o ADB enxerga sem root:
 *
 * - some da tela inicial (nao tem atividade LAUNCHER) — o cliente nao acha o
 *   app para desinstalar;
 * - tem permissao de "aparecer sobre outros apps" — e como o anuncio cobre a
 *   tela;
 * - vira "administrador do dispositivo" — o Android bloqueia a desinstalacao
 *   normal (MobiDash fazia isso com nome em branco);
 * - liga um servico de acessibilidade ou de leitura de notificacoes — le e
 *   clica na tela;
 * - veio de APK baixado, nao de loja;
 * - se coloca como tela inicial padrao.
 *
 * Nenhum sinal sozinho condena um app (teclado tem acessibilidade, app de
 * banco nao tem icone extra...). Por isso cada sinal tem um peso, a soma vira
 * o nivel de suspeita, e o tecnico decide — o sistema nunca remove sozinho.
 * Apps conhecidos instalados pela loja oficial nao entram na conta.
 */

export type NivelDeSuspeita = "ALTO" | "MEDIO" | "BAIXO";

export type SinalDeSuspeita = {
  id: string;
  peso: number;
  /** Frase curta para o tecnico, em portugues. */
  texto: string;
};

export type AppDoCelular = {
  pacote: string;
  instalador: string | null;
  temIcone: boolean;
  sobreOutrosApps: boolean;
  administrador: boolean;
  acessibilidade: boolean;
  leitorDeNotificacoes: boolean;
  telaInicialPadrao: boolean;
  /** android.permission.* pedidas ou concedidas */
  permissoes: ReadonlySet<string>;
  /** ISO, quando o Android informou */
  instaladoEm: string | null;
  versao: string | null;
  desativado: boolean;
  suspenso: boolean;
  /** Componentes de administrador (pacote/classe), para tentar remover */
  componentesAdmin: string[];
};

export type AppAnalisado = AppDoCelular & {
  sinais: SinalDeSuspeita[];
  pontos: number;
  nivel: NivelDeSuspeita;
  confiavel: boolean;
  conhecidoComoMalicioso: boolean;
};

// ── Listas ──────────────────────────────────────────────────────────────────

/** Lojas oficiais (Google, Samsung, Huawei, Xiaomi, Oppo, Vivo, Amazon). */
export const LOJAS_OFICIAIS: ReadonlySet<string> = new Set([
  "com.android.vending",
  "com.google.android.feedback",
  "com.sec.android.app.samsungapps",
  "com.huawei.appmarket",
  "com.xiaomi.market",
  "com.xiaomi.mipicks",
  "com.heytap.market",
  "com.oppo.market",
  "com.bbk.appstore",
  "com.vivo.appstore",
  "com.amazon.venezia",
  "com.motorola.motostore",
]);

/**
 * Prefixos de apps conhecidos e populares no Brasil. So contam como
 * confiaveis se vieram de loja oficial: um "com.whatsapp" vindo de APK e
 * exatamente o golpe classico.
 */
const PREFIXOS_CONFIAVEIS = [
  "com.google.",
  "com.android.",
  "com.whatsapp",
  "com.facebook.",
  "com.instagram.",
  "com.zhiliaoapp.musically",
  "com.ss.android.",
  "com.kwai.",
  "com.spotify.",
  "com.netflix.",
  "com.microsoft.",
  "com.samsung.",
  "com.sec.",
  "com.motorola.",
  "com.miui.",
  "com.xiaomi.",
  "com.amazon.",
  "com.twitter.",
  "com.snapchat.",
  "org.telegram.",
  "com.discord",
  "com.nu.production",
  "br.com.intermedium",
  "com.picpay",
  "com.mercadopago.",
  "com.mercadolibre",
  "com.itau",
  "br.com.itau",
  "com.bradesco",
  "br.com.bradesco",
  "br.com.bb.",
  "br.com.gabba.",
  "com.santander.",
  "br.com.santander",
  "br.com.caixa",
  "br.gov.",
  "com.c6bank.",
  "br.com.brainweb.ifood",
  "com.ubercab",
  "com.taxis99",
  "com.shopee.",
  "com.alibaba.aliexpresshd",
  "com.einnovation.temu",
  "com.zzkko",
  "com.waze",
  "com.globo.",
  "com.linkedin.",
  "com.pinterest",
  "com.disney.",
  "com.hbo.",
  "com.duolingo",
];

/**
 * Pacotes ja documentados como adware/malware. Lista curta e conservadora —
 * o forte da deteccao sao os sinais acima, que pegam tambem o adware novo.
 */
const PREFIXOS_MALICIOSOS = [
  "com.veniosg.dir.android", // MobiDash furtivo (Malwarebytes, 2018)
  "my.tasks.mtt", // pop-ups de anuncio em Samsung (relato publico, 2025)
  "com.gbwhatsapp", // WhatsApp modificado (GB) — distribuido por APK, alvo de trojans
  "com.yowhatsapp",
  "com.fmwhatsapp",
  "com.whatsapp.plus",
];

/** Palavras comuns em nome de adware (limpador, acelerador, lanterna...). */
const PALAVRAS_SUSPEITAS = [
  "cleaner",
  "booster",
  "boost",
  "junk",
  "battery.saver",
  "batterysaver",
  "flashlight",
  "torch",
  "wallpaper",
  "fastcharg",
  "speedup",
  "antivirus.free",
  "phonecleaner",
  "phone.cleaner",
  "ads",
  "adsdk",
];

export function ehLojaOficial(instalador: string | null): boolean {
  return instalador !== null && LOJAS_OFICIAIS.has(instalador);
}

function comecaCom(pacote: string, prefixos: readonly string[]): boolean {
  // "com.google." casa com qualquer pacote do Google; "com.whatsapp" casa com
  // ele mesmo e com "com.whatsapp.w4b", nunca com "com.whatsappfake".
  return prefixos.some((p) => (p.endsWith(".") ? pacote.startsWith(p) : pacote === p || pacote.startsWith(`${p}.`)));
}

export function ehConfiavel(app: Pick<AppDoCelular, "pacote" | "instalador">): boolean {
  return ehLojaOficial(app.instalador) && comecaCom(app.pacote, PREFIXOS_CONFIAVEIS);
}

export function ehConhecidoComoMalicioso(pacote: string): boolean {
  return comecaCom(pacote, PREFIXOS_MALICIOSOS);
}

// ── Pontuacao ───────────────────────────────────────────────────────────────

const DIAS_RECENTE = 15;

export function analisarApp(app: AppDoCelular, agora: Date = new Date()): AppAnalisado {
  const sinais: SinalDeSuspeita[] = [];
  const confiavel = ehConfiavel(app);
  const malicioso = ehConhecidoComoMalicioso(app.pacote);

  if (malicioso) sinais.push({ id: "conhecido", peso: 10, texto: "Está na lista de apps maliciosos conhecidos" });
  if (app.administrador)
    sinais.push({ id: "admin", peso: 4, texto: "É administrador do dispositivo (bloqueia a desinstalação normal)" });
  if (!app.temIcone) sinais.push({ id: "sem-icone", peso: 3, texto: "Não aparece na tela inicial (app escondido)" });
  if (app.sobreOutrosApps) sinais.push({ id: "sobreposicao", peso: 2, texto: "Pode abrir telas por cima de outros apps" });
  if (!ehLojaOficial(app.instalador))
    sinais.push({ id: "fora-da-loja", peso: 2, texto: "Instalado fora da loja oficial (APK baixado)" });
  if (app.acessibilidade) sinais.push({ id: "acessibilidade", peso: 2, texto: "Tem serviço de acessibilidade ligado (lê e controla a tela)" });
  if (app.telaInicialPadrao) sinais.push({ id: "tela-inicial", peso: 2, texto: "Está como tela inicial padrão" });
  if (app.leitorDeNotificacoes) sinais.push({ id: "notificacoes", peso: 1, texto: "Lê as notificações do celular" });
  if (app.permissoes.has("android.permission.REQUEST_INSTALL_PACKAGES"))
    sinais.push({ id: "instala-apps", peso: 1, texto: "Pode instalar outros apps" });
  if (app.permissoes.has("android.permission.RECEIVE_BOOT_COMPLETED") && app.sobreOutrosApps)
    sinais.push({ id: "inicia-sozinho", peso: 1, texto: "Liga sozinho quando o celular inicia" });
  const pacoteMinusculo = app.pacote.toLowerCase();
  if (PALAVRAS_SUSPEITAS.some((palavra) => pacoteMinusculo.includes(palavra)))
    sinais.push({ id: "nome", peso: 1, texto: "Nome típico de limpador/acelerador/lanterna" });
  if (app.instaladoEm) {
    const dias = (agora.getTime() - new Date(app.instaladoEm).getTime()) / 86_400_000;
    if (dias >= 0 && dias <= DIAS_RECENTE) sinais.push({ id: "recente", peso: 1, texto: `Instalado há ${Math.max(0, Math.floor(dias))} dia(s)` });
  }

  // App conhecido da loja oficial: os sinais ficam visiveis, mas nao pontuam
  // (WhatsApp le notificacoes, teclado do Google tem acessibilidade...).
  const pontos = malicioso ? sinais.reduce((s, x) => s + x.peso, 0) : confiavel ? 0 : sinais.reduce((s, x) => s + x.peso, 0);
  const nivel: NivelDeSuspeita = pontos >= 6 ? "ALTO" : pontos >= 3 ? "MEDIO" : "BAIXO";
  return { ...app, sinais, pontos, nivel, confiavel, conhecidoComoMalicioso: malicioso };
}

export function ordenarPorSuspeita(apps: readonly AppAnalisado[]): AppAnalisado[] {
  return [...apps].sort((a, b) => b.pontos - a.pontos || a.pacote.localeCompare(b.pacote));
}

// ── Leitura da saida dos comandos ──────────────────────────────────────────

const RE_PACOTE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

export function pacoteValido(pacote: string): boolean {
  return RE_PACOTE.test(pacote) && pacote.length <= 255;
}

/** `pm list packages -3 -i` -> [{pacote, instalador}] */
export function lerListaDePacotes(saida: string): Array<{ pacote: string; instalador: string | null }> {
  const lista: Array<{ pacote: string; instalador: string | null }> = [];
  for (const linha of saida.split(/\r?\n/)) {
    const m = /^package:(\S+)(.*)$/.exec(linha.trim());
    if (!m || !pacoteValido(m[1]!)) continue;
    const instalador = /installer=(\S+)/.exec(m[2] ?? "")?.[1] ?? null;
    lista.push({ pacote: m[1]!, instalador: instalador && instalador !== "null" ? instalador : null });
  }
  return lista;
}

/** Saida com componentes "pacote/classe" (query-activities, resolve-activity). */
export function lerPacotesDeComponentes(saida: string): Set<string> {
  const pacotes = new Set<string>();
  for (const m of saida.matchAll(/([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)\/[A-Za-z0-9_.$]+/g)) {
    pacotes.add(m[1]!);
  }
  return pacotes;
}

/** `settings get secure enabled_accessibility_services` ("a/b:c/d") */
export function lerServicosHabilitados(saida: string): Set<string> {
  const texto = saida.trim();
  if (!texto || texto === "null") return new Set();
  return new Set(
    texto
      .split(":")
      .map((item) => item.split("/")[0]!.trim())
      .filter(pacoteValido)
  );
}

/** `dumpsys device_policy` -> componentes de admin ativos ("pacote/classe"). */
export function lerAdministradores(saida: string): string[] {
  const componentes = new Set<string>();
  for (const m of saida.matchAll(/ComponentInfo\{([^/}\s]+)\/([^}\s]+)\}/g)) {
    if (pacoteValido(m[1]!)) componentes.add(`${m[1]}/${m[2]}`);
  }
  return [...componentes];
}

/** `appops query-op ... SYSTEM_ALERT_WINDOW allow` -> pacotes, um por linha. */
export function lerListaSimples(saida: string): Set<string> {
  return new Set(
    saida
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^package:/, ""))
      .filter(pacoteValido)
  );
}

export type DetalheDoPacote = {
  instaladoEm: string | null;
  versao: string | null;
  permissoes: Set<string>;
  desativado: boolean;
  suspenso: boolean;
  sobreOutrosApps: boolean | null;
};

/**
 * `dumpsys package X` seguido de `appops get X SYSTEM_ALERT_WINDOW`.
 * Tolerante: formato muda entre versoes e fabricantes; o que nao achar fica nulo.
 */
export function lerDetalheDoPacote(saida: string): DetalheDoPacote {
  const instalado = /firstInstallTime=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/.exec(saida)?.[1] ?? null;
  const versao = /versionName=(\S+)/.exec(saida)?.[1] ?? null;
  const permissoes = new Set<string>();
  for (const m of saida.matchAll(/android\.permission\.[A-Z_]+/g)) permissoes.add(m[0]);
  // "User 0: ... installed=true hidden=false suspended=false ... enabled=3"
  const usuario0 = /User 0:[^\n]*/.exec(saida)?.[0] ?? "";
  const enabled = /enabled=(\d)/.exec(usuario0)?.[1];
  const desativado = enabled === "2" || enabled === "3" || enabled === "4";
  const suspenso = /suspended=true/.test(usuario0);
  const op = /SYSTEM_ALERT_WINDOW: (allow|ignore|deny|default|foreground)/.exec(saida)?.[1];
  return {
    instaladoEm: instalado ? `${instalado.replace(" ", "T")}` : null,
    versao,
    permissoes,
    desativado,
    suspenso,
    sobreOutrosApps: op === undefined ? null : op === "allow",
  };
}

/** Pacote da janela em foco: `dumpsys window` (mCurrentFocus / mFocusedApp). */
export function lerAppEmFoco(saida: string): string | null {
  const linha =
    /mCurrentFocus=Window\{[^}]*\s([a-zA-Z][\w.]*)\/[^\s}]+\}/.exec(saida)?.[1] ??
    /mFocusedApp=.*?\s([a-zA-Z][\w.]*)\/[^\s}]+/.exec(saida)?.[1] ??
    null;
  return linha && pacoteValido(linha) ? linha : null;
}

// ── Remocao ─────────────────────────────────────────────────────────────────

export type ResultadoDaRemocao = "REMOVIDO" | "BLOQUEADO_POR_ADMIN" | "FALHOU";

/** Le a resposta de `pm uninstall`. */
export function lerResultadoDaDesinstalacao(saida: string): ResultadoDaRemocao {
  if (/\bSuccess\b/.test(saida)) return "REMOVIDO";
  if (/DEVICE_POLICY_MANAGER|device admin|active admin/i.test(saida)) return "BLOQUEADO_POR_ADMIN";
  return "FALHOU";
}

/** Texto para colar na OS. */
export function montarRelatorio(
  aparelho: string,
  quando: Date,
  removidos: readonly string[],
  neutralizados: readonly string[],
  analisados: number
): string {
  const linhas = [
    `Remoção de vírus — ${aparelho}`,
    `Data: ${quando.toLocaleString("pt-BR")}`,
    `Apps analisados: ${analisados}`,
  ];
  if (removidos.length) linhas.push(`Removidos (${removidos.length}): ${removidos.join(", ")}`);
  if (neutralizados.length) linhas.push(`Bloqueados (${neutralizados.length}): ${neutralizados.join(", ")}`);
  if (!removidos.length && !neutralizados.length) linhas.push("Nenhum app removido.");
  return linhas.join("\n");
}
