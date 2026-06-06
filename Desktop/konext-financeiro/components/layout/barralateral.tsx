"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Wrench,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/contextos/contexto-sidebar";

/**
 * Componente da Barra Lateral (Sidebar) do Dashboard
 */
export function BarraLateral() {
  const { contraida, setContraida } = useSidebar();
  const nomeRota = usePathname();

  // Mapeamento de ícones
  const icones: Record<string, React.ReactNode> = {
    Dashboard: <LayoutDashboard className="h-5 w-5" />,
    CRM: <Users className="h-5 w-5" />,
    PDV: <ShoppingCart className="h-5 w-5" />,
    Estoque: <Package className="h-5 w-5" />,
    OS: <Wrench className="h-5 w-5" />,
    Financeiro: <DollarSign className="h-5 w-5" />,
  };

  const itensMenu = [
    { nome: "Dashboard", caminho: "/", icone: "Dashboard" },
    { nome: "CRM", caminho: "/crm", icone: "CRM" },
    { nome: "PDV", caminho: "/pdv", icone: "PDV" },
    { nome: "Estoque", caminho: "/estoque", icone: "Estoque" },
    { nome: "Ordens de Serviço", caminho: "/os", icone: "OS" },
    { nome: "Financeiro", caminho: "/financeiro", icone: "Financeiro" },
  ];

  // Verifica se a rota atual é ativa
  const rotaAitva = (caminho: string) => {
    if (caminho === "/" && nomeRota === "/") return true;
    if (caminho !== "/" && nomeRota.includes(caminho)) return true;
    return false;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-white dark:bg-slate-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out flex flex-col",
        contraida ? "w-20" : "w-64"
      )}
    >
      {/* Cabeçalho da Sidebar */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
        {!contraida && (
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            Konext
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setContraida(!contraida)}
          className="h-8 w-8"
        >
          {contraida ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Menu de Navegação */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {itensMenu.map((item) => (
          <Link
            key={item.caminho}
            href={item.caminho}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors text-sm font-medium",
              rotaAitva(item.caminho)
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-zinc-700 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            {icones[item.icone]}
            {!contraida && <span>{item.nome}</span>}
          </Link>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <p
          className={cn(
            "text-xs text-zinc-500 dark:text-zinc-500 text-center",
            contraida && "truncate"
          )}
        >
          {!contraida ? "Powered by Konext" : "v1.0"}
        </p>
      </div>
    </aside>
  );
}
