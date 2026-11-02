import { paraEstagio, type EtapaOS } from "./etapas";
import type { StatusOS } from "@prisma/client";

/**
 * Cor de etapa da OS, uma só por etapa, vinda dos tokens do design system.
 *
 * Por que por ETAPA e não por status: existem 8 status e 4 etapas, e a cor
 * comunica em que ponto do fluxo a OS está — não qual dos oito nomes internos
 * ela carrega. O mapa anterior (`CLASSES_STATUS_OS`, apagado em 02/11/2026)
 * dava uma cor crua do Tailwind para cada status: sky, cyan, amber, orange,
 * violet, indigo, emerald e rose. Oito matizes sem relação entre si não
 * formam uma escala: quem olha o quadro não consegue dizer se violeta vem
 * antes ou depois de ciano.
 *
 * Os pares vêm de `app/tokens-konext.css`, que já documenta exatamente esta
 * intenção: "orçamento" reaproveita o par de `--kx-alerta` e "pronto" o de
 * `--kx-sucesso` — são a mesma cor no mockup —, enquanto "conserto" e
 * "entregue" têm par próprio (`-fundo`/`-texto`).
 */
export type ClassesEtapaOS = {
  /** Chip compacto: fundo, texto e borda da pílula de etapa. */
  readonly chip: string;
  /** Só a cor-indicador, para bolinha, barra ou ícone. */
  readonly indicador: string;
};

export const CLASSES_POR_ETAPA: Readonly<Record<EtapaOS, ClassesEtapaOS>> = {
  ORCAMENTO: {
    chip: "bg-kx-alerta-fundo text-kx-alerta-texto border-kx-alerta",
    indicador: "bg-kx-orcamento",
  },
  CONSERTO: {
    chip: "bg-kx-conserto-fundo text-kx-conserto-texto border-kx-conserto",
    indicador: "bg-kx-conserto",
  },
  PRONTO: {
    chip: "bg-kx-sucesso-fundo text-kx-sucesso-texto border-kx-sucesso",
    indicador: "bg-kx-pronto",
  },
  ENTREGUE: {
    chip: "bg-kx-entregue-fundo text-kx-entregue-texto border-kx-entregue",
    indicador: "bg-kx-entregue",
  },
};

/** Classes visuais de um status, resolvidas pela etapa a que ele pertence. */
export function classesDoStatusOS(status: StatusOS): ClassesEtapaOS {
  return CLASSES_POR_ETAPA[paraEstagio(status).etapa];
}
