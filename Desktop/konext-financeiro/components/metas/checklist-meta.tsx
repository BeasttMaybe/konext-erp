"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adicionarItemChecklistMeta,
  alternarItemChecklistMeta,
  removerItemChecklistMeta,
} from "@/app/actions/metas";

type Item = {
  id: string;
  titulo: string;
  concluido: boolean;
  ordem: number;
  concluidoEm: string | null;
};

type ChecklistMetaProps = {
  metaId: string;
  itens: Item[];
  somenteLeitura?: boolean;
  aoAtualizar?: () => void;
};

export function ChecklistMeta({ metaId, itens, somenteLeitura = false, aoAtualizar }: ChecklistMetaProps) {
  const [novoItem, setNovoItem] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);

  const handleAdicionar = async () => {
    const titulo = novoItem.trim();
    if (titulo.length < 2) {
      toast.error("Título deve ter pelo menos 2 caracteres.");
      return;
    }

    setAdicionando(true);
    try {
      const res = await adicionarItemChecklistMeta({ metaId, titulo });
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }
      toast.success(res.mensagem);
      setNovoItem("");
      aoAtualizar?.();
    } catch {
      toast.error("Não foi possível adicionar o item.");
    } finally {
      setAdicionando(false);
    }
  };

  const handleAlternar = async (itemId: string) => {
    setProcessando(itemId);
    try {
      const res = await alternarItemChecklistMeta(itemId);
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }
      aoAtualizar?.();
    } catch {
      toast.error("Não foi possível atualizar o item.");
    } finally {
      setProcessando(null);
    }
  };

  const handleRemover = async (itemId: string) => {
    setProcessando(itemId);
    try {
      const res = await removerItemChecklistMeta(itemId);
      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }
      toast.success(res.mensagem);
      aoAtualizar?.();
    } catch {
      toast.error("Não foi possível remover o item.");
    } finally {
      setProcessando(null);
    }
  };

  const concluidos = itens.filter((i) => i.concluido).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Checklist
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {concluidos}/{itens.length} concluídos
        </span>
      </div>

      <div className="space-y-2">
        {itens.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
            Nenhum item no checklist.
          </p>
        )}
        {itens.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2 rounded-md bg-slate-50 dark:bg-slate-800/50 group"
          >
            <button
              onClick={() => !somenteLeitura && handleAlternar(item.id)}
              disabled={processando === item.id || somenteLeitura}
              className="shrink-0 text-slate-400 hover:text-emerald-500 transition-colors disabled:opacity-50"
              aria-label={item.concluido ? "Desmarcar item" : "Marcar como concluído"}
            >
              {item.concluido ? (
                <CheckSquare className="h-4 w-4 text-emerald-500" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>

            <span
              className={`flex-1 text-sm ${
                item.concluido
                  ? "line-through text-slate-400 dark:text-slate-500"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {item.titulo}
            </span>

            {!somenteLeitura && (
              <button
                onClick={() => handleRemover(item.id)}
                disabled={processando === item.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 disabled:opacity-30"
                aria-label="Remover item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!somenteLeitura && (
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Novo item do checklist..."
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdicionar()}
            maxLength={160}
            disabled={adicionando}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdicionar}
            disabled={adicionando || novoItem.trim().length < 2}
            className="h-8 shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
