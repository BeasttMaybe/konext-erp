"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  ChevronDown,
  DollarSign,
  Flag,
  LayoutDashboard,
  Menu,
  Package,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ITENS_NAVEGACAO,
  indiceFilhoAtivo,
  itemEstaAtivo,
} from "@/lib/navegacao/itens-navegacao";
import { cn } from "@/lib/utils";

const ICONES: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  CRM: <Users className="h-4 w-4" />,
  PDV: <ShoppingCart className="h-4 w-4" />,
  Vendas: <Briefcase className="h-4 w-4" />,
  Estoque: <Package className="h-4 w-4" />,
  OS: <Wrench className="h-4 w-4" />,
  Financeiro: <DollarSign className="h-4 w-4" />,
  Metas: <Flag className="h-4 w-4" />,
};

const CONSULTA_TELA_PEQUENA = "(max-width: 1023.98px)";

// Acima de lg o botão não existe no DOM — não basta escondê-lo com CSS.
function useEhTelaPequena(): boolean {
  return useSyncExternalStore(
    (aoMudar) => {
      const consulta = window.matchMedia(CONSULTA_TELA_PEQUENA);
      consulta.addEventListener("change", aoMudar);
      return () => consulta.removeEventListener("change", aoMudar);
    },
    () => window.matchMedia(CONSULTA_TELA_PEQUENA).matches,
    () => false
  );
}

export function MenuMobile() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ehTelaPequena = useEhTelaPequena();
  const [aberto, setAberto] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const chaveRota = `${pathname}?${searchParams.toString()}`;

  // Fecha o sheet a cada navegação.
  useEffect(() => {
    setAberto(false);
  }, [chaveRota]);

  if (!ehTelaPequena) {
    return null;
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <SheetTitle className="border-b border-border px-4 py-4 text-sm font-medium">
          Navegação
        </SheetTitle>

        <nav aria-label="Navegação principal" className="p-2">
          {ITENS_NAVEGACAO.map((item) => {
            const ativo = itemEstaAtivo(item, pathname, searchParams);
            const indiceAtivo = indiceFilhoAtivo(item.filhos ?? [], pathname, searchParams);
            const expandido = expandidos[item.path] ?? ativo;

            if (!item.filhos?.length) {
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                    ativo ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {ICONES[item.iconKey]}
                  {item.label}
                </Link>
              );
            }

            return (
              <div key={item.path}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandidos((atual) => ({ ...atual, [item.path]: !expandido }))
                  }
                  aria-expanded={expandido}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                    ativo ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {ICONES[item.iconKey]}
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("h-4 w-4 transition-transform", expandido && "rotate-180")}
                  />
                </button>

                {expandido ? (
                  <div className="ml-6 border-l border-border pl-3">
                    {item.filhos.map((filho, indice) => {
                      const filhoAtivo = indice === indiceAtivo;

                      return (
                        <Link
                          key={filho.path}
                          href={filho.path}
                          aria-current={filhoAtivo ? "page" : undefined}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm",
                            filhoAtivo
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {filho.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
