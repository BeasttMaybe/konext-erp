/**
 * Entrada, conversao e checagem de limite do campo de desconto do PDV —
 * dominio puro, sem React nem Zustand.
 *
 * O bug relatado ("digitar em % nao produz nada") vinha de um unico
 * `<input type="number">` compartilhado pelos dois modos, com o valor
 * digitado sendo arredondado/travado a cada tecla pelo proprio `onChange`
 * (Math.min/Math.max direto na store) — em "%", quando o limite configurado
 * e baixo, o valor volta pra 0 a cada tecla, e `0 || ""` exibe campo vazio.
 * A correcao troca o input nativo por um campo de texto com sanitizacao e
 * parse PROPRIOS de cada unidade (mesmo padrao ja usado em
 * app/(dashboard)/pdv/page.tsx para o preco editavel do item — ver
 * sanitizarPrecoInput/parsePrecoInput/formatarPrecoInput).
 */

export type UnidadeDesconto = "PERCENTUAL" | "VALOR";

const CASAS_DECIMAIS_PERCENTUAL = 2;
const LIMITE_MAXIMO_PERCENTUAL = 100;

/** Mantem so digitos e uma virgula decimal, com no maximo 2 casas depois dela. */
export function sanitizarEntradaPercentual(texto: string): string {
  const apenasDigitosEVirgula = texto.replace(/[^\d,]/g, "");
  const [parteInteira, ...decimaisExtras] = apenasDigitosEVirgula.split(",");

  if (decimaisExtras.length === 0) {
    return parteInteira;
  }

  return `${parteInteira},${decimaisExtras.join("").slice(0, CASAS_DECIMAIS_PERCENTUAL)}`;
}

/** Converte o texto digitado (',' como separador decimal) num numero entre 0 e 100, com ate 2 casas. */
export function parseEntradaPercentual(texto: string): number {
  const normalizado = texto.replace(",", ".").trim();
  const numero = Number(normalizado);

  if (!Number.isFinite(numero) || numero <= 0) {
    return 0;
  }

  const arredondado = Math.round(numero * 100) / 100;
  return Math.min(LIMITE_MAXIMO_PERCENTUAL, arredondado);
}

export function formatarPercentual(valor: number): string {
  return valor.toFixed(CASAS_DECIMAIS_PERCENTUAL).replace(".", ",");
}

/**
 * Converte o valor de desconto pedido de uma unidade pra outra, usando o
 * subtotal do carrinho como referencia — trocar de unidade nunca pode
 * descartar silenciosamente o desconto que o operador ja tinha digitado.
 * Sem subtotal (carrinho vazio), nao ha o que converter: zera.
 */
export function converterDescontoEntreUnidades(parametros: {
  valor: number;
  deUnidade: UnidadeDesconto;
  paraUnidade: UnidadeDesconto;
  subtotal: number;
}): number {
  const { valor, deUnidade, paraUnidade, subtotal } = parametros;

  if (deUnidade === paraUnidade || !Number.isFinite(valor) || valor <= 0) {
    return Math.max(0, valor);
  }

  if (subtotal <= 0) {
    return 0;
  }

  if (deUnidade === "VALOR" && paraUnidade === "PERCENTUAL") {
    const percentual = (valor / subtotal) * 100;
    return Math.min(LIMITE_MAXIMO_PERCENTUAL, Math.round(percentual * 100) / 100);
  }

  // PERCENTUAL -> VALOR
  const reais = subtotal * (valor / 100);
  return Math.round(reais * 100) / 100;
}

export type ResultadoLimiteDesconto = {
  /** Desconto pedido, convertido pra reais — mesma base que o servidor usa. */
  descontoReais: number;
  /** Percentual que esse desconto representa do subtotal — a UNICA grandeza comparavel ao limite, nas duas unidades. */
  percentualEfetivo: number;
  /** O limite configurado, em reais, para ESTE subtotal — "ate R$ X" na mensagem da Parte 2. */
  limiteReais: number;
  acimaDoLimite: boolean;
};

/**
 * Confere o desconto pedido (em qualquer unidade) contra o limite percentual
 * configurado, convertendo primeiro pra reais e depois pra percentual do
 * subtotal — a mesma formula que o servidor usa (calcularVendaPdv, em
 * lib/dominio/pdv/calcular-venda.ts), inclusive a mesma folga de
 * arredondamento de 0.01 ponto percentual. Isto e so preview no cliente: o
 * servidor recalcula tudo de novo e e quem decide de verdade.
 */
export function calcularLimiteDesconto(parametros: {
  valor: number;
  unidade: UnidadeDesconto;
  subtotal: number;
  limitePercentual: number;
}): ResultadoLimiteDesconto {
  const { valor, unidade, subtotal, limitePercentual } = parametros;

  const subtotalSeguro = Math.max(0, subtotal);
  const limitePercentualSeguro = Math.max(0, limitePercentual);

  const descontoReaisBruto =
    unidade === "PERCENTUAL" ? subtotalSeguro * (Math.max(0, valor) / 100) : Math.max(0, valor);
  const descontoReais = Math.min(descontoReaisBruto, subtotalSeguro);

  const percentualEfetivo = subtotalSeguro > 0 ? (descontoReais / subtotalSeguro) * 100 : 0;
  const limiteReais = subtotalSeguro * (limitePercentualSeguro / 100);

  const acimaDoLimite = percentualEfetivo > limitePercentualSeguro + 0.01;

  return { descontoReais, percentualEfetivo, limiteReais, acimaDoLimite };
}
