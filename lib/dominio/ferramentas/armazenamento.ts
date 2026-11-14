/**
 * "O que está pesando" — regras puras: ler a saída dos comandos de
 * armazenamento do Android (via ADB, sem root) e montar o retrato do que
 * ocupa espaço no aparelho.
 *
 * Fontes:
 * - `dumpsys diskstats`: espaço livre/total e, por app, o tamanho do próprio
 *   app, dos dados e do cache (3 listas paralelas aos nomes dos pacotes).
 * - `du -k -d 1 /sdcard`: tamanho das pastas do cartão (fotos, vídeos,
 *   WhatsApp, downloads...).
 *
 * Tudo em BYTES aqui dentro.
 */

export type EspacoDoAparelho = {
  livre: number;
  total: number;
};

export type AppComTamanho = {
  pacote: string;
  /** app + dados (o que o app realmente ocupa, sem contar o cache). */
  tamanho: number;
  cache: number;
};

export type PastaDoCartao = {
  caminho: string;
  /** Nome amigável ("Fotos", "WhatsApp"...) quando reconhecido. */
  nome: string;
  tamanho: number;
};

export type RetratoDoArmazenamento = {
  espaco: EspacoDoAparelho | null;
  apps: AppComTamanho[];
  pastas: PastaDoCartao[];
  /** Soma dos caches de todos os apps — o que a limpeza segura libera. */
  cacheTotal: number;
};

// ── Formatação ────────────────────────────────────────────────────────────────

export function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  const casas = valor >= 100 ? 0 : valor >= 10 ? 1 : 2;
  const texto = valor.toFixed(casas).replace(/\.?0+$/, "").replace(".", ",");
  return `${texto} ${unidades[i]}`;
}

export function percentualUsado(espaco: EspacoDoAparelho | null): number | null {
  if (!espaco || espaco.total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(((espaco.total - espaco.livre) / espaco.total) * 100)));
}

// ── diskstats ─────────────────────────────────────────────────────────────────

function lerListaDeNumeros(texto: string, rotulo: string): number[] {
  const m = new RegExp(`${rotulo}:\\s*\\[([^\\]]*)\\]`).exec(texto);
  if (!m || !m[1]!.trim()) return [];
  return m[1]!.split(",").map((x) => {
    const n = Number(x.trim());
    return Number.isFinite(n) ? n : 0;
  });
}

function lerListaDeTextos(texto: string, rotulo: string): string[] {
  const m = new RegExp(`${rotulo}:\\s*\\[([^\\]]*)\\]`).exec(texto);
  if (!m || !m[1]!.trim()) return [];
  return m[1]!.split(",").map((x) => x.trim());
}

/** "Data-Free: 1234567K / 2345678K total = 52% free" -> bytes. */
export function lerEspacoDoDiskstats(saida: string): EspacoDoAparelho | null {
  const m = /Data-Free:\s*([\d.]+)\s*([KMGT]?)\s*\/\s*([\d.]+)\s*([KMGT]?)/i.exec(saida);
  if (!m) return null;
  const escala = (u: string) => ({ "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 })[u.toUpperCase()] ?? 1;
  const livre = Number(m[1]) * escala(m[2]!);
  const total = Number(m[3]) * escala(m[4]!);
  if (!Number.isFinite(livre) || !Number.isFinite(total) || total <= 0) return null;
  return { livre: Math.round(livre), total: Math.round(total) };
}

export function lerAppsDoDiskstats(saida: string): AppComTamanho[] {
  const pacotes = lerListaDeTextos(saida, "Package Names");
  const apps = lerListaDeNumeros(saida, "App Sizes");
  const dados = lerListaDeNumeros(saida, "App Data Sizes");
  const caches = lerListaDeNumeros(saida, "Cache Sizes");
  const lista: AppComTamanho[] = [];
  for (let i = 0; i < pacotes.length; i++) {
    const pacote = pacotes[i]!;
    if (!/^[a-zA-Z][\w.]+$/.test(pacote)) continue;
    const cache = caches[i] ?? 0;
    // App Data Sizes já inclui o cache; tira pra não contar duas vezes.
    const tamanho = Math.max(0, (apps[i] ?? 0) + (dados[i] ?? 0) - cache);
    lista.push({ pacote, tamanho, cache });
  }
  return lista;
}

// ── du do /sdcard ─────────────────────────────────────────────────────────────

const NOMES_DE_PASTA: Record<string, string> = {
  dcim: "Fotos e vídeos (câmera)",
  pictures: "Imagens",
  movies: "Vídeos",
  music: "Músicas",
  download: "Downloads",
  downloads: "Downloads",
  whatsapp: "WhatsApp",
  "whatsapp/media": "WhatsApp (mídia)",
  android: "Dados de apps (Android)",
  documents: "Documentos",
  telegram: "Telegram",
  snapchat: "Snapchat",
  ringtones: "Toques",
};

export function nomeDaPasta(caminho: string): string {
  const base = caminho.replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? "";
  if (NOMES_DE_PASTA[base]) return NOMES_DE_PASTA[base]!;
  if (base.includes("whatsapp")) return "WhatsApp";
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : caminho;
}

/** `du -k -d 1 /sdcard` -> pastas (sem a linha-raiz do próprio /sdcard). */
export function lerPastasDoDu(saida: string, raiz = "/sdcard"): PastaDoCartao[] {
  const pastas: PastaDoCartao[] = [];
  for (const linha of saida.split(/\r?\n/)) {
    const m = /^(\d+)\s+(\/.+?)\s*$/.exec(linha.trim());
    if (!m) continue;
    const caminho = m[2]!.replace(/\/+$/, "");
    if (caminho === raiz || caminho === `${raiz}/`) continue;
    if (/No such file|Permission denied/i.test(linha)) continue;
    pastas.push({ caminho, nome: nomeDaPasta(caminho), tamanho: Number(m[1]) * 1024 });
  }
  return pastas;
}

// ── Montagem ──────────────────────────────────────────────────────────────────

export function montarRetrato(
  diskstats: string,
  du: string,
  opcoes: { topApps?: number; topPastas?: number } = {}
): RetratoDoArmazenamento {
  const apps = lerAppsDoDiskstats(diskstats);
  const pastas = lerPastasDoDu(du);
  const cacheTotal = apps.reduce((s, a) => s + a.cache, 0);
  return {
    espaco: lerEspacoDoDiskstats(diskstats),
    apps: apps
      .filter((a) => a.tamanho > 0)
      .sort((a, b) => b.tamanho - a.tamanho)
      .slice(0, opcoes.topApps ?? 15),
    pastas: pastas.sort((a, b) => b.tamanho - a.tamanho).slice(0, opcoes.topPastas ?? 10),
    cacheTotal,
  };
}
