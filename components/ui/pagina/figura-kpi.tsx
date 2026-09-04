import { formatarPercentual } from "./formatacao";

/** Para qual lado a variação é boa. É propriedade da métrica, nunca inferida do sinal. */
export type DirecaoBoa = "cima" | "baixo";

/** Cor semântica do valor: azul entra, verde fica, vermelho sai. */
export type TomValor = "azul" | "verde" | "vermelho" | "neutro";

export type ComparacaoKPI = {
  variacaoPercentual: number | null;
  direcaoBoa: DirecaoBoa;
};

type FiguraKPIProps = {
  rotulo: string;
  /** Já formatado. Use "—" quando a métrica for indefinida. */
  valor: string;
  tom?: TomValor;
  comparacao?: ComparacaoKPI;
};

const COR_TOM: Record<TomValor, string | undefined> = {
  azul: "var(--t-azul)",
  verde: "var(--t-verde)",
  vermelho: "var(--t-vermelho)",
  neutro: undefined,
};

// Abaixo disso a variação é ruído: seta neutra, sem cor.
const LIMIAR_ESTAVEL = 0.5;

function LinhaComparacao({ comparacao }: { comparacao: ComparacaoKPI }) {
  const variacao = comparacao.variacaoPercentual;

  // Sem base anterior não há seta nem cor.
  if (variacao === null) {
    return (
      <p className="mt-[3px] flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>—</span>
        <span>sem base anterior</span>
      </p>
    );
  }

  const estavel = Math.abs(variacao) < LIMIAR_ESTAVEL;
  const subiu = variacao > 0;
  const bom = comparacao.direcaoBoa === "cima" ? subiu : !subiu;

  // A seta é encoding secundário obrigatório: verde e vermelho não se separam sob daltonismo.
  const seta = estavel ? "→" : subiu ? "↑" : "↓";
  const cor = estavel ? undefined : bom ? "var(--t-verde)" : "var(--t-vermelho)";

  return (
    <p className="mt-[3px] flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className={estavel ? undefined : "font-semibold"} style={cor ? { color: cor } : undefined}>
        {seta} {formatarPercentual(Math.abs(variacao))}
      </span>
      <span>vs. período anterior</span>
    </p>
  );
}

export function FiguraKPI({ rotulo, valor, tom = "neutro", comparacao }: FiguraKPIProps) {
  const cor = COR_TOM[tom];

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] tracking-[0.02em] text-muted-foreground">{rotulo}</p>
      <p
        className="mt-[3px] text-[21px] font-semibold leading-tight tracking-[-0.015em]"
        style={cor ? { color: cor } : undefined}
      >
        {valor}
      </p>
      {comparacao ? <LinhaComparacao comparacao={comparacao} /> : null}
    </div>
  );
}
