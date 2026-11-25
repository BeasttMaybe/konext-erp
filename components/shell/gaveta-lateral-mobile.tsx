"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  DollarSign,
  CalendarDays,
  Flag,
  Hammer,
  Landmark,
  Megaphone,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/contextos/contexto-permissoes";
import type { Permissao } from "@/lib/auth/permissoes";
import { caminhoDoItem, filhosVisiveis, itensDaNavegacao, itemEstaAtivo } from "@/lib/navegacao/itens-navegacao";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusCaixa } from "./status-caixa";

const ICONES: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  CRM: Users,
  PDV: ShoppingCart,
  Vendas: Briefcase,
  Estoque: Package,
  OS: Wrench,
  Financeiro: DollarSign,
  Agenda: CalendarDays,
  Metas: Flag,
  Marketing: Megaphone,
  Prefeitura: Landmark,
  Ferramentas: Hammer,
  Ajuda: LifeBuoy,
};

/** Gaveta de navegação abaixo de 1024px (Fase 3-1, Parte 3) — mesma fonte de itens/permissão da barra lateral fixa. */
export function GavetaLateralMobile() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissoes, modulos } = usePermissoes();
  const [aberta, setAberta] = useState(false);
  // Ajusta estado durante a renderização (nunca em useEffect — setState
  // sincrono num efeito dispara render em cascata) pra fechar a gaveta
  // quando a rota muda, comparando com o pathname da renderização anterior.
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setAberta(false);
  }

  const temAlgumaPermissao = (lista: readonly Permissao[]) => lista.some((permissao) => permissoes.has(permissao));

  return (
    <Sheet open={aberta} onOpenChange={setAberta}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-kx-painel p-0">
        <SheetTitle className="border-b border-kx-painel-borda px-4 py-4 text-sm font-medium text-kx-texto">
          Navegação
        </SheetTitle>

        <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto p-3">
          {itensDaNavegacao(modulos).map((item) => {
            const filhos = filhosVisiveis(item, temAlgumaPermissao);
            if (item.filhos?.length && filhos.length === 0) return null;

            const ativo = itemEstaAtivo(item, pathname, searchParams);
            const caminho = caminhoDoItem(item, filhos);
            const Icone = ICONES[item.iconKey] ?? LayoutDashboard;

            return (
              <div key={item.path}>
                <Link
                  href={caminho}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-kx-botao px-3 text-sm font-medium",
                    ativo ? "bg-kx-superficie text-kx-texto" : "text-kx-texto-2"
                  )}
                >
                  <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>

                {/* Aqui TODAS as seções ficam abertas, diferente da barra do
                    desktop, onde só a ativa abre.

                    A gaveta é aberta justamente pra ir pra outro lugar, e
                    fecha assim que alguém navega. Exigir que a pessoa abra a
                    seção primeiro pra só então ver "Contas a Receber"
                    significaria abrir a gaveta, navegar pro Financeiro, abrir
                    a gaveta de novo. A barra do desktop fica sempre à vista e
                    não tem esse problema — por isso lá vale economizar linha. */}
                {filhos.length > 1 && (
                  <ul className="mb-1 mt-0.5 space-y-0.5 border-l border-kx-painel-borda pl-5">
                    {filhos.map((filho) => (
                      <li key={filho.path}>
                        <Link
                          href={filho.path}
                          className="flex h-10 items-center rounded-kx-botao px-3 text-[13px] text-kx-texto-2"
                        >
                          {filho.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-kx-painel-borda p-3">
          <StatusCaixa expandido />
          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-11 w-full items-center gap-3 rounded-kx-botao px-3 text-sm font-medium text-kx-texto-2 hover:bg-kx-erro-fundo hover:text-kx-erro-texto"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            Sair
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
