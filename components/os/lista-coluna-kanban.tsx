"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DroppableProvided, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { OrdemServico } from "@/types/os";

const LOTE = 20;

type ListaColunaKanbanProps = {
  ordens: OrdemServico[];
  dropProvided: DroppableProvided;
  dropSnapshot: DroppableStateSnapshot;
  renderizarCartao: (os: OrdemServico, indice: number) => ReactNode;
  vazio: ReactNode;
};

/**
 * Área rolável da coluna. Monta os cards em lotes: cada card montado é um Draggable
 * real, então o índice de drop continua correto — que é o problema clássico de
 * virtualização com esta biblioteca.
 */
export function ListaColunaKanban({
  ordens,
  dropProvided,
  dropSnapshot,
  renderizarCartao,
  vazio,
}: ListaColunaKanbanProps) {
  const [montados, setMontados] = useState(LOTE);
  const sentinelaRef = useRef<HTMLDivElement>(null);

  // Assinatura dos dados da coluna: muda com filtro, busca ou card que entra/sai.
  const assinatura = useMemo(
    () => `${ordens.length}|${ordens.map((os) => os.id).join(",")}`,
    [ordens]
  );

  // Janela obsoleta nunca é exibida: ao mudar os dados, volta ao primeiro lote.
  useEffect(() => {
    setMontados(LOTE);
  }, [assinatura]);

  const total = ordens.length;
  const visiveis = ordens.slice(0, montados);
  const faltam = total - visiveis.length;

  useEffect(() => {
    if (faltam <= 0) return;

    const alvo = sentinelaRef.current;
    if (!alvo) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setMontados((atual) => Math.min(atual + LOTE, total));
        }
      },
      { root: alvo.closest("[data-rolagem-coluna]"), rootMargin: "200px" }
    );

    observador.observe(alvo);
    return () => observador.disconnect();
  }, [faltam, total]);

  return (
    <div
      data-rolagem-coluna
      className="rolagem-coluna flex-1 overflow-y-auto overscroll-contain"
    >
      <div
        ref={dropProvided.innerRef}
        {...dropProvided.droppableProps}
        className={`min-h-[220px] space-y-3 p-4 transition-colors ${
          dropSnapshot.isDraggingOver ? "bg-primary/5" : ""
        }`}
      >
        {total === 0 ? vazio : visiveis.map((os, indice) => renderizarCartao(os, indice))}
        {dropProvided.placeholder}

        {faltam > 0 ? (
          <div ref={sentinelaRef} className="py-2 text-center text-xs text-muted-foreground">
            Carregando mais {Math.min(LOTE, faltam)} de {faltam}…
          </div>
        ) : null}
      </div>
    </div>
  );
}
