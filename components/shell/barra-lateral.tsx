"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  DollarSign,
  Flag,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/contextos/contexto-permissoes";
import type { Permissao } from "@/lib/auth/permissoes";
import { caminhoDoItem, filhosVisiveis, ITENS_NAVEGACAO, itemEstaAtivo } from "@/lib/navegacao/itens-navegacao";
import { logout } from "@/app/actions/auth";
import { StatusCaixa } from "./status-caixa";

const ICONES: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  CRM: Users,
  PDV: ShoppingCart,
  Vendas: Briefcase,
  Estoque: Package,
  OS: Wrench,
  Financeiro: DollarSign,
  Metas: Flag,
};

/**
 * Barra lateral fixa (Fase 3-1, Parte 3) — 1024–1279px vira trilho de só
 * ícones, 1280px+ mostra rótulo, abaixo de 1024px some inteira (dá lugar à
 * `GavetaLateralMobile`). Tudo por classe responsiva do Tailwind — sem
 * detectar breakpoint em JS, pra não arriscar descompasso entre servidor e
 * cliente na primeira renderização. O item ativo "entalha" na área de
 * conteúdo: fundo igual ao `--background` do conteúdo, sem arredondar o
 * lado que encosta nele — como as duas superfícies têm a mesma cor, a
 * borda some e dá a impressão de o item "entrar" no conteúdo.
 */
export function BarraLateral() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissoes } = usePermissoes();
  const temAlgumaPermissao = useMemo(
    () => (lista: readonly Permissao[]) => lista.some((permissao) => permissoes.has(permissao)),
    [permissoes]
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-kx-barra-lateral hidden w-[72px] flex-col border-r border-kx-painel-borda bg-kx-painel lg:flex xl:w-[248px]">
      <div className="flex h-16 shrink-0 items-center justify-center gap-2.5 px-2 xl:justify-start xl:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao bg-kx-primaria text-base font-extrabold text-primary-foreground">
          K
        </div>
        <span className="hidden text-base font-extrabold tracking-tight text-kx-texto xl:inline">Konext</span>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {ITENS_NAVEGACAO.map((item) => {
          const filhos = filhosVisiveis(item, temAlgumaPermissao);
          if (item.filhos?.length && filhos.length === 0) return null;

          const ativo = itemEstaAtivo(item, pathname, searchParams);
          const caminho = caminhoDoItem(item, filhos);
          const Icone = ICONES[item.iconKey] ?? LayoutDashboard;

          return (
            <Link
              key={item.path}
              href={caminho}
              aria-current={ativo ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex h-11 items-center justify-center gap-3 rounded-l-kx-cartao rounded-r-none px-0 text-sm font-medium transition-colors xl:justify-start xl:px-3",
                ativo
                  ? "bg-background text-foreground"
                  : "text-kx-texto-2 hover:bg-kx-superficie hover:text-kx-texto"
              )}
            >
              <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="hidden truncate xl:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-kx-painel-borda p-2 xl:p-3">
        <StatusCaixa expandido={false} />
        <button
          type="button"
          onClick={() => void logout()}
          title="Sair"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-kx-botao px-0 text-sm font-medium text-kx-texto-2 transition-colors hover:bg-kx-erro-fundo hover:text-kx-erro-texto xl:justify-start xl:px-3"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="hidden xl:inline">Sair</span>
        </button>
      </div>
    </aside>
  );
}
