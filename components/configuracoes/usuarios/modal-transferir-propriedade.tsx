"use client";

import { useState } from "react";
import { toast } from "sonner";
import { transferirPropriedade, type UsuarioListado } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PropsModalTransferirPropriedade = {
  usuarios: UsuarioListado[];
  proprietarioAtualId: string;
  aberto: boolean;
  onFechar: () => void;
  onTransferido: () => void;
};

export function ModalTransferirPropriedade({
  usuarios,
  proprietarioAtualId,
  aberto,
  onFechar,
  onTransferido,
}: PropsModalTransferirPropriedade) {
  const [novoResponsavelId, setNovoResponsavelId] = useState("");
  const [transferindo, setTransferindo] = useState(false);

  const candidatos = usuarios.filter(
    (usuario) => usuario.usuarioEmpresaId !== proprietarioAtualId && usuario.ativo && usuario.possuiConfiguracoesUsuarios
  );

  const aoConfirmar = async () => {
    if (!novoResponsavelId) return;
    setTransferindo(true);
    try {
      const resultado = await transferirPropriedade({ novoUsuarioEmpresaId: novoResponsavelId });
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Titularidade transferida.");
      onTransferido();
    } finally {
      setTransferindo(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir titularidade</DialogTitle>
          <DialogDescription>
            Depois de transferir, você perde as proteções de responsável pela loja: passa a poder ser desativado e
            ter o cargo alterado por outro administrador, como qualquer outro usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="novo-responsavel">Novo responsável</Label>
          {candidatos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum outro usuário ativo tem acesso a Usuários e Cargos hoje — conceda essa permissão a alguém antes
              de transferir.
            </p>
          ) : (
            <Select value={novoResponsavelId} onValueChange={setNovoResponsavelId}>
              <SelectTrigger id="novo-responsavel">
                <SelectValue placeholder="Selecione quem vai assumir" />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map((usuario) => (
                  <SelectItem key={usuario.usuarioEmpresaId} value={usuario.usuarioEmpresaId}>
                    {usuario.nome} ({usuario.cargoNome})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void aoConfirmar()}
            disabled={transferindo || !novoResponsavelId}
          >
            {transferindo ? "Transferindo..." : "Transferir titularidade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
