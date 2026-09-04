import type { ReactNode } from "react";

type CabecalhoCardProps = {
  titulo: string;
  acao?: ReactNode;
};

/** Cabeçalho padrão de card do painel: título curto à esquerda, ação discreta à direita. */
export function CabecalhoCard({ titulo, acao }: CabecalhoCardProps) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-border/60 px-3 py-2.5">
      <h2 className="text-[12.5px] font-semibold tracking-[0.01em] text-foreground">{titulo}</h2>
      {acao ? <div className="text-[11.5px] text-muted-foreground">{acao}</div> : null}
    </div>
  );
}
