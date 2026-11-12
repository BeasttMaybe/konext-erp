/**
 * Logo da empresa enviada como arquivo (em vez de um link de imagem).
 *
 * LIMITES
 *
 * - Na escolha: ate 5 MB, PNG, JPG ou WEBP. E o que a pessoa ve na tela.
 * - Antes de subir, o navegador reduz a imagem para no maximo 1200px no lado
 *   maior — logo nao precisa de mais que isso nem no A4 — mantendo PNG como
 *   PNG (para nao perder o fundo transparente).
 * - No servidor: ate 1 MB, e o tipo e conferido pelos PRIMEIROS BYTES do
 *   arquivo, nao pelo nome nem pelo tipo que o navegador declarou. SVG fica
 *   de fora de proposito: SVG e codigo, e servido pelo proprio sistema
 *   poderia rodar script no endereco dele.
 */

export const TIPOS_DA_LOGO = ["image/png", "image/jpeg", "image/webp"] as const;
export type TipoDaLogo = (typeof TIPOS_DA_LOGO)[number];

export const TAMANHO_MAXIMO_DO_ARQUIVO_ESCOLHIDO = 5 * 1024 * 1024;
export const TAMANHO_MAXIMO_DA_LOGO_GRAVADA = 1024 * 1024;
export const LADO_MAIOR_DA_LOGO = 1200;

/** Endereco onde o sistema serve a logo enviada (app/logo-da-empresa/route.ts). */
export const CAMINHO_DA_LOGO = "/logo-da-empresa";

/**
 * O `v` muda a cada envio. A rota manda o navegador guardar a imagem por
 * muito tempo; sem trocar o endereco, uma logo nova ficaria escondida atras
 * da antiga guardada no navegador de cada um.
 */
export function caminhoDaLogo(versao: number): string {
  return `${CAMINHO_DA_LOGO}?v=${Math.trunc(versao)}`;
}

export function ehCaminhoDaLogoEnviada(url: string): boolean {
  return new RegExp(`^${CAMINHO_DA_LOGO}(\\?v=\\d+)?$`).test(url.trim());
}

export function detectarTipoDaLogo(bytes: Uint8Array): TipoDaLogo | null {
  const comeca = (assinatura: number[], deslocamento = 0) =>
    bytes.length >= deslocamento + assinatura.length && assinatura.every((b, i) => bytes[deslocamento + i] === b);

  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";
  // RIFF....WEBP
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function formatarMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Conferencia feita no navegador, na hora da escolha. */
export function conferirArquivoEscolhido(arquivo: { type: string; size: number }): string | null {
  if (!(TIPOS_DA_LOGO as readonly string[]).includes(arquivo.type)) {
    return "Envie a logo em PNG, JPG ou WEBP.";
  }
  if (arquivo.size > TAMANHO_MAXIMO_DO_ARQUIVO_ESCOLHIDO) {
    return `O arquivo tem ${formatarMegabytes(arquivo.size)}. O limite é ${formatarMegabytes(TAMANHO_MAXIMO_DO_ARQUIVO_ESCOLHIDO)}.`;
  }
  return null;
}

export type ResultadoDaLogo = { ok: true; tipo: TipoDaLogo } | { ok: false; erro: string };

/** Conferencia autoritativa, no servidor, sobre os bytes que chegaram. */
export function validarLogoRecebida(bytes: Uint8Array): ResultadoDaLogo {
  if (bytes.length === 0) return { ok: false, erro: "O arquivo da logo chegou vazio." };
  if (bytes.length > TAMANHO_MAXIMO_DA_LOGO_GRAVADA) {
    return {
      ok: false,
      erro: `A logo tem ${formatarMegabytes(bytes.length)} depois de reduzida; o limite é ${formatarMegabytes(TAMANHO_MAXIMO_DA_LOGO_GRAVADA)}.`,
    };
  }
  const tipo = detectarTipoDaLogo(bytes);
  if (!tipo) return { ok: false, erro: "O arquivo não é uma imagem PNG, JPG ou WEBP." };
  return { ok: true, tipo };
}
