import type { TipoDeEvento } from "@/lib/dominio/agenda/agenda";

/** Cor e rotulo de cada tipo de item da agenda — usados na agenda e no Dashboard. */
export const ESTILO_DO_EVENTO: Record<TipoDeEvento, { rotulo: string; ponto: string; chip: string }> = {
  COMPROMISSO: { rotulo: "Compromisso", ponto: "bg-kx-info", chip: "bg-kx-info-fundo text-kx-info-texto" },
  RECEBER: { rotulo: "A receber", ponto: "bg-kx-sucesso", chip: "bg-kx-sucesso-fundo text-kx-sucesso-texto" },
  PAGAR: { rotulo: "A pagar", ponto: "bg-kx-erro", chip: "bg-kx-erro-fundo text-kx-erro-texto" },
  META: { rotulo: "Prazo de meta", ponto: "bg-kx-garantia", chip: "bg-kx-garantia-fundo text-kx-garantia-texto" },
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "AAAA-MM-DD" -> "sexta, 13 de novembro" (sem fuso: a chave ja e o dia da loja). */
export function rotuloDoDia(chave: string): string {
  const [a, m, d] = chave.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[data.getUTCDay()]}, ${d} de ${MESES[m - 1]}`;
}

export function rotuloDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const nome = MESES[m - 1] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

export const formatarMoeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
