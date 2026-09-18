"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  caminhoDoItem,
  filhosVisiveis,
  ITENS_NAVEGACAO,
  indiceFilhoAtivo,
  itemEstaAtivo,
} from "@/lib/navegacao/itens-navegacao";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/contextos/contexto-permissoes";
import type { Permissao } from "@/lib/auth/permissoes";

const CLASSE_GATILHO =
  "relative flex h-14 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function Seta() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2 w-2">
      <path
        d="M2 4l3 3 3-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SublinhadoAtivo() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-2.5 bottom-0 h-0.5"
      style={{ backgroundColor: "var(--receita)" }}
    />
  );
}

export function NavPrincipal() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navRef = useRef<HTMLElement>(null);
  const chaveRota = `${pathname}?${searchParams.toString()}`;
  const { permissoes } = usePermissoes();
  const temAlgumaPermissao = (permissoesRequeridas: readonly Permissao[]) =>
    permissoesRequeridas.some((permissao) => permissoes.has(permissao));

  // O submenu abre por :hover e :focus-within, sem JS. Escape e troca de rota
  // apenas soltam o foco — é o que fecha o menu aberto pelo teclado.
  useEffect(() => {
    const ativo = document.activeElement;

    if (ativo instanceof HTMLElement && navRef.current?.contains(ativo)) {
      ativo.blur();
    }
  }, [chaveRota]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;

      const ativo = document.activeElement;
      if (!(ativo instanceof HTMLElement) || !navRef.current?.contains(ativo)) return;

      // Devolve o foco ao gatilho do item antes de fechar.
      const item = ativo.closest("[data-item-nav]");
      const gatilho = item?.querySelector<HTMLElement>("[data-gatilho-nav]");

      if (gatilho && gatilho !== ativo) {
        gatilho.focus();
        return;
      }

      ativo.blur();
    };

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Navegação principal"
      className="hidden min-w-0 items-center gap-0.5 lg:flex"
    >
      {ITENS_NAVEGACAO.map((item) => {
        const filhos = filhosVisiveis(item, temAlgumaPermissao);

        if (item.filhos?.length && filhos.length === 0) {
          return null;
        }

        const ativo = itemEstaAtivo(item, pathname, searchParams);
        const temFilhos = Boolean(filhos.length);
        const indiceAtivo = indiceFilhoAtivo(filhos, pathname, searchParams);
        const caminho = caminhoDoItem(item, filhos);

        return (
          <div key={item.path} data-item-nav className="group relative">
            <Link
              href={caminho}
              data-gatilho-nav
              aria-current={ativo ? "page" : undefined}
              aria-haspopup={temFilhos ? "true" : undefined}
              className={cn(
                CLASSE_GATILHO,
                ativo
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {item.label}
              {temFilhos ? <Seta /> : null}
              {ativo ? <SublinhadoAtivo /> : null}
            </Link>

            {temFilhos ? (
              <div
                className={cn(
                  "invisible absolute left-0 top-full z-20 min-w-[212px] -translate-y-1 rounded-[9px] border border-border bg-popover p-1.5 opacity-0 shadow-lg",
                  "transition-[opacity,transform,visibility] duration-150",
                  "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
                  "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
                  "motion-reduce:transition-none"
                )}
              >
                {filhos.map((filho, indice) => (
                  <Link
                    key={filho.path}
                    href={filho.path}
                    aria-current={indice === indiceAtivo ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-[13px] outline-none",
                      "hover:bg-muted focus-visible:bg-muted",
                      indice === indiceAtivo
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filho.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
