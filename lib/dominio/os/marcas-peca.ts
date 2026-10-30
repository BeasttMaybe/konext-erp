/**
 * Regras puras das marcas de peça da OS.
 *
 * A marca existe para que o relatório de custo e margem por peça tenha resposta:
 * `ItemOS.tipoPeca` (enum) cruzado com a marca cadastrada. Isso só funciona se
 * duas grafias da mesma marca forem a mesma marca — por isso a chave de
 * unicidade é o nome normalizado, e a normalização vive aqui, num só lugar,
 * nunca montada à mão dentro de uma action.
 */

import type { TipoPeca } from "@prisma/client";

/** Nome mais longo que isso não é marca, é descrição no campo errado. */
export const TAMANHO_MAXIMO_NOME_MARCA = 40;

/**
 * Único tipo de item que dispensa marca. É por `OUTROS` que mão de obra e
 * serviço são lançados na OS, e serviço não tem marca — exigir ali seria pedir
 * a marca do próprio trabalho da loja.
 */
const TIPO_SEM_MARCA: TipoPeca = "OUTROS";

/**
 * Chave de unicidade e de agrupamento: minúsculas, sem acento, sem espaço
 * duplicado nas pontas ou no meio. "Original ", "original" e "ORIGINÁL" colapsam
 * no mesmo valor, que é exatamente o ponto — sem isso o relatório trata cada
 * grafia como uma marca diferente.
 *
 * `NFD` separa a letra do acento e o intervalo U+0300–U+036F remove as marcas de
 * combinação que sobram.
 */
export function normalizarNomeMarca(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Como a marca é exibida e gravada: espaços colapsados, acento preservado. */
export function formatarNomeMarca(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

export type ValidacaoNomeMarca =
  | { valido: true; nome: string; nomeNormalizado: string }
  | { valido: false; erro: string };

export function validarNomeMarca(nomeBruto: string): ValidacaoNomeMarca {
  const nome = formatarNomeMarca(nomeBruto);

  if (nome.length === 0) {
    return { valido: false, erro: "Informe o nome da marca." };
  }

  if (nome.length > TAMANHO_MAXIMO_NOME_MARCA) {
    return {
      valido: false,
      erro: `O nome da marca deve ter no máximo ${TAMANHO_MAXIMO_NOME_MARCA} caracteres.`,
    };
  }

  const nomeNormalizado = normalizarNomeMarca(nome);

  // Sem pelo menos uma letra ou um dígito não há marca: "---" e um nome feito só
  // de acentos combinantes (que a normalização remove por completo) não servem
  // como chave de agrupamento nem como rótulo numa tela.
  if (!/[a-z0-9]/.test(nomeNormalizado)) {
    return { valido: false, erro: "Informe um nome de marca com letras ou números." };
  }

  return { valido: true, nome, nomeNormalizado };
}

/** `true` quando o tipo de item escolhido exige marca. */
export function exigeMarcaPeca(tipoPeca: TipoPeca): boolean {
  return tipoPeca !== TIPO_SEM_MARCA;
}

export type ValidacaoMarcaDoItem = { valido: true } | { valido: false; erro: string };

/**
 * Regra única de "este item pode ser salvo sem marca?". A tela e a action
 * chamam a mesma função: a tela para não deixar enviar, a action porque
 * esconder um campo nunca foi validação.
 */
export function validarMarcaDoItem(
  tipoPeca: TipoPeca,
  marcaPecaId: string | null | undefined
): ValidacaoMarcaDoItem {
  if (!exigeMarcaPeca(tipoPeca)) return { valido: true };

  if (typeof marcaPecaId !== "string" || marcaPecaId.trim().length === 0) {
    return { valido: false, erro: "Escolha a marca da peça." };
  }

  return { valido: true };
}
