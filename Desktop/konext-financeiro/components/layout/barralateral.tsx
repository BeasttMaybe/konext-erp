"use client";

import { useEffect, useState } from "react";
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
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/contextos/contexto-sidebar";
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";

/**
 * Componente da Barra Lateral (Sidebar) do Dashboard
 */
export function BarraLateral() {
  const { contraida, setContraida } = useSidebar();
  const nomeRota = usePathname();
  const [nomeEmpresa, setNomeEmpresa] = useState("Konext");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    const carregarBranding = async () => {
      try {
        const dados = await obterDadosPerfilConfiguracao();
        if (!ativo) return;
        setNomeEmpresa(dados.configuracao?.nomeFantasia || "Konext");
        setLogoUrl(dados.configuracao?.logoUrl || null);
      } catch {
        if (!ativo) return;
        setNomeEmpresa("Konext");
        setLogoUrl(null);
      }
    };

    carregarBranding();

    return () => {
      ativo = false;
    };
  }, []);

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
      <div
        className={cn(
          "h-20 flex items-center border-b border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out",
          contraida ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        <div
          className={cn(
            "flex items-center overflow-hidden transition-all duration-300 ease-in-out",
            contraida ? "justify-center" : "gap-3"
          )}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={nomeEmpresa}
              className={cn(
                "rounded-md object-contain border border-zinc-200 dark:border-zinc-700 bg-white transition-all duration-300 ease-in-out",
                contraida ? "w-10 h-10" : "w-14 h-14"
              )}
            />
          ) : (
            <div
              className={cn(
                "rounded-md flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-zinc-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 transition-all duration-300 ease-in-out",
                contraida ? "w-10 h-10" : "w-14 h-14"
              )}
            >
              {contraida ? (
                <Box className="h-5 w-5" />
              ) : (
                <span className="text-base font-bold">{nomeEmpresa.charAt(0).toUpperCase()}</span>
              )}
            </div>
          )}

          {!contraida && (
            <div className="text-xl font-bold text-slate-900 dark:text-white transition-all duration-300 ease-in-out">
              {nomeEmpresa}
            </div>
          )}
        </div>

        <div className="self-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setContraida(!contraida)}
            className="h-9 w-9 shrink-0"
          >
            {contraida ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
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
          {!contraida ? `Powered by ${nomeEmpresa}` : "v1.0"}
        </p>
      </div>
    </aside>
  );
}
