import type { ReactNode } from "react";

type EstadoVazioProps = {
  mensagem: string;
  acao?: ReactNode;
};

/**
 * Vazio é uma frase, nunca um cartão exibindo 0.
 */
export function EstadoVazio({ mensagem, acao }: EstadoVazioProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">{mensagem}</p>
      {acao}
    </div>
  );
}
