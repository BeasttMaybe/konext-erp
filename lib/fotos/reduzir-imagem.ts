/**
 * Redução da imagem no NAVEGADOR, antes de subir.
 *
 * Dois motivos, e os dois decidem sozinhos:
 *
 * 1. Foto de celular tem 3 a 6 MB, e o corpo de uma requisição na Vercel para
 *    em 4,5 MB. O arquivo original simplesmente não chegaria ao servidor.
 * 2. Quem está no balcão com o cliente esperando sente a diferença entre subir
 *    300 KB e subir 5 MB numa internet de loja.
 *
 * O que se perde é resolução que ninguém usa: 1600px no lado maior mostra
 * arranhão e trinca com folga no zoom, e é a mesma foto para qualquer
 * discussão com cliente. O que se ganha é a foto chegar.
 *
 * A saída é sempre JPEG — inclusive para HEIC do iPhone, que o `canvas`
 * converte de graça ao desenhar. É por isso que o servidor não precisa aceitar
 * HEIC, formato que boa parte dos navegadores não exibe.
 */

import { PALETA_PAPEL } from "@/lib/design/papel";
import {
  LADO_MAIOR_APOS_REDUCAO,
  QUALIDADE_DA_REDUCAO,
  TAMANHO_MAXIMO_DA_FOTO_EM_BYTES,
} from "@/lib/dominio/os/fotos";

export type ImagemReduzida = {
  arquivo: File;
  largura: number;
  altura: number;
  /** Tamanho do arquivo original, para a tela poder dizer o quanto economizou. */
  tamanhoOriginal: number;
};

/** Novas dimensões mantendo a proporção. Imagem menor que o limite não cresce. */
export function calcularDimensoes(
  largura: number,
  altura: number,
  ladoMaior: number = LADO_MAIOR_APOS_REDUCAO
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);

  // Ampliar uma foto pequena não acrescenta detalhe nenhum; só aumenta o
  // arquivo e deixa a imagem borrada.
  if (maior <= ladoMaior) return { largura, altura };

  const proporcao = ladoMaior / maior;

  return {
    largura: Math.max(1, Math.round(largura * proporcao)),
    altura: Math.max(1, Math.round(altura * proporcao)),
  };
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const endereco = URL.createObjectURL(arquivo);
    const imagem = new Image();

    imagem.onload = () => {
      // Libera o endereço assim que a imagem está decodificada; sem isso cada
      // foto escolhida segura memória até a página recarregar.
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

export async function reduzirImagem(arquivo: File): Promise<ImagemReduzida> {
  const imagem = await carregarImagem(arquivo);

  const { largura, altura } = calcularDimensoes(
    imagem.naturalWidth || imagem.width,
    imagem.naturalHeight || imagem.height
  );

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;

  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("O navegador não conseguiu processar a imagem.");

  // Fundo branco antes de desenhar: PNG com transparência vira preto em JPEG,
  // e uma foto de aparelho com fundo preto parece foto estragada.
  //
  // O branco vem de `PALETA_PAPEL`, que é o único lugar do projeto autorizado a
  // ter hex literal — e é o conceito certo aqui: não é cor de tema (que muda
  // entre claro e escuro), é o branco de fundo de uma imagem achatada, igual ao
  // branco do papel.
  pincel.fillStyle = PALETA_PAPEL.papel;
  pincel.fillRect(0, 0, largura, altura);
  pincel.drawImage(imagem, 0, 0, largura, altura);

  const blob = await new Promise<Blob | null>((resolver) =>
    tela.toBlob(resolver, "image/jpeg", QUALIDADE_DA_REDUCAO)
  );

  if (!blob) throw new Error("Não foi possível preparar a imagem para envio.");

  if (blob.size > TAMANHO_MAXIMO_DA_FOTO_EM_BYTES) {
    throw new Error(
      "Mesmo reduzida, a imagem ficou acima do limite. Tente uma foto com menos detalhe ou tirada mais de perto."
    );
  }

  const nome = `${arquivo.name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;

  return {
    arquivo: new File([blob], nome, { type: "image/jpeg" }),
    largura,
    altura,
    tamanhoOriginal: arquivo.size,
  };
}
