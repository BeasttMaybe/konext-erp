"use client";

import { useState } from"react";
import { toast } from"sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from"@/components/ui/dialog";
import { Label } from"@/components/ui/label";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Button } from"@/components/ui/button";
import { atualizarProgressoMeta } from"@/app/actions/metas";
import type { TipoValorMeta, OrigemProgressoMeta } from"@prisma/client";

type ModalAtualizarProgressoProps = {
  aberto: boolean;
  metaId: string;
  titulo: string;
  valorAtual: number;
  valorAlvo: number | null;
  tipoValor: TipoValorMeta;
  unidade: string | null;
  origemProgresso?: OrigemProgressoMeta;
  aoFechar: () => void;
  aoConcluir: () => void;
};

export function ModalAtualizarProgresso({
  aberto,
  metaId,
  titulo,
  valorAtual,
  valorAlvo,
  tipoValor,
  unidade,
  origemProgresso,
  aoFechar,
  aoConcluir,
}: ModalAtualizarProgressoProps) {
  const [valorNovo, setValorNovo] = useState(String(valorAtual));
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fechar = () => {
    if (salvando) return;
    setValorNovo(String(valorAtual));
    setObservacao("");
    aoFechar();
  };

  const salvar = async () => {
    if (origemProgresso ==="AUTOMATICA") {
      toast.error("Metas automáticas devem ser atualizadas via sincronização.");
      return;
    }

    const numero = Number(valorNovo);
    if (!isFinite(numero) || numero < 0) {
      toast.error("Informe um valor válido e não negativo.");
      return;
    }

    setSalvando(true);
    try {
      const res = await atualizarProgressoMeta({
        id: metaId,
        valorNovo: numero,
        observacao,
      });

      if (!res.sucesso) {
        toast.error(res.erro);
        return;
      }

      toast.success(res.mensagem);
      setObservacao("");
      aoConcluir();
    } catch {
      toast.error("Não foi possível atualizar o progresso.");
    } finally {
      setSalvando(false);
    }
  };

  const sufixo = tipoValor ==="PERCENTUAL" ?"%" : (unidade ??"");

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar progresso</DialogTitle>
          <DialogDescription>{titulo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="novo-valor">
              Novo valor atual {sufixo ? `(${sufixo})` :""}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="novo-valor"
                type="number"
                min={0}
                step={tipoValor ==="DINHEIRO" ?"0.01" :"1"}
                value={valorNovo}
                onChange={(e) => setValorNovo(e.target.value)}
                disabled={salvando}
                autoFocus
              />
              {valorAlvo && (
                <span className="text-sm text-kx-legenda whitespace-nowrap shrink-0">
                  / {valorAlvo}{sufixo}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-progresso">Observação (opcional)</Label>
            <Textarea
              id="obs-progresso"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Contexto ou anotação sobre esta atualização"
              maxLength={500}
              disabled={salvando}
              className="resize-none h-20"
            />
            <p className="text-xs text-kx-legenda">{observacao.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ?"Salvando..." :"Atualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
