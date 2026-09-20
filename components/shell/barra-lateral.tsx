"use client";

import { useEffect, useMemo, useState } from "react";
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
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";
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
 * cliente na primeira renderização.
 *
 * O item ativo "entalha" na área de conteúdo (Fase 3-2A, Spec B — porte
 * fiel de `docs/design/referencia-menu-lateral.html`, a referência
 * aprovada): fica rente à borda direita da barra (por isso o `<nav>` só
 * tem padding à esquerda — cada item cuida da própria margem direita),
 * arredondado só à esquerda (`rounded-l-kx-cartao`/`rounded-r-none`), com
 * fundo `--kx-fundo` — a mesma cor do conteúdo, então os dois lêem como
 * uma superfície contínua sem gap nem linha — mais os dois cantos côncavos
 * de `.kx-notch-ativo` (app/globals.css, técnica idêntica à referência:
 * box-shadow, não gradiente). Por isso a barra também não tem `border-r`:
 * a separação de `--kx-painel` (barra) pra `--kx-fundo` (conteúdo) já é só
 * a diferença de cor, mesmo padrão do painel de marca em
 * `app/(auth)/layout.tsx` — uma borda aqui cruzaria bem no meio do item
 * ativo e quebraria a superfície contínua.
 */
export function BarraLateral() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissoes } = usePermissoes();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [falhaLogo, setFalhaLogo] = useState(false);
  const temAlgumaPermissao = useMemo(
    () => (lista: readonly Permissao[]) => lista.some((permissao) => permissoes.has(permissao)),
    [permissoes]
  );

  useEffect(() => {
    let ativo = true;
    obterDadosPerfilConfiguracao()
      .then((dados) => {
        if (ativo) setLogoUrl(dados.configuracao?.logoUrl || null);
      })
      .catch(() => {
        // Mantém o fallback (marca "K") — a barra não pode quebrar por causa do logo.
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-kx-barra-lateral hidden w-[72px] flex-col bg-kx-painel lg:flex xl:w-[248px]">
      <div className="flex h-16 shrink-0 items-center justify-center gap-2.5 px-2 xl:justify-start xl:px-5">
        {logoUrl && !falhaLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de logo enviada pelo tenant, fora do domínio otimizado pelo next/image.
          <img
            src={logoUrl}
            alt="Logo da empresa"
            className="h-9 w-9 shrink-0 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie object-contain p-1"
            onError={() => setFalhaLogo(true)}
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao bg-kx-primaria text-base font-extrabold text-primary-foreground">
            K
          </div>
        )}
        <span className="hidden flex-col xl:flex">
          <span className="text-base font-extrabold leading-tight tracking-tight text-kx-texto">Konext</span>
          <span className="text-[11px] leading-tight text-kx-legenda">Assistência técnica</span>
        </span>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto py-2 pl-3">
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
                "flex h-12 items-center justify-center gap-3 rounded-l-kx-cartao rounded-r-none px-0 text-sm font-medium transition-colors xl:justify-start xl:px-3",
                ativo
                  ? "kx-notch-ativo mr-0 bg-kx-fundo font-bold text-kx-texto"
                  : "mr-3 text-kx-texto-2 hover:bg-kx-superficie hover:text-kx-texto"
              )}
            >
              <Icone className={cn("h-5 w-5 shrink-0", ativo && "text-kx-destaque")} aria-hidden="true" />
              <span className="hidden truncate xl:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-kx-painel-borda p-2 xl:p-3">
        <StatusCaixa />
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
