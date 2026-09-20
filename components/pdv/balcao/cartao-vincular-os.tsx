"use client";

import { Wrench } from "lucide-react";
import { toast } from "sonner";

/**
 * "Vincular uma OS" (referência: docs/design/referencia-pdv-balcao.html) —
 * antes era um aviso inerte (sem onClick, sem foco de teclado); agora é um
 * botão real. Não existe hoje nenhuma busca de OS dentro do PDV — o único
 * jeito real de trazer uma OS pra cá é o botão "Enviar para o PDV" na
 * própria tela da OS (components/os/botao-gerar-pedido-venda.tsx), que seta
 * ?osId= na URL. Construir uma busca de OS nova aqui seria funcionalidade
 * nova além do escopo desta fase (restilo) — por isso o clique só orienta
 * pra esse fluxo já existente, em vez de abrir um seletor que não existe.
 */
export function CartaoVincularOS() {
  return (
    <button
      type="button"
      onClick={() =>
        toast.info("Para vincular uma OS, abra a OS e use \"Enviar para o PDV\" por lá.")
      }
      className="flex h-11 items-center gap-2.5 rounded-kx-botao border border-dashed border-kx-primaria bg-kx-primaria/10 px-3.5 text-left transition-colors hover:bg-kx-primaria/15"
    >
      <Wrench className="h-[18px] w-[18px] shrink-0 text-kx-destaque" aria-hidden="true" />
      <span className="flex-1 text-[13px] font-bold text-kx-texto">Vincular uma OS</span>
      <span className="text-xs text-kx-legenda">F4</span>
    </button>
  );
}
