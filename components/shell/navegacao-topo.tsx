"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
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

// Rótulo mais curto só pro topo (o modelo e a gaveta mobile mantêm o nome
// completo "Ordens de Serviço"). Mantém a barra enxuta, como no Bling.
const ROTULO_CURTO: Record<string, string> = { "Ordens de Serviço": "Ordens" };

/**
 * Navegação horizontal no topo, no estilo Bling (redesenho 11/2026): módulos
 * em TEXTO (sem ícone), com pílula de destaque (verde da marca) no item ativo
 * ou aberto, e os filhos num painel suspenso. Numa linha só, dentro do
 * cabeçalho escuro. Mesma fonte de itens/permissão da gaveta mobile.
 *
 * O painel é renderizado INLINE (absoluto, não em portal) e só quando aberto.
 * Como o cabeçalho não tem `overflow-hidden`, ele pinta sobre o conteúdo sem
 * ser cortado — e, inline, é testável sem simular portal (abrir = achar os
 * links no DOM). Abaixo de `lg` a barra some: ali navega a gaveta mobile.
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

  // Fecha o painel quando a rota muda (ajuste na renderização, nunca em efeito).
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
    <nav ref={navRef} aria-label="Navegação principal" className="hidden items-center gap-0.5 lg:flex">
      {itens.map(({ item, filhos }) => {
        const ativo = itemEstaAtivo(item, pathname, searchParams);
        const temDropdown = filhos.length > 1;
        const rotulo = ROTULO_CURTO[item.label] ?? item.label;

        if (!temDropdown) {
          const caminho = caminhoDoItem(item, filhos);
          return (
            <Link
              key={item.path}
              href={caminho}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex h-9 items-center rounded-kx-pilula px-3 text-sm transition-colors",
                ativo ? "bg-kx-sucesso font-semibold text-kx-fundo" : "font-medium text-kx-texto-2 hover:bg-kx-painel hover:text-kx-texto"
              )}
            >
              {rotulo}
            </Link>
          );
        }

        const estaAberto = aberto === item.path;
        const destacado = estaAberto || ativo;
        const indiceFilho = indiceFilhoAtivo(filhos, pathname, searchParams);
        const duasColunas = filhos.length > 6;

        return (
          <div key={item.path} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={estaAberto}
              onClick={() => setAberto((atual) => (atual === item.path ? null : item.path))}
              // Em barra de menu, com um painel já aberto, passar o mouse por
              // outro troca pra ele — comportamento esperado de menu horizontal.
              onPointerEnter={() => setAberto((atual) => (atual !== null ? item.path : atual))}
              className={cn(
                "flex h-9 items-center gap-1 rounded-kx-pilula px-3 text-sm transition-colors",
                destacado ? "bg-kx-sucesso font-semibold text-kx-fundo" : "font-medium text-kx-texto-2 hover:bg-kx-painel hover:text-kx-texto"
              )}
            >
              {rotulo}
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", estaAberto && "rotate-180")} aria-hidden="true" />
            </button>

            {estaAberto && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-kx-dropdown rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-2 shadow-kx-painel">
                <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-kx-legenda">{item.label}</p>
                <ul className={cn("grid gap-0.5", duasColunas ? "min-w-[30rem] grid-cols-2" : "min-w-[14rem] grid-cols-1")}>
                  {filhos.map((filho, indice) => {
                    const filhoAtivo = indice === indiceFilho;
                    return (
                      <li key={filho.path}>
                        <Link
                          href={filho.path}
                          aria-current={filhoAtivo ? "page" : undefined}
                          onClick={() => setAberto(null)}
                          className={cn(
                            "block rounded-kx-botao px-3 py-2 text-sm transition-colors",
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
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
