import Link from "next/link";
import type { MedidorMeta } from "@/app/actions/dashboard";
import { Medidor } from "./medidor";
import { Superficie, formatarMoeda, formatarPercentual } from "@/components/ui/pagina";

type LinhaOrcamento = {
  rotulo: string;
  medidor: MedidorMeta | null;
  corSerie: string;
  corTexto: string;
};

type MedidoresOrcamentoProps = {
  receita: MedidorMeta | null;
  despesa: MedidorMeta | null;
  custoPecas: MedidorMeta | null;
};

function Linha({ linha }: { linha: LinhaOrcamento }) {
  const { medidor } = linha;

  return (
    <div className="flex items-center gap-3 p-3">
      <Medidor
        rotulo={linha.rotulo}
        percentual={medidor ? medidor.percentual : null}
        corSerie={linha.corSerie}
        textoCentro=""
        tamanho={52}
        espessura={7}
        somenteArco
      />

      <div className="min-w-0">
        <p className="text-[11.5px] text-muted-foreground">{linha.rotulo}</p>

        {medidor ? (
          <>
            <p
              className="my-px text-[19px] font-semibold leading-none"
              style={{ color: linha.corTexto }}
            >
              {formatarPercentual(medidor.percentual)}
            </p>
            <p className="truncate text-[11.5px] tabular-nums text-muted-foreground">
              {formatarMoeda(medidor.atual)} / {formatarMoeda(medidor.alvo)}
            </p>
          </>
        ) : (
          // Ausência de meta é uma frase, não um buraco no card.
          <p className="text-[11.5px] italic text-muted-foreground">Sem meta definida</p>
        )}
      </div>
    </div>
  );
}

export function MedidoresOrcamento({ receita, despesa, custoPecas }: MedidoresOrcamentoProps) {
  const linhas: LinhaOrcamento[] = [
    { rotulo: "Receita", medidor: receita, corSerie: "var(--receita)", corTexto: "var(--t-azul)" },
    {
      rotulo: "Despesas",
      medidor: despesa,
      corSerie: "var(--despesa)",
      corTexto: "var(--t-vermelho)",
    },
    {
      rotulo: "Custo de peças",
      medidor: custoPecas,
      corSerie: "var(--despesa)",
      corTexto: "var(--t-vermelho)",
    },
  ];

  return (
    <Superficie className="gap-0 p-0">
      <div className="flex items-center justify-between gap-2.5 border-b border-border/60 px-3 py-2.5">
        <h2 className="text-[12.5px] font-semibold text-foreground">Orçamento do período</h2>
        <Link href="/metas" className="text-[11.5px] text-muted-foreground hover:text-foreground">
          Abrir metas
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-border/60">
        {linhas.map((linha) => (
          <Linha key={linha.rotulo} linha={linha} />
        ))}
      </div>
    </Superficie>
  );
}
