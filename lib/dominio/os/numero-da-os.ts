import { FUSO_HORARIO_PADRAO } from "@/lib/datas";

/**
 * Rotulo da OS: "OS-2026-090".
 *
 * O ano e o da CRIACAO da OS, no fuso da loja — nao o ano de hoje. Com o ano
 * de hoje, toda OS mudava de nome na virada do ano ("OS-2026-090" virava
 * "OS-2027-090"), e o cliente que guardou o papel procurava por um numero que
 * o sistema nao mostrava mais. O numero em si e sequencial e unico; o ano so
 * situa.
 *
 * Sem data (registro antigo sem o campo), cai no ano de hoje — o mesmo
 * comportamento de antes, nunca um rotulo quebrado.
 */
export function formatarNumeroOS(
  numero: number,
  criadoEm: Date | string | null | undefined,
  fusoHorario: string = FUSO_HORARIO_PADRAO
): string {
  const data = criadoEm ? new Date(criadoEm) : new Date();
  const valida = Number.isNaN(data.getTime()) ? new Date() : data;
  const ano = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: fusoHorario }).format(valida);
  return `OS-${ano}-${String(numero).padStart(3, "0")}`;
}
