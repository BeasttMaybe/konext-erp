"use client";

/**
 * Categorias vem de verdade do schema (Produto.categoria, CategoriaProduto) —
 * não são visuais-only como os chips de tipo de aparelho da Fase 3-2B. Rótulo
 * pt-BR duplicado de components/estoque/modal-novo-produto.tsx de propósito
 * (não exportado de lá hoje; um Record de 5 entradas não justifica acoplar
 * os dois módulos só para compartilhar rótulo).
 */
const ROTULO_CATEGORIA: Record<string, string> = {
  ACESSORIO: "Acessório",
  PECA_REPARO: "Peça de reparo",
  EQUIPAMENTO_REDE: "Equipamento de rede",
  SERVICO: "Serviço",
  OUTROS: "Outros",
};

interface PropsChipsCategoriaPdv {
  categorias: string[];
  categoriaAtiva: string | null;
  onEscolher: (categoria: string | null) => void;
}

export function ChipsCategoriaPdv({ categorias, categoriaAtiva, onEscolher }: PropsChipsCategoriaPdv) {
  if (categorias.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
      <button
        type="button"
        aria-pressed={categoriaAtiva === null}
        onClick={() => onEscolher(null)}
        className={
          categoriaAtiva === null
            ? "h-[34px] rounded-kx-pilula border border-kx-primaria bg-kx-primaria px-3.5 text-[13px] font-bold text-primary-foreground"
            : "h-[34px] rounded-kx-pilula border border-kx-campo-borda bg-transparent px-3.5 text-[13px] font-bold text-kx-texto-2 hover:bg-kx-superficie"
        }
      >
        Todas
      </button>
      {categorias.map((categoria) => {
        const ativo = categoriaAtiva === categoria;
        return (
          <button
            key={categoria}
            type="button"
            aria-pressed={ativo}
            onClick={() => onEscolher(ativo ? null : categoria)}
            className={
              ativo
                ? "h-[34px] rounded-kx-pilula border border-kx-primaria bg-kx-primaria px-3.5 text-[13px] font-bold text-primary-foreground"
                : "h-[34px] rounded-kx-pilula border border-kx-campo-borda bg-transparent px-3.5 text-[13px] font-bold text-kx-texto-2 hover:bg-kx-superficie"
            }
          >
            {ROTULO_CATEGORIA[categoria] ?? categoria}
          </button>
        );
      })}
    </div>
  );
}
