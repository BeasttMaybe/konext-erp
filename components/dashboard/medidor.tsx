import { formatarPercentual } from "@/components/ui/pagina";

type MedidorProps = {
  rotulo: string;
  percentual: number | null;
  corSerie: string;
  textoCentro: string;
  apoio?: string;
  tamanho?: number;
  espessura?: number;
  /** Só o arco: use quando rótulo e valor ficam ao lado, não dentro. */
  somenteArco?: boolean;
};

/**
 * Arco único: a parte preenchida usa a cor da própria série, o restante é o trilho neutro.
 * Nunca duas matizes categóricas no mesmo medidor.
 */
export function Medidor({
  rotulo,
  percentual,
  corSerie,
  textoCentro,
  apoio,
  tamanho = 132,
  espessura = 10,
  somenteArco = false,
}: MedidorProps) {
  const raio = (tamanho - espessura) / 2;
  const centro = tamanho / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = percentual === null ? 0 : Math.max(0, Math.min(100, percentual));
  const traco = (preenchido / 100) * circunferencia;

  const arco = (
    <svg
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      width={tamanho}
      height={tamanho}
      role="img"
      aria-label={`${rotulo}: ${percentual === null ? "sem dados" : formatarPercentual(percentual)}`}
      className="shrink-0"
    >
      <circle
        cx={centro}
        cy={centro}
        r={raio}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={espessura}
      />
      {percentual === null ? null : (
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke={corSerie}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={`${traco} ${circunferencia - traco}`}
          transform={`rotate(-90 ${centro} ${centro})`}
        />
      )}
    </svg>
  );

  if (somenteArco) {
    return arco;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 text-center">
      <div className="relative" style={{ width: tamanho, height: tamanho }}>
        {arco}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-semibold text-foreground"
            style={{ fontSize: tamanho > 90 ? 22 : 13 }}
          >
            {textoCentro}
          </span>
        </div>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground">{rotulo}</p>
        {apoio ? <p className="text-[11px] text-muted-foreground">{apoio}</p> : null}
      </div>
    </div>
  );
}
