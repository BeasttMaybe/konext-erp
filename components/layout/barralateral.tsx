"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  Users,
  ShoppingCart,
  Briefcase,
  Package,
  Wrench,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Box,
  Flag,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/contextos/contexto-sidebar";
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";
import { obterPoliticaSessaoAtual, type PoliticaSessaoAtual } from "@/app/actions/auth";

/**
 * Componente da Barra Lateral (Sidebar) do Dashboard
 */

interface SidebarSubItem {
  label: string;
  path: string;
}

interface SidebarItem {
  label: string;
  path: string;
  iconKey: string;
  subItems?: SidebarSubItem[];
}

export function BarraLateral() {
  const { contraida: isCollapsed, setContraida: setIsCollapsed } = useSidebar();
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState("Konext");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [politicaSessao, setPoliticaSessao] = useState<PoliticaSessaoAtual | null>(null);
  const [toggledParents, setToggledParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let ativo = true;

    const carregarBranding = async () => {
      try {
        const dados = await obterDadosPerfilConfiguracao();
        const politica = await obterPoliticaSessaoAtual();
        if (!ativo) return;
        setCompanyName(dados.configuracao?.nomeFantasia || "Konext");
        setLogoUrl(dados.configuracao?.logoUrl || null);
        setPoliticaSessao(politica);
      } catch {
        if (!ativo) return;
        setCompanyName("Konext");
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
    Inicio: <Home className="h-5 w-5" />,
    CRM: <Users className="h-5 w-5" />,
    PDV: <ShoppingCart className="h-5 w-5" />,
    Vendas: <Briefcase className="h-5 w-5" />,
    Estoque: <Package className="h-5 w-5" />,
    OS: <Wrench className="h-5 w-5" />,
    Financeiro: <DollarSign className="h-5 w-5" />,
    Metas: <Flag className="h-5 w-5" />,
    Configuracoes: <Settings className="h-5 w-5" />,
  };

  const navigationItems: SidebarItem[] = [
    { label: "Dashboard", path: "/", iconKey: "Dashboard" },
    {
      label: "CRM",
      path: "/crm",
      iconKey: "CRM",
      subItems: [
        { label: "Hub Central", path: "/crm" },
        { label: "Contatos", path: "/crm/contatos" },
        { label: "Oportunidades", path: "/crm/oportunidades" },
        { label: "Propostas", path: "/crm/propostas" },
      ],
    },
    { label: "PDV", path: "/pdv", iconKey: "PDV" },
    {
      label: "Vendas",
      path: "/vendas",
      iconKey: "Vendas",
      subItems: [
        { label: "Hub Central", path: "/vendas" },
        { label: "Novo Pedido", path: "/vendas/pedidos/novo" },
        { label: "Histórico", path: "/vendas/historico" },
      ],
    },
    { label: "Estoque", path: "/estoque", iconKey: "Estoque" },
    {
      label: "Ordens de Serviço",
      path: "/os",
      iconKey: "OS",
      subItems: [
        { label: "Hub Central", path: "/os" },
        { label: "Kanban", path: "/os?modo=kanban" },
        { label: "Finalizadas", path: "/os?modo=lista" },
        { label: "Garantias", path: "/os/garantias" },
      ],
    },
    {
      label: "Financeiro",
      path: "/financeiro",
      iconKey: "Financeiro",
      subItems: [
        { label: "Hub Financeiro", path: "/financeiro" },
        { label: "Contas a Receber", path: "/financeiro/receber" },
        { label: "Contas a Pagar", path: "/financeiro/pagar" },
      ],
    },
    { label: "Metas", path: "/metas", iconKey: "Metas" },
    { label: "Configurações", path: "/configuracoes", iconKey: "Configuracoes" },
  ];
  const navigationItemsTenantMigrado: SidebarItem[] = [
    { label: "Inicio", path: "/inicio", iconKey: "Inicio" },
    {
      label: "CRM",
      path: "/crm",
      iconKey: "CRM",
      subItems: [
        { label: "Hub Central", path: "/crm" },
        { label: "Contatos", path: "/crm/contatos" },
        { label: "Oportunidades", path: "/crm/oportunidades" },
        { label: "Propostas", path: "/crm/propostas" },
      ],
    },
    { label: "PDV", path: "/pdv", iconKey: "PDV" },
    {
      label: "Vendas",
      path: "/vendas",
      iconKey: "Vendas",
      subItems: [
        { label: "Hub Central", path: "/vendas" },
        { label: "Novo Pedido", path: "/vendas/pedidos/novo" },
        { label: "Historico", path: "/vendas/historico" },
      ],
    },
    { label: "Estoque", path: "/estoque", iconKey: "Estoque" },
    {
      label: "Ordens de Servico",
      path: "/os",
      iconKey: "OS",
      subItems: [
        { label: "Kanban", path: "/os" },
        { label: "Garantias", path: "/os/garantias" },
      ],
    },
    {
      label: "Financeiro",
      path: "/financeiro",
      iconKey: "Financeiro",
      subItems: [
        { label: "Visao financeira", path: "/financeiro" },
        { label: "A receber", path: "/financeiro/receber" },
        { label: "A pagar", path: "/financeiro/pagar" },
        { label: "Inteligencia", path: "/financeiro/inteligencia" },
      ],
    },
    { label: "Configuracoes", path: "/configuracoes", iconKey: "Configuracoes" },
  ];
  const itensNavegacaoVisiveis =
    politicaSessao?.tipo === "central"
      ? navigationItemsTenantMigrado.filter((item) => politicaSessao.rotasPermitidas.includes(item.path))
      : navigationItems;

  const isPathActive = (path: string) => {
    if (path.includes("?")) {
      const [cleanPath] = path.split("?");
      if (!cleanPath) return false;
      return pathname.startsWith(cleanPath);
    }

    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const autoExpandedParents = itensNavegacaoVisiveis.reduce<Record<string, boolean>>((acc, item) => {
    if (!item.subItems?.length) return acc;

    const hasActiveSubItem = item.subItems.some((subItem) => isPathActive(subItem.path));
    const isParentRouteActive = item.path !== "/" && isPathActive(item.path);

    if (hasActiveSubItem || isParentRouteActive) {
      acc[item.path] = true;
    }

    return acc;
  }, {});

  const toggleParent = (parentPath: string) => {
    setToggledParents((previous) => ({
      ...previous,
      [parentPath]: !previous[parentPath],
    }));
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-800/50 bg-slate-950/40 backdrop-blur-xl transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Cabeçalho da Sidebar */}
      <div
        className={cn(
          "h-20 flex items-center border-b border-slate-800/50 bg-slate-950/35 transition-all duration-300 ease-in-out",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        <div
          className={cn(
            "flex items-center overflow-hidden transition-all duration-300 ease-in-out",
            isCollapsed ? "justify-center" : "gap-3"
          )}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className={cn(
                "rounded-md border border-slate-700/60 bg-slate-900/70 object-contain transition-all duration-300 ease-in-out",
                isCollapsed ? "w-10 h-10" : "w-14 h-14"
              )}
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/70 text-slate-100 transition-all duration-300 ease-in-out",
                isCollapsed ? "w-10 h-10" : "w-14 h-14"
              )}
            >
              {isCollapsed ? (
                <Box className="h-5 w-5" />
              ) : (
                <span className="text-base font-bold">{companyName.charAt(0).toUpperCase()}</span>
              )}
            </div>
          )}

          {!isCollapsed && (
            <div className="text-xl font-bold text-white transition-all duration-300 ease-in-out">
              {companyName}
            </div>
          )}
        </div>

        <div className="self-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-9 w-9 shrink-0 text-slate-300 hover:bg-white/5 hover:text-white"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Menu de Navegação */}
      <nav className="flex-1 overflow-y-auto bg-slate-950/20 px-2 py-4">
        {itensNavegacaoVisiveis.map((item) => {
          const hasSubItems = Boolean(item.subItems?.length);
          const hasActiveSubItem = item.subItems?.some((subItem) => isPathActive(subItem.path)) ?? false;
          const isParentActive = isPathActive(item.path) || hasActiveSubItem;
          const isParentExpanded = toggledParents[item.path] ?? autoExpandedParents[item.path] ?? false;

          return (
            <div key={item.path} className="mb-2">
              {hasSubItems ? (
                <button
                  type="button"
                  onClick={() => toggleParent(item.path)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border-l-2 px-4 py-3 text-sm font-medium transition-colors duration-200",
                    isParentActive
                      ? "border-blue-500 bg-blue-500/10 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {isParentActive && (
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-8 animate-pulse bg-gradient-to-r from-blue-500/35 via-blue-400/15 to-transparent blur-[2px]" />
                  )}

                  <span className="relative z-10">{icones[item.iconKey]}</span>
                  {!isCollapsed && <span className="relative z-10 flex-1 text-left">{item.label}</span>}
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        "relative z-10 h-4 w-4 transition-transform duration-200",
                        isParentExpanded ? "rotate-180" : "rotate-0"
                      )}
                    />
                  )}
                </button>
              ) : (
                <Link
                  href={item.path}
                  className={cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-lg border-l-2 px-4 py-3 text-sm font-medium transition-colors duration-200",
                    isParentActive
                      ? "border-blue-500 bg-blue-500/10 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {isParentActive && (
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-8 animate-pulse bg-gradient-to-r from-blue-500/35 via-blue-400/15 to-transparent blur-[2px]" />
                  )}

                  <span className="relative z-10">{icones[item.iconKey]}</span>
                  {!isCollapsed && <span className="relative z-10">{item.label}</span>}
                </Link>
              )}

              {hasSubItems && !isCollapsed && (
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isParentExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 mt-1 space-y-1 border-l border-slate-700/50 pl-3">
                      {item.subItems?.map((subItem) => {
                        const isSubItemActive = isPathActive(subItem.path);

                        return (
                          <Link
                            key={subItem.path}
                            href={subItem.path}
                            className={cn(
                              "block rounded-md py-2 pl-4 pr-3 text-sm transition-colors duration-200",
                              isSubItemActive
                                ? "bg-blue-500/10 text-blue-300"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            {subItem.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-slate-800/50 bg-slate-950/35 p-4">
        <p
          className={cn(
            "text-center text-xs text-slate-400",
            isCollapsed && "truncate"
          )}
        >
          {!isCollapsed ? `Powered by ${companyName}` : "v1.0"}
        </p>
      </div>
    </aside>
  );
}
