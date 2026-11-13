"use client";

import { useState } from "react";
import type { LinhaHistoricoOS } from "@/app/actions/os";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Cor do ponto por ação — mesma lógica de "o que aconteceu" das pílulas do módulo (Fase 3-2B, Parte 3). */
const COR_PONTO_POR_ACAO: Partial<Record<string, string>> = {
  CRIAR: "bg-kx-conserto",
  ATUALIZAR_STATUS: "bg-kx-orcamento",
  FINALIZAR: "bg-kx-entregue",
  EXCLUIR_LOGICO: "bg-kx-erro",
  VISUALIZAR_SENHA: "bg-kx-alerta",
};

function formatarQuando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type PropsHistoricoOS = {
  linhas: LinhaHistoricoOS[];
};

/**
 * Histórico compacto (referência: docs/design/referencia-os-detalhe.html) — lê de
 * LogAuditoria (ver obterHistoricoOS em app/actions/os.ts), só os eventos gravados
 * direto contra a OS (criação, troca de etapa, finalização, exclusão, visualização
 * de senha). "Ver tudo" abre a mesma lista, sem paginação nova nesta fase.
 */
export function HistoricoOS({ linhas }: PropsHistoricoOS) {
  const [tudoAberto, setTudoAberto] = useState(false);
  const compactas = linhas.slice(0, 4);

  if (linhas.length === 0) return null;

  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex items-center gap-3.5 overflow-hidden">
      <span className="shrink-0 text-sm font-bold text-kx-texto">Histórico</span>
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        {/* No celular cabe um evento: o mais recente. Os outros ficam em "Ver tudo". */}
        {compactas.map((linha, indice) => (
          <span
            key={linha.id}
            className={`${indice === 0 ? "flex min-w-0" : "hidden shrink-0 sm:flex"} items-center gap-1.5 rounded-kx-pilula bg-kx-cartao px-2.5 py-1 text-xs whitespace-nowrap`}
          >
            <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${COR_PONTO_POR_ACAO[linha.acao] ?? "bg-kx-legenda"}`} />
            <span className="truncate font-bold text-kx-texto">{linha.rotulo}</span>
            <span className="tabular-nums text-kx-legenda">{formatarQuando(linha.quando)}</span>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTudoAberto(true)}
        className="shrink-0 text-xs font-bold text-kx-link hover:text-kx-destaque"
      >
        Ver tudo
      </button>

      <Dialog open={tudoAberto} onOpenChange={setTudoAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico da OS</DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {linhas.map((linha) => (
              <li key={linha.id} className="flex items-center gap-2.5 rounded-kx-cartao border border-kx-painel-borda px-3 py-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${COR_PONTO_POR_ACAO[linha.acao] ?? "bg-kx-legenda"}`} />
                <span className="font-semibold text-kx-texto">{linha.rotulo}</span>
                {linha.autor && <span className="text-kx-legenda">por {linha.autor}</span>}
                <span className="ml-auto shrink-0 tabular-nums text-kx-legenda">{formatarQuando(linha.quando)}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
