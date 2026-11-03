import "server-only";

import type { PalavraPdf } from "@/lib/dominio/compras/leitura-pdf";

/**
 * A única parte da leitura de PDF que toca biblioteca e arquivo.
 *
 * Fica separada do domínio de propósito: o que é difícil na leitura de uma
 * nota não é abrir o PDF, é decidir qual pedaço de texto é preço e qual é
 * descrição. Essa decisão mora em `lib/dominio/compras/leitura-pdf.ts`, é
 * função pura e tem teste com as palavras de uma nota real — sem precisar de
 * arquivo, de biblioteca e de ambiente servidor pra rodar.
 *
 * Usa `unpdf` porque é o pdf.js empacotado pra rodar em serverless (a Vercel
 * não tem sistema de arquivos pra fontes padrão nem `canvas`, e o pdf.js
 * normal tenta os dois). Só o texto é lido; nada é renderizado.
 */
export async function extrairPalavrasDoPdf(arquivo: Uint8Array): Promise<{
  palavras: PalavraPdf[];
  paginas: number;
}> {
  const { getDocumentProxy } = await import("unpdf");

  const documento = await getDocumentProxy(arquivo);
  const palavras: PalavraPdf[] = [];

  for (let numeroDaPagina = 1; numeroDaPagina <= documento.numPages; numeroDaPagina += 1) {
    const pagina = await documento.getPage(numeroDaPagina);
    const conteudo = await pagina.getTextContent();

    // A altura da página entra no Y pra que uma nota de várias páginas não
    // misture a linha do topo da página 2 com a do topo da página 1: sem
    // isso, as duas têm o mesmo Y e o agrupamento por linha junta as duas.
    const deslocamentoDaPagina = (numeroDaPagina - 1) * 100_000;

    for (const item of conteudo.items) {
      if (!("str" in item) || typeof item.str !== "string") continue;
      if (item.str.trim() === "") continue;

      // `transform` é a matriz do pdf.js: [a, b, c, d, e, f], onde `e` e `f`
      // são a posição onde o texto foi desenhado.
      const [, , , , x, y] = item.transform as number[];

      palavras.push({ texto: item.str, x, y: y - deslocamentoDaPagina });
    }
  }

  return { palavras, paginas: documento.numPages };
}
