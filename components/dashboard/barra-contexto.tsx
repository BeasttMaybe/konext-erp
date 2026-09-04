import Link from "next/link";
import type { PeriodoDashboard } from "@/app/actions/dashboard";
import { cn } from "@/lib/utils";

const OPCOES_PERIODO: Array<{ valor: PeriodoDashboard; rotulo: string }> = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "mes", rotulo: "Mês" },
];

type BarraContextoProps = {
  empresa: string;
  periodo: PeriodoDashboard;
};

export function BarraContexto({ empresa, periodo }: BarraContextoProps) {
  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{empresa}</span>
        <span className="mx-2 text-border">|</span>
        {dataHoje}
      </p>

      <nav aria-label="Período" className="flex items-center gap-1">
        {OPCOES_PERIODO.map((opcao) => {
          const ativo = opcao.valor === periodo;

          return (
            <Link
              key={opcao.valor}
              href={`/?periodo=${opcao.valor}`}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                ativo
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opcao.rotulo}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
