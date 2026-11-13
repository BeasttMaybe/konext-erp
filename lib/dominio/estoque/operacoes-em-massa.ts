/**
 * Operacoes em massa do estoque — regras puras (sem banco).
 *
 * Preco sempre em CENTAVOS aqui dentro, para a soma de varios produtos nunca
 * acumular erro de ponto flutuante.
 */

/** Mais do que isso numa operacao so e engano de clique, nao rotina. */
export const MAXIMO_POR_OPERACAO = 200;
/** Etiquetas: o endereco da impressao leva os ids, e o PDF precisa caber. */
export const MAXIMO_DE_PRODUTOS_NA_ETIQUETA = 100;
export const MAXIMO_DE_PAGINAS_DE_ETIQUETA = 500;

export type RegraDePreco =
  | { modo: "DEFINIR"; valorCentavos: number }
  | { modo: "PERCENTUAL"; percentual: number }
  | { modo: "MARGEM_SOBRE_CUSTO"; percentual: number };

export type Arredondamento = "NENHUM" | "NOVENTA" | "INTEIRO";

export type ResultadoDaRegra = { ok: true; regra: RegraDePreco; arredondamento: Arredondamento } | { ok: false; erro: string };

/** Le a regra vinda da tela (texto) e confere os limites. */
export function lerRegraDePreco(entrada: {
  modo?: unknown;
  valor?: unknown;
  arredondamento?: unknown;
}): ResultadoDaRegra {
  const arredondamento: Arredondamento =
    entrada.arredondamento === "NOVENTA" || entrada.arredondamento === "INTEIRO" ? entrada.arredondamento : "NENHUM";
  const texto = String(entrada.valor ?? "").trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  if (texto === "" || !Number.isFinite(numero)) return { ok: false, erro: "Informe o valor." };

  switch (entrada.modo) {
    case "DEFINIR": {
      const centavos = Math.round(numero * 100);
      if (centavos <= 0) return { ok: false, erro: "O preço precisa ser maior que zero." };
      if (centavos > 100_000_000) return { ok: false, erro: "Preço alto demais." };
      return { ok: true, regra: { modo: "DEFINIR", valorCentavos: centavos }, arredondamento };
    }
    case "PERCENTUAL":
      if (numero === 0) return { ok: false, erro: "Informe um percentual diferente de zero." };
      if (numero <= -90 || numero > 500) return { ok: false, erro: "Use um percentual entre -89% e 500%." };
      return { ok: true, regra: { modo: "PERCENTUAL", percentual: numero }, arredondamento };
    case "MARGEM_SOBRE_CUSTO":
      if (numero < 0 || numero > 1000) return { ok: false, erro: "Use uma margem entre 0% e 1000%." };
      return { ok: true, regra: { modo: "MARGEM_SOBRE_CUSTO", percentual: numero }, arredondamento };
    default:
      return { ok: false, erro: "Escolha como alterar o preço." };
  }
}

/** Arredonda PARA CIMA: para ,90 (ex.: 37,12 -> 37,90; 37,95 -> 38,90) ou para o real inteiro. */
export function arredondar(centavos: number, modo: Arredondamento): number {
  if (modo === "INTEIRO") return Math.ceil(centavos / 100) * 100;
  if (modo === "NOVENTA") {
    const reais = Math.floor(centavos / 100);
    const alvo = reais * 100 + 90;
    return centavos <= alvo ? alvo : alvo + 100;
  }
  return centavos;
}

export type PrecoCalculado = { ok: true; novoCentavos: number } | { ok: false; motivo: string };

/** Preco novo de UM produto. `custoCentavos` nulo = quem pediu nao ve custo. */
export function calcularNovoPreco(
  atualCentavos: number,
  custoCentavos: number | null,
  regra: RegraDePreco,
  arredondamento: Arredondamento
): PrecoCalculado {
  let bruto: number;
  switch (regra.modo) {
    case "DEFINIR":
      bruto = regra.valorCentavos;
      break;
    case "PERCENTUAL":
      bruto = Math.round(atualCentavos * (1 + regra.percentual / 100));
      break;
    case "MARGEM_SOBRE_CUSTO":
      if (custoCentavos === null) return { ok: false, motivo: "custo indisponível" };
      if (custoCentavos <= 0) return { ok: false, motivo: "sem custo cadastrado" };
      bruto = Math.round(custoCentavos * (1 + regra.percentual / 100));
      break;
  }
  const novo = arredondar(bruto, arredondamento);
  if (novo <= 0) return { ok: false, motivo: "preço ficaria zero" };
  return { ok: true, novoCentavos: novo };
}

/** Ids unicos, nao vazios, no limite. */
export function normalizarIds(ids: unknown, maximo = MAXIMO_POR_OPERACAO): { ok: true; ids: string[] } | { ok: false; erro: string } {
  if (!Array.isArray(ids)) return { ok: false, erro: "Nenhum produto selecionado." };
  const unicos = [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (unicos.length === 0) return { ok: false, erro: "Nenhum produto selecionado." };
  if (unicos.length > maximo) return { ok: false, erro: `Selecione no máximo ${maximo} produtos por vez.` };
  return { ok: true, ids: unicos };
}

export type ModoDeCopias = "UMA" | "FIXO" | "SALDO";

/** Quantas etiquetas de cada produto. SALDO = uma por unidade em estoque (no minimo 1). */
export function copiasDoProduto(modo: ModoDeCopias, fixo: number, saldo: number): number {
  if (modo === "SALDO") return Math.max(1, Math.min(saldo, MAXIMO_DE_PAGINAS_DE_ETIQUETA));
  if (modo === "FIXO") return Math.max(1, Math.min(Math.floor(fixo) || 1, 100));
  return 1;
}
