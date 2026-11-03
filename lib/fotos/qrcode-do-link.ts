import "server-only";

// Mesmo motivo do subpath em lib/estoque/codigo-de-barras.ts: a raiz do
// bwip-js resolve pela condição de navegador sob `moduleResolution: "bundler"`.
import bwipjs from "bwip-js/node";

/**
 * O QR code do link de envio de foto.
 *
 * O link tem um segredo de 43 caracteres e ninguém vai digitar isso num
 * celular — e quem tentar vai errar, porque base64url mistura maiúscula,
 * minúscula, hífen e sublinhado. O QR existe pra que o caminho seja apontar
 * a câmera, que é o gesto que a pessoa já faz.
 *
 * Usa a mesma biblioteca do código de barras do estoque, que já está no
 * projeto e já tem QR: uma dependência nova aqui seria peso por nada.
 */

/**
 * Correção de erro `M` (cerca de 15%).
 *
 * A escolha é sobre onde esse QR vive: a tela do balcão, lida de perto, em
 * monitor. Não é etiqueta amassada nem caixa empoeirada. `H` (30%) aguentaria
 * mais sujeira, mas gasta essa resistência engordando o código — com uma URL
 * desta altura, viram muito mais módulos na mesma área, e módulo menor é
 * justamente o que um celular antigo tem dificuldade de resolver.
 */
const CORRECAO_DE_ERRO = "M";

/** Módulos grandes o bastante pra câmera ruim pegar de primeira. */
const ESCALA = 5;

export type ResultadoQrCode = { ok: true; svg: string } | { ok: false; erro: string };

export function gerarQrCodeSvg(conteudo: string): ResultadoQrCode {
  try {
    const opcoes = {
      bcid: "qrcode",
      text: conteudo,
      scale: ESCALA,
      // `eclevel` é opção da simbologia QR no BWIPP, mas o `.d.ts` do
      // bwip-js só declara as opções comuns a todos os códigos — não há
      // tipo pra ela. O valor vai explícito mesmo assim, e não deixado no
      // padrão da biblioteca: é a correção de erro do código, e um padrão
      // que mude numa atualização mudaria em silêncio se o QR ainda lê na
      // câmera ruim do balcão.
      eclevel: CORRECAO_DE_ERRO,
      // Zona de silêncio: sem a margem branca em volta, leitor nenhum acha
      // onde o código começa quando ele encosta na borda do cartão.
      paddingwidth: 2,
      paddingheight: 2,
    } satisfies Record<string, unknown>;

    return {
      ok: true,
      svg: bwipjs.toSVG(opcoes as Parameters<typeof bwipjs.toSVG>[0]),
    };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Não foi possível gerar o QR code.",
    };
  }
}
