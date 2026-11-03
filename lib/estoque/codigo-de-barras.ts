/**
 * Geração do código de barras. Só servidor — `bwip-js` é Node.
 *
 * Gera as barras DE VERDADE, pela especificação da simbologia. A referência
 * visual da etiqueta trazia um código de barras desenhado à mão (uma sequência
 * de `<rect>` escolhida pela aparência), e aquilo é um enfeite: um leitor não
 * devolve nada. Etiqueta que não bipa não serve pra nada numa loja, então aqui
 * as barras saem do algoritmo, com dígito verificador quando a simbologia pede.
 */

// Subpath "/node" e não a raiz: a raiz do bwip-js resolve por condição de
// exportação, e com `moduleResolution: "bundler"` o TypeScript cai na variante
// de navegador (que usa canvas do DOM) ou em nenhuma. O subpath aponta direto
// pro build Node, que é onde este módulo roda.
import bwipjs from "bwip-js/node";

import type { SimbologiaEtiqueta } from "@/lib/dominio/estoque/etiqueta";

export type ResultadoCodigoDeBarras =
  | { ok: true; svg: string }
  | { ok: false; erro: string };

export type ResultadoCodigoDeBarrasPng =
  | { ok: true; dataUri: string }
  | { ok: false; erro: string };

/**
 * `scale` alto de propósito: impressora térmica de etiqueta é 203 dpi, e barra
 * fina demais sai borrada e para de ser lida. 4 dá barras com largura mínima
 * folgada em qualquer um dos tamanhos de rolo.
 */
const ESCALA = 4;

/** Altura das barras em milímetros-ish da própria lib (não é mm da etiqueta). */
const ALTURA_DAS_BARRAS = 9;

function opcoes(simbologia: SimbologiaEtiqueta, conteudo: string) {
  return {
    bcid: simbologia,
    text: conteudo,
    scale: ESCALA,
    height: ALTURA_DAS_BARRAS,
    // A legenda é impressa pelo layout da etiqueta, com a fonte do documento.
    // Deixar a lib escrever embaixo das barras daria duas legendas, em duas
    // fontes diferentes.
    includetext: false,
    // Zona de silêncio nas pontas: sem ela o leitor perde o início do código.
    paddingwidth: 2,
  };
}

/**
 * Explica em português o que a lib recusou.
 *
 * A mensagem crua é `bwipp.ean13badLength#6878: EAN-13 must be 12 or 13
 * digits`, que não ajuda quem está olhando a tela do produto.
 */
function traduzirErro(simbologia: SimbologiaEtiqueta, erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);

  if (/badLength|must be/i.test(mensagem)) {
    if (simbologia === "ean13") {
      return "Código de barras inválido para EAN-13: precisa ter 12 ou 13 dígitos.";
    }
    if (simbologia === "ean8") {
      return "Código de barras inválido para EAN-8: precisa ter 7 ou 8 dígitos.";
    }
  }

  if (/checksum|check digit/i.test(mensagem)) {
    return "O dígito verificador do código de barras não fecha. Confira o número.";
  }

  return "Não foi possível gerar o código de barras com este código.";
}

/** SVG, para a prévia na tela. */
export function gerarCodigoDeBarrasSvg(
  simbologia: SimbologiaEtiqueta,
  conteudo: string
): ResultadoCodigoDeBarras {
  try {
    return { ok: true, svg: bwipjs.toSVG(opcoes(simbologia, conteudo)) };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(simbologia, erro) };
  }
}

/**
 * PNG como data URI, para o PDF.
 *
 * O PDF usa imagem e não vetor porque o `@react-pdf/renderer` não aceita um
 * SVG em texto: desmontar o SVG do gerador em primitivas dele seria
 * reimplementar o desenho das barras, que é exatamente o que não se deve
 * fazer à mão.
 */
export async function gerarCodigoDeBarrasPng(
  simbologia: SimbologiaEtiqueta,
  conteudo: string
): Promise<ResultadoCodigoDeBarrasPng> {
  try {
    const buffer = await bwipjs.toBuffer(opcoes(simbologia, conteudo));
    return { ok: true, dataUri: `data:image/png;base64,${buffer.toString("base64")}` };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(simbologia, erro) };
  }
}
