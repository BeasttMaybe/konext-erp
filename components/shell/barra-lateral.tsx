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

/** Altura de cada item (h-12 = 48px) + o gap entre eles (space-y-1 = 4px) — a distância que o indicador percorre por posição. */
const ALTURA_ITEM_COM_GAP = 52;

/**
 * Barra lateral fixa (Fase 3-1, Parte 3) — 1024–1279px vira trilho de só
 * ícones, 1280px+ mostra rótulo, abaixo de 1024px some inteira (dá lugar à
 * `GavetaLateralMobile`). Tudo por classe responsiva do Tailwind — sem
 * detectar breakpoint em JS, pra não arriscar descompasso entre servidor e
 * cliente na primeira renderização.
 *
 * O item ativo "entalha" na área de conteúdo (Fase 3-2A, Spec B — porte
 * fiel de `docs/design/referencia-menu-lateral.html`, a referência
 * aprovada) via um indicador ÚNICO, absolutamente posicionado, que desliza
 * (`transform: translateY`) até a linha do item ativo em vez de cada item
 * pintar o próprio fundo — navegação troca de página re-renderiza a barra
 * inteira, então uma transição no item em si nunca animaria (ele já nasce
 * no lugar final); só um elemento que PERSISTE entre renders pode animar
 * posição. Fica rente à borda direita (por isso o `<nav>` só tem padding à
 * esquerda), arredondado só à esquerda, com fundo `--kx-fundo` — a mesma
 * cor do conteúdo — mais os dois cantos côncavos de `.kx-notch-ativo`
 * (app/globals.css, técnica idêntica à referência: box-shadow, não
 * gradiente). O `pt-kx-5`/`pb-kx-5` do `<nav>` (20px, não os 8px de antes)
 * são de propósito: é exatamente o alcance do notch (20px pra cima/baixo),
 * pra ele nunca ser cortado pelo `overflow-y-auto` quando o item ativo é o
 * primeiro ou o último da lista. A barra não tem `border-r`: a separação
 * de `--kx-painel` (barra) pra `--kx-fundo` (conteúdo) já é só a diferença
 * de cor, mesmo padrão do painel de marca em `app/(auth)/layout.tsx`.
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

  // Só os itens de fato renderizados (filtro de permissão já aplicado) —
  // o índice do ativo tem que vir DAQUI, nunca do array bruto, senão um
  // item escondido por permissão desalinha o indicador de uma posição.
  const itensRenderizados = ITENS_NAVEGACAO.map((item) => ({
    item,
    filhos: filhosVisiveis(item, temAlgumaPermissao),
  })).filter(({ item, filhos }) => !(item.filhos?.length && filhos.length === 0));

  const indiceAtivo = itensRenderizados.findIndex(({ item }) => itemEstaAtivo(item, pathname, searchParams));

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

      <nav aria-label="Navegação principal" className="relative flex-1 overflow-y-auto pb-kx-5 pl-3 pt-kx-5">
        {indiceAtivo >= 0 && (
          <div
            aria-hidden="true"
            style={{ transform: `translateY(${indiceAtivo * ALTURA_ITEM_COM_GAP}px)` }}
            className="kx-notch-ativo pointer-events-none absolute inset-x-0 top-0 h-12 rounded-l-kx-cartao rounded-r-none bg-kx-fundo motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-in-out"
          />
        )}

        <div className="space-y-1">
          {itensRenderizados.map(({ item, filhos }, indice) => {
            const ativo = indice === indiceAtivo;
            const caminho = caminhoDoItem(item, filhos);
            const Icone = ICONES[item.iconKey] ?? LayoutDashboard;

            return (
              <Link
                key={item.path}
                href={caminho}
                aria-current={ativo ? "page" : undefined}
                title={item.label}
                className={cn(
                  "kx-item-nav relative flex h-12 items-center justify-center gap-3 rounded-kx-botao px-0 text-sm font-medium xl:justify-start xl:px-3",
                  ativo ? "font-bold text-kx-texto" : "text-kx-texto-2 hover:bg-kx-superficie/50 hover:text-kx-texto"
                )}
              >
                <Icone
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors duration-200 ease-in-out",
                    ativo && "text-kx-destaque"
                  )}
                  aria-hidden="true"
                />
                <span className="hidden truncate xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
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
