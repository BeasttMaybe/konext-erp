"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS_FINANCEIRO = [
  { href: "/financeiro", rotulo: "Visão geral" },
  { href: "/financeiro/receber", rotulo: "A receber" },
  { href: "/financeiro/pagar", rotulo: "A pagar" },
  { href: "/financeiro/fluxo", rotulo: "Fluxo e relatórios" },
  { href: "/financeiro/notas-fiscais", rotulo: "Notas fiscais" },
] as const;

/**
 * Navegação única do módulo Financeiro (Fase 3-2D, Parte 1) — substitui o
 * "Centro de Comando" de atalhos: as 5 seções vivem aqui, em toda tela do
 * módulo, não numa página própria de links.
 */
export function NavFinanceiro() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções do financeiro"
      className="flex w-fit gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-superficie p-1"
    >
      {ABAS_FINANCEIRO.map((aba) => {
        const ativa = aba.href === "/financeiro" ? pathname === "/financeiro" : pathname.startsWith(aba.href);

        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-kx-botao px-4 text-sm font-bold transition-colors",
              ativa ? "bg-kx-primaria text-primary-foreground" : "text-kx-texto-2 hover:bg-kx-cartao"
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
