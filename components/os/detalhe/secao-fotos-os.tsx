import { ImageOff } from "lucide-react";

/**
 * Fotos do aparelho — SÓ UI nesta fase (Fase 3-2B, Parte 3). Não existe modelo de
 * anexos/upload no schema hoje; construir isso (armazenamento, migração, permissão)
 * fica pra uma fase futura. Os botões abaixo ficam desabilitados de propósito.
 */
export function SecaoFotosOS() {
  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-bold text-kx-texto">Fotos do aparelho</span>
        <span className="rounded-kx-pilula bg-kx-cartao px-2 py-0.5 text-[11px] font-bold tabular-nums text-kx-texto-2">
          0
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled
            title="Chega numa fase futura"
            className="h-[34px] cursor-not-allowed rounded-kx-botao border border-kx-campo-borda px-3 text-xs font-semibold text-kx-legenda opacity-60"
          >
            Enviar pelo celular
          </button>
          <button
            type="button"
            disabled
            title="Chega numa fase futura"
            className="h-[34px] cursor-not-allowed rounded-kx-botao border border-kx-campo-borda px-3 text-xs font-semibold text-kx-legenda opacity-60"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 rounded-kx-cartao border border-dashed border-kx-painel-borda py-10 text-center">
        <ImageOff className="h-6 w-6 text-kx-legenda" aria-hidden="true" />
        <p className="text-xs text-kx-legenda">
          Fotos do aparelho chegam numa fase futura — por enquanto, use o checklist de entrada.
        </p>
      </div>
    </div>
  );
}
