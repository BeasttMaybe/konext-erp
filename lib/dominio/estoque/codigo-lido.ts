/**
 * Qual produto e este codigo que o leitor acabou de ler?
 *
 * Vale para o leitor USB do balcao e para a camera do celular: os dois
 * entregam o TEXTO que esta nas barras, e esse texto nem sempre e igual ao
 * que foi cadastrado.
 *
 * OS DOIS CASOS EM QUE A COMPARACAO SIMPLES FALHAVA
 *
 * 1. Codigo cadastrado com 12 digitos. A etiqueta (lib/dominio/estoque/
 *    etiqueta.ts) imprime EAN-13 e o gerador CALCULA o 13o digito, o
 *    verificador. O leitor devolve os 13. O PDV procurava os 13 entre
 *    cadastros de 12 e nao achava nada. Mesmo vale para EAN-8 de 7 digitos.
 * 2. Produto sem codigo de barras. A etiqueta sai em Code128 com o SKU, mas
 *    o PDV so procurava por codigo de barras — a etiqueta que o proprio
 *    sistema imprimiu nao era reconhecida pelo proprio sistema.
 */

export type ProdutoComCodigo = {
  codigoBarras?: string | null;
  sku?: string | null;
};

function digitoVerificadorEan(semVerificador: string): number {
  const soma = semVerificador
    .split("")
    .map(Number)
    .reverse()
    .reduce((total, digito, indice) => total + digito * (indice % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10;
}

/** O codigo como a ETIQUETA o imprime — com o verificador, quando o cadastro nao tem. */
function comoImpresso(codigoBarras: string): string {
  if (/^\d{12}$/.test(codigoBarras) || /^\d{7}$/.test(codigoBarras)) {
    return codigoBarras + digitoVerificadorEan(codigoBarras);
  }
  return codigoBarras;
}

/**
 * O produto cujo codigo bate com o lido, ou `null`.
 *
 * Ordem de preferencia: codigo de barras (exato, depois como impresso), e so
 * entao SKU — um SKU que por acaso seja igual ao codigo de barras de OUTRO
 * produto nao pode roubar a leitura.
 *
 * Dois produtos com o mesmo codigo: `null`. Escolher um deles seria lancar na
 * venda, em silencio, talvez o produto errado — melhor o PDV cair na busca e
 * a pessoa escolher.
 */
export function produtoPeloCodigoLido<P extends ProdutoComCodigo>(produtos: readonly P[], lido: string): P | null {
  const codigo = lido.trim();
  if (codigo === "") return null;

  const unico = (achados: P[]): P | null | undefined => {
    if (achados.length === 1) return achados[0];
    if (achados.length > 1) return null;
    return undefined;
  };

  const porBarras = unico(
    produtos.filter((produto) => {
      const cadastrado = produto.codigoBarras?.trim() ?? "";
      return cadastrado !== "" && (cadastrado === codigo || comoImpresso(cadastrado) === codigo);
    })
  );
  if (porBarras !== undefined) return porBarras;

  const minusculo = codigo.toLowerCase();
  const porSku = unico(produtos.filter((produto) => (produto.sku?.trim().toLowerCase() ?? "") === minusculo));
  return porSku ?? null;
}
