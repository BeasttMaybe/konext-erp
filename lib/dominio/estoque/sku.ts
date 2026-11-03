/**
 * SKU do produto: o código curto que a loja usa para achar o item.
 *
 * Não existia. O produto tinha só `codigoBarras`, que é opcional e vem do
 * fabricante — então um produto sem código de barras (peça avulsa, acessório
 * genérico, serviço) não tinha nenhum identificador curto, e a única forma de
 * achar era pelo nome. Nome é o pior identificador possível num balcão: muda,
 * tem acento, e dois produtos parecidos têm nomes parecidos.
 *
 * O formato é `PREFIXO-0000`: três letras tiradas da categoria, mais um
 * sequencial de quatro dígitos dentro daquele prefixo. É gerado pelo sistema e
 * editável pelo dono — quem já tem um código próprio não deve ser forçado a
 * trocar.
 */

import { normalizarNome } from "@/lib/dominio/texto/chave-de-nome";

export const TAMANHO_DO_PREFIXO = 3;
export const DIGITOS_DO_SEQUENCIAL = 4;

/** Usado quando a categoria não rende três letras (ex.: nome só com dígitos). */
const PREFIXO_RESERVA = "PRO";

/**
 * Prefixo a partir do nome da categoria: as três primeiras LETRAS, sem acento,
 * em maiúsculas. "Capas" → CAP, "Peça de reparo" → PEC, "Equipamento de rede"
 * → EQU.
 *
 * Só letras entram, porque o prefixo é o que a pessoa lê e digita: dígito e
 * hífen no prefixo tornariam o separador do sequencial ambíguo ("3G-0001" vs
 * "3-G0001").
 */
export function prefixoDaCategoria(nomeDaCategoria: string): string {
  const somenteLetras = normalizarNome(nomeDaCategoria).replace(/[^a-z]/g, "");

  if (somenteLetras.length === 0) return PREFIXO_RESERVA;

  return somenteLetras.slice(0, TAMANHO_DO_PREFIXO).toUpperCase().padEnd(TAMANHO_DO_PREFIXO, "X");
}

/** `CAP-0012`. O sequencial estoura os quatro dígitos sem truncar: 10000 vira `CAP-10000`. */
export function montarSku(prefixo: string, sequencial: number): string {
  return `${prefixo}-${String(Math.max(1, Math.trunc(sequencial))).padStart(DIGITOS_DO_SEQUENCIAL, "0")}`;
}

/**
 * Lê o sequencial de um SKU que siga o formato, pra saber onde a contagem
 * parou. Devolve `null` para SKU digitado à mão fora do padrão — que é
 * permitido, e por isso não pode atrapalhar a geração do próximo.
 */
export function lerSequencialDoSku(sku: string, prefixo: string): number | null {
  const padrao = new RegExp(`^${prefixo}-(\\d+)$`, "i");
  const encontrado = padrao.exec(sku.trim());
  if (!encontrado) return null;

  const numero = Number.parseInt(encontrado[1], 10);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Próximo SKU livre do prefixo, a partir dos que já existem.
 *
 * Usa o MAIOR sequencial encontrado + 1, e não a contagem de produtos: contar
 * repetiria um código assim que qualquer produto fosse excluído, e SKU repetido
 * é pior que SKU com buraco na sequência.
 */
export function proximoSku(prefixo: string, skusExistentes: readonly string[]): string {
  let maior = 0;

  for (const sku of skusExistentes) {
    const sequencial = lerSequencialDoSku(sku, prefixo);
    if (sequencial !== null && sequencial > maior) maior = sequencial;
  }

  return montarSku(prefixo, maior + 1);
}

/**
 * Como o SKU digitado é gravado: sem espaços, em maiúsculas.
 *
 * Maiúsculas porque o SKU é comparado por igualdade e lido em etiqueta — "cap-12"
 * e "CAP-12" sendo dois produtos diferentes seria uma armadilha garantida no
 * balcão.
 */
export function formatarSku(sku: string): string {
  return sku.trim().replace(/\s+/g, "").toUpperCase();
}

export type ValidacaoSku = { valido: true; sku: string } | { valido: false; erro: string };

export const TAMANHO_MAXIMO_SKU = 24;

export function validarSku(skuBruto: string): ValidacaoSku {
  const sku = formatarSku(skuBruto);

  if (sku.length === 0) {
    return { valido: false, erro: "Informe o SKU do produto." };
  }

  if (sku.length > TAMANHO_MAXIMO_SKU) {
    return { valido: false, erro: `O SKU deve ter no máximo ${TAMANHO_MAXIMO_SKU} caracteres.` };
  }

  // Letras, dígitos, hífen e ponto. Fora disso não é código: é texto, e vai
  // quebrar busca, etiqueta e leitor.
  if (!/^[A-Z0-9.-]+$/.test(sku)) {
    return { valido: false, erro: "O SKU aceita apenas letras, números, ponto e hífen." };
  }

  return { valido: true, sku };
}
