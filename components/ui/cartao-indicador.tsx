import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cartão indicador (Fase 3-1) — o KPI card colorido do topo de cada tela
 * (faturamento do dia, OS em aberto, etc.). A variante pinta só o ícone e a
 * faixa lateral; o corpo do cartão continua em `--kx-cartao` pra não virar
 * um bloco de cor sólida gritando ao lado dos outros.
 */
const faixaVariants = cva("absolute inset-y-0 left-0 w-1 rounded-l-kx-cartao", {
  variants: {
    variante: {
      primaria: "bg-kx-primaria",
      sucesso: "bg-kx-sucesso",
      alerta: "bg-kx-alerta",
      erro: "bg-kx-erro",
      neutro: "bg-kx-legenda",
      azul: "bg-kx-conserto",
      garantia: "bg-kx-garantia",
      entregue: "bg-kx-entregue",
    },
  },
  defaultVariants: { variante: "primaria" },
});

const iconeVariants = cva("hidden h-10 w-10 shrink-0 sm:flex items-center justify-center rounded-kx-botao [&_svg]:h-5 [&_svg]:w-5", {
  variants: {
    variante: {
      primaria: "bg-kx-primaria/15 text-kx-destaque",
      sucesso: "bg-kx-sucesso-fundo text-kx-sucesso-texto",
      alerta: "bg-kx-alerta-fundo text-kx-alerta-texto",
      erro: "bg-kx-erro-fundo text-kx-erro-texto",
      neutro: "bg-muted text-muted-foreground",
      azul: "bg-kx-conserto-fundo text-kx-conserto-texto",
      garantia: "bg-kx-garantia-fundo text-kx-garantia-texto",
      entregue: "bg-kx-entregue-fundo text-kx-entregue-texto",
    },
  },
  defaultVariants: { variante: "primaria" },
});

export type PropsCartaoIndicador = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof faixaVariants> & {
    titulo: string;
    valor: string | number;
    icone?: React.ReactNode;
    /** Variação percentual — positiva mostra seta pra cima, negativa pra baixo. Sem prop = não mostra nada. */
    tendenciaPercentual?: number;
    /** Aceita nó React pra permitir destaque pontual (ex.: um trecho em --kx-alerta) sem quebrar quem só passa string. */
    descricao?: React.ReactNode;
  };

function CartaoIndicador({
  className,
  variante = "primaria",
  titulo,
  valor,
  icone,
  tendenciaPercentual,
  descricao,
  ...props
}: PropsCartaoIndicador) {
  const temTendencia = typeof tendenciaPercentual === "number";
  const tendenciaPositiva = temTendencia && tendenciaPercentual! >= 0;

  return (
    <div
      className={cn(
        // No celular, compacto: dois por linha, sem o icone e com numero menor —
        // um por linha, como no computador, os cartoes ocupavam a tela toda
        // antes do conteudo da pagina.
        "relative overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-3 shadow-kx-cartao sm:p-kx-4",
        className
      )}
      {...props}
    >
      <div className={faixaVariants({ variante })} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 pl-2 sm:pl-kx-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium text-kx-legenda">{titulo}</p>
          <p className="text-lg font-bold tabular-nums text-kx-texto sm:text-2xl">{valor}</p>
          {descricao && <p className="text-xs text-kx-legenda">{descricao}</p>}
          {temTendencia && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium tabular-nums",
                tendenciaPositiva ? "text-kx-sucesso" : "text-kx-erro"
              )}
            >
              {tendenciaPositiva ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {tendenciaPositiva ? "+" : ""}
              {tendenciaPercentual}%
            </p>
          )}
        </div>
        {icone && <div className={iconeVariants({ variante })}>{icone}</div>}
      </div>
    </div>
  );
}

export { CartaoIndicador };
