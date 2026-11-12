/**
 * Prepara a logo no NAVEGADOR antes de subir.
 *
 * Diferente da foto de aparelho (sempre JPEG, ver reduzir-imagem.ts), a logo
 * mantem o formato: PNG continua PNG, porque logo com fundo transparente
 * viraria um retangulo branco em JPEG. E logo que ja e pequena sobe como
 * veio — redesenhar no canvas sem precisar so perde nitidez.
 */

import { calcularDimensoes } from "@/lib/fotos/reduzir-imagem";
import {
  LADO_MAIOR_DA_LOGO,
  TAMANHO_MAXIMO_DA_LOGO_GRAVADA,
  type TipoDaLogo,
} from "@/lib/dominio/empresa/logo-enviada";

function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const endereco = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(endereco);
      resolver(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(endereco);
      rejeitar(new Error("Não foi possível abrir essa imagem."));
    };
    imagem.src = endereco;
  });
}

export async function prepararLogo(arquivo: File): Promise<File> {
  const imagem = await carregar(arquivo);
  const larguraOriginal = imagem.naturalWidth || imagem.width;
  const alturaOriginal = imagem.naturalHeight || imagem.height;
  const { largura, altura } = calcularDimensoes(larguraOriginal, alturaOriginal, LADO_MAIOR_DA_LOGO);

  const jaServe =
    largura === larguraOriginal && altura === alturaOriginal && arquivo.size <= TAMANHO_MAXIMO_DA_LOGO_GRAVADA;
  if (jaServe) return arquivo;

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("O navegador não conseguiu processar a imagem.");
  pincel.imageSmoothingQuality = "high";
  pincel.drawImage(imagem, 0, 0, largura, altura);

  const tipo = arquivo.type as TipoDaLogo;
  const blob = await new Promise<Blob | null>((resolver) =>
    tela.toBlob(resolver, tipo, tipo === "image/png" ? undefined : 0.92)
  );
  if (!blob) throw new Error("Não foi possível preparar a imagem para envio.");
  if (blob.size > TAMANHO_MAXIMO_DA_LOGO_GRAVADA) {
    throw new Error("Mesmo reduzida, a logo ficou acima de 1 MB. Tente uma versão mais simples ou em JPG.");
  }
  return new File([blob], arquivo.name, { type: blob.type || tipo });
}
