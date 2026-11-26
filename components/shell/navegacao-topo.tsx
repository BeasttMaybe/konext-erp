"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  DollarSign,
  Flag,
  Hammer,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MoreHorizontal,
  Package,
  ShoppingCart,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/contextos/contexto-permissoes";
import type { Permissao } from "@/lib/auth/permissoes";
import {
  caminhoDoItem,
  filhosVisiveis,
  indiceFilhoAtivo,
  itemEstaAtivo,
  itensDaNavegacao,
} from "@/lib/navegacao/itens-navegacao";

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
  Mais: MoreHorizontal,
};

/**
 * Navegação horizontal no topo (redesenho 11/2026) — substitui a barra
 * lateral. Cada módulo é um link direto (sem filhos) ou um botão que abre um
 * dropdown com os filhos (Contas a Receber, Propostas, etc.). Mesma fonte de
 * itens e de permissão da gaveta mobile (`itensDaNavegacao`/`filhosVisiveis`),
 * pra os dois nunca divergirem.
 *
 * O dropdown é renderizado INLINE (posicionado absoluto, não em portal) e só
 * quando aberto. Como o cabeçalho que o contém não tem `overflow-hidden`, ele
 * pinta por cima do conteúdo sem ser cortado — e, por ser inline, o menu é
 * testável sem simular portal (abrir = achar os links no DOM).
 *
 * A barra pode quebrar em duas linhas em telas estreitas (flex-wrap), em vez
 * de rolar na horizontal: rolagem lateral esconde módulo e cortaria o
 * dropdown. Abaixo de `lg` ela some — quem navega ali é a gaveta mobile.
 */
export function NavegacaoTopo() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { permissoes, modulos } = usePermissoes();
  const [aberto, setAberto] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const temAlgumaPermissao = useMemo(
    () => (lista: readonly Permissao[]) => lista.some((permissao) => permissoes.has(permissao)),
    [permissoes]
  );

  // Fecha o dropdown quando a rota muda (ajuste durante a renderização, nunca
  // em efeito — mesmo padrão da gaveta mobile).
  const [rotaAnterior, setRotaAnterior] = useState(pathname);
  if (pathname !== rotaAnterior) {
    setRotaAnterior(pathname);
    if (aberto !== null) setAberto(null);
  }

  // Fecha ao clicar fora ou apertar Esc — só enquanto algo está aberto.
  useEffect(() => {
    if (aberto === null) return;
    const aoClicarFora = (evento: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(evento.target as Node)) setAberto(null);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(null);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const itens = itensDaNavegacao(modulos)
    .map((item) => ({ item, filhos: filhosVisiveis(item, temAlgumaPermissao) }))
    .filter(({ item, filhos }) => !(item.filhos?.length && filhos.length === 0));

  return (
    <nav
      ref={navRef}
      aria-label="Navegação principal"
      className="hidden items-center gap-0.5 border-t border-kx-painel-borda px-2 lg:flex lg:flex-wrap"
    >
      {itens.map(({ item, filhos }) => {
        const ativo = itemEstaAtivo(item, pathname, searchParams);
        const Icone = ICONES[item.iconKey] ?? LayoutDashboard;
        const temDropdown = filhos.length > 1;

        const classeBase = cn(
          "flex h-10 items-center gap-2 rounded-kx-botao px-2.5 text-sm font-medium transition-colors",
          "border-b-2 border-transparent -mb-px",
          ativo
            ? "border-kx-primaria font-semibold text-kx-texto"
            : "text-kx-texto-2 hover:bg-kx-superficie hover:text-kx-texto"
        );

        if (!temDropdown) {
          const caminho = caminhoDoItem(item, filhos);
          return (
            <Link
              key={item.path}
              href={caminho}
              aria-current={ativo ? "page" : undefined}
              className={classeBase}
            >
              <Icone className={cn("h-4 w-4 shrink-0", ativo && "text-kx-destaque")} aria-hidden="true" />
              {item.label}
            </Link>
          );
        }

        const estaAberto = aberto === item.path;
        const indiceFilho = indiceFilhoAtivo(filhos, pathname, searchParams);

        return (
          <div key={item.path} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={estaAberto}
              onClick={() => setAberto((atual) => (atual === item.path ? null : item.path))}
              // Em barra de menu, com um dropdown já aberto, passar o mouse por
              // outro troca pra ele — comportamento esperado de menu horizontal.
              onPointerEnter={() => setAberto((atual) => (atual !== null ? item.path : atual))}
              className={classeBase}
            >
              <Icone className={cn("h-4 w-4 shrink-0", ativo && "text-kx-destaque")} aria-hidden="true" />
              {item.label}
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 text-kx-legenda transition-transform", estaAberto && "rotate-180")}
                aria-hidden="true"
              />
            </button>

            {estaAberto && (
              <ul className="absolute left-0 top-[calc(100%+4px)] z-kx-dropdown min-w-[13rem] overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-painel py-1 shadow-kx-painel">
                {filhos.map((filho, indice) => {
                  const filhoAtivo = indice === indiceFilho;
                  return (
                    <li key={filho.path}>
                      <Link
                        href={filho.path}
                        aria-current={filhoAtivo ? "page" : undefined}
                        onClick={() => setAberto(null)}
                        className={cn(
                          "block px-3 py-2 text-[13px] transition-colors",
                          filhoAtivo
                            ? "bg-kx-superficie font-semibold text-kx-texto"
                            : "text-kx-texto-2 hover:bg-kx-superficie hover:text-kx-texto"
                        )}
                      >
                        {filho.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
