"use client";

import Link from "next/link";

export type AbaCaixa = "aberto" | "fechamento";

interface PropsAbasCaixa {
  abaAtiva: AbaCaixa;
  onEscolher: (aba: AbaCaixa) => void;
}

const ABAS: Array<{ id: AbaCaixa; rotulo: string }> = [
  { id: "aberto", rotulo: "Caixa aberto" },
  { id: "fechamento", rotulo: "Fechar caixa" },
];

/** Tiras de abas + "Voltar ao balcão" (referência: docs/design/referencia-pdv-caixa.html). */
export function AbasCaixa({ abaAtiva, onEscolher }: PropsAbasCaixa) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ABAS.map((aba) => {
        const ativa = aba.id === abaAtiva;
        return (
          <button
            key={aba.id}
            type="button"
            aria-pressed={ativa}
            onClick={() => onEscolher(aba.id)}
            className={`h-10 whitespace-nowrap rounded-kx-pilula border px-4 text-[13px] font-bold transition-colors ${
              ativa
                ? "border-kx-primaria bg-kx-primaria text-primary-foreground"
                : "border-kx-painel-borda bg-transparent text-kx-texto-2 hover:text-kx-texto"
            }`}
          >
            {aba.rotulo}
          </button>
        );
      })}

      <Link
        href="/pdv"
        className="ml-auto flex h-10 items-center gap-2 whitespace-nowrap rounded-kx-botao border border-kx-painel-borda px-3.5 text-sm font-semibold text-kx-texto hover:bg-kx-cartao"
      >
        Voltar ao balcão
      </Link>
    </div>
  );
}
