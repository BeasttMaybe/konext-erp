/**
 * A visao em LISTA das OS em andamento — a alternativa ao quadro (Kanban),
 * no formato do hub de OS do Bling: filtros por etapa com contagem no topo,
 * uma linha por OS, colunas ordenaveis.
 *
 * Puro de proposito: recebe as OS ja carregadas pela tela (as mesmas do
 * quadro, sem consulta nova ao banco) e devolve o que mostrar. A tela so
 * desenha.
 */
import { diferencaEmDiasDeCalendario, FUSO_HORARIO_PADRAO } from "@/lib/datas";

import { ETAPA_OS_SEQUENCIA, type EtapaOS } from "./maquina-estados";

/** O minimo de uma OS que a lista usa — o tipo da tela satisfaz isto. */
export type OSDaLista = {
  id: string;
  numeroOS: string;
  nomeCliente: string;
  equipamento: string;
  marca?: string;
  modelo?: string;
  imei?: string;
  etapa: EtapaOS;
  ehRetornoGarantia?: boolean;
  totalOrcamento: number;
  dataCriacao: string;
  dataAtualizacao: string;
  tecnicos: ReadonlyArray<{ nome: string; principal: boolean }>;
};

/**
 * Filtros do topo. "GARANTIA" nao e etapa: e a OS que voltou em garantia,
 * em qualquer etapa — no quadro ela aparece misturada nas colunas; aqui da
 * para isola-la, que e a pergunta "quantos retornos tenho na bancada?".
 */
export type FiltroDaLista = "TODAS" | EtapaOS | "GARANTIA";

export const FILTROS_DA_LISTA: readonly FiltroDaLista[] = ["TODAS", ...ETAPA_OS_SEQUENCIA, "GARANTIA"];

export type ColunaOrdenavel = "numero" | "entrada" | "cliente" | "valor" | "parada";
export type Direcao = "asc" | "desc";

/** A partir de quantos dias sem movimentacao uma OS merece destaque. */
export const DIAS_PARA_DESTACAR_PARADA = 7;

function passaNoFiltro(os: OSDaLista, filtro: FiltroDaLista): boolean {
  if (filtro === "TODAS") return true;
  if (filtro === "GARANTIA") return os.ehRetornoGarantia === true;
  return os.etapa === filtro;
}

/** Contagem de cada filtro — sempre sobre a lista inteira, nunca sobre a ja filtrada. */
export function contarPorFiltro(ordens: readonly OSDaLista[]): Record<FiltroDaLista, number> {
  const contagem = Object.fromEntries(FILTROS_DA_LISTA.map((filtro) => [filtro, 0])) as Record<FiltroDaLista, number>;
  for (const os of ordens) {
    for (const filtro of FILTROS_DA_LISTA) {
      if (passaNoFiltro(os, filtro)) contagem[filtro] += 1;
    }
  }
  return contagem;
}

/**
 * Dias corridos desde a ultima movimentacao da OS, no fuso da loja.
 *
 * Dia de CALENDARIO, nao 24h: uma OS mexida ontem as 23h esta "parada ha 1
 * dia" hoje de manha, que e como uma pessoa le.
 */
export function diasParada(os: Pick<OSDaLista, "dataAtualizacao">, agora: Date, fusoHorario = FUSO_HORARIO_PADRAO): number {
  return Math.max(0, diferencaEmDiasDeCalendario(new Date(os.dataAtualizacao), agora, fusoHorario));
}

/** Numero da OS como numero, para ordenar "OS-2026-010" depois de "OS-2026-009". */
function numeroParaOrdenar(numeroOS: string): number {
  const digitos = numeroOS.match(/(\d+)\D*$/);
  return digitos ? Number(digitos[1]) : 0;
}

export function aparelhoDaOS(os: Pick<OSDaLista, "equipamento" | "marca" | "modelo">): string {
  const marcaModelo = [os.marca, os.modelo].filter(Boolean).join(" ");
  return marcaModelo || os.equipamento;
}

export function tecnicoPrincipal(os: Pick<OSDaLista, "tecnicos">): string | null {
  return os.tecnicos.find((tecnico) => tecnico.principal)?.nome ?? os.tecnicos[0]?.nome ?? null;
}

export function montarLista<T extends OSDaLista>(
  ordens: readonly T[],
  opcoes: { filtro: FiltroDaLista; coluna: ColunaOrdenavel; direcao: Direcao; agora: Date; fusoHorario?: string }
): T[] {
  const fuso = opcoes.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const sinal = opcoes.direcao === "asc" ? 1 : -1;

  const chave = (os: T): number | string => {
    switch (opcoes.coluna) {
      case "numero":
        return numeroParaOrdenar(os.numeroOS);
      case "entrada":
        return new Date(os.dataCriacao).getTime();
      case "cliente":
        return os.nomeCliente.toLocaleLowerCase("pt-BR");
      case "valor":
        return os.totalOrcamento;
      case "parada":
        return diasParada(os, opcoes.agora, fuso);
    }
  };

  return ordens
    .filter((os) => passaNoFiltro(os, opcoes.filtro))
    .map((os) => ({ os, chave: chave(os) }))
    .sort((a, b) => {
      const comparacao =
        typeof a.chave === "string" && typeof b.chave === "string"
          ? a.chave.localeCompare(b.chave, "pt-BR")
          : (a.chave as number) - (b.chave as number);
      // Empate: a OS mais nova primeiro, para a ordem nunca "pular" entre
      // renderizacoes.
      return comparacao * sinal || numeroParaOrdenar(b.os.numeroOS) - numeroParaOrdenar(a.os.numeroOS);
    })
    .map(({ os }) => os);
}

/** Clicar no cabecalho: mesma coluna inverte, coluna nova comeca na direcao natural dela. */
export function proximaOrdenacao(
  atual: { coluna: ColunaOrdenavel; direcao: Direcao },
  clicada: ColunaOrdenavel
): { coluna: ColunaOrdenavel; direcao: Direcao } {
  if (atual.coluna === clicada) return { coluna: clicada, direcao: atual.direcao === "asc" ? "desc" : "asc" };
  // Nome em ordem alfabetica; o resto (numero, data, valor, dias parada)
  // do maior para o menor, que e o que se quer ver primeiro.
  return { coluna: clicada, direcao: clicada === "cliente" ? "asc" : "desc" };
}

/**
 * Qual visao abre: o quadro ou a lista. Gravada num cookie para o
 * SERVIDOR ja desenhar a escolhida — sem piscar o quadro antes da lista.
 */
export type VisaoDaOS = "quadro" | "lista";
export const COOKIE_VISAO_OS = "kx_visao_os";

export function lerVisaoDaOS(valor: string | null | undefined): VisaoDaOS {
  return valor === "lista" ? "lista" : "quadro";
}
