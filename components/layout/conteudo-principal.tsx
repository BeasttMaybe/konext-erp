import { ReactNode } from "react";

interface ConteudoPrincipalProps {
  children: ReactNode;
}

/**
 * Conteúdo principal: largura total, centralizado e sem deslocamento lateral.
 * O cabeçalho é sticky e ocupa espaço no fluxo, então não há offset a compensar.
 */
export function ConteudoPrincipal({ children }: ConteudoPrincipalProps) {
  return (
    <main className="flex-1 bg-transparent">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">{children}</div>
    </main>
  );
}
