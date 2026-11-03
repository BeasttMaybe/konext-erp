"use client";

/**
 * Categorias vêm do cadastro (`CategoriaProduto`), já com o nome que o dono
 * escreveu — então não há mais rótulo a traduzir aqui. Havia um `Record` de
 * cinco entradas mapeando ACESSORIO → "Acessório", duplicado do modal de
 * produto; com as categorias cadastráveis, qualquer mapa fixo ficaria errado na
 * primeira categoria nova.
 */

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
            {categoria}
          </button>
        );
      })}
    </div>
  );
}
