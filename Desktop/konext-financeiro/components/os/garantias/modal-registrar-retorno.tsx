"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { registrarRetornoGarantiaOS } from "@/app/actions/garantias";

type ModalRegistrarRetornoProps = {
  aberto: boolean;
  termoGarantiaId: string | null;
  aoFechar: () => void;
  aoConcluir: () => void;
};

export function ModalRegistrarRetorno({ aberto, termoGarantiaId, aoFechar, aoConcluir }: ModalRegistrarRetornoProps) {
  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [analiseTecnica, setAnaliseTecnica] = useState("");
  const [salvando, setSalvando] = useState(false);

  const limpar = () => {
    setMotivo("");
    setDescricao("");
    setAnaliseTecnica("");
  };

  const fechar = () => {
    if (salvando) return;
    limpar();
    aoFechar();
  };

  const salvar = async () => {
    if (!termoGarantiaId) {
      toast.error("Garantia inválida.");
      return;
    }

    setSalvando(true);
    try {
      const resposta = await registrarRetornoGarantiaOS({
        termoGarantiaId,
        motivo,
        descricao,
        analiseTecnica,
        resultado: "EM_ANALISE",
      });

      if (!resposta.sucesso) {
        toast.error(resposta.erro);
        return;
      }

      toast.success(resposta.mensagem);
      limpar();
      aoConcluir();
    } catch {
      toast.error("Não foi possível registrar o retorno. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(novoEstado) => { if (!novoEstado) fechar(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar retorno de garantia</DialogTitle>
          <DialogDescription>
            Preencha os dados do retorno para manter o histórico técnico e o indicador de garantia atualizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo-retorno">Motivo do retorno</Label>
            <Textarea
              id="motivo-retorno"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ex: mesmo defeito, aparelho reiniciando, tela piscando"
              maxLength={200}
            />
            <p className="text-xs text-slate-500">{motivo.length}/200 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao-retorno">Descrição do retorno</Label>
            <Textarea
              id="descricao-retorno"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Descreva os sintomas, contexto e o que foi reportado pelo cliente"
              maxLength={1000}
            />
            <p className="text-xs text-slate-500">{descricao.length}/1000 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analise-retorno">Análise técnica</Label>
            <Textarea
              id="analise-retorno"
              value={analiseTecnica}
              onChange={(evento) => setAnaliseTecnica(evento.target.value)}
              placeholder="Campo opcional para conclusão técnica interna"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>Salvar retorno</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
