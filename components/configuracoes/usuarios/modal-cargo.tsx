"use client";

import { useState } from "react";
import { toast } from "sonner";
import { criarCargo, duplicarCargo, type CargoListado } from "@/app/actions/cargos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PropsModalCargo = {
  modo: "criar" | "duplicar";
  cargoOrigem?: CargoListado;
  cargosExistentes: CargoListado[];
  aberto: boolean;
  onFechar: () => void;
  onCriado: (cargoId: string) => void;
};

export function ModalCargo({ modo, cargoOrigem, aberto, onFechar, onCriado }: PropsModalCargo) {
  const [nome, setNome] = useState(modo === "duplicar" && cargoOrigem ? `${cargoOrigem.nome} (cópia)` : "");
  const [salvando, setSalvando] = useState(false);

  const aoConfirmar = async () => {
    setSalvando(true);
    try {
      const resultado =
        modo === "duplicar" && cargoOrigem
          ? await duplicarCargo({ cargoId: cargoOrigem.id, novoNome: nome })
          : await criarCargo({ nome, descricao: undefined, permissoes: [] });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(modo === "duplicar" ? "Cargo duplicado. Ajuste as permissões a seguir." : "Cargo criado. Defina as permissões a seguir.");
      onCriado(resultado.cargoId);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modo === "duplicar" ? `Duplicar "${cargoOrigem?.nome}"` : "Criar cargo"}</DialogTitle>
          <DialogDescription>
            {modo === "duplicar"
              ? "Cria um novo cargo com as mesmas permissões, que você pode ajustar depois."
              : "O cargo começa sem nenhuma permissão — você define tudo na tela seguinte."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="nome-cargo">Nome do cargo</Label>
          <Input id="nome-cargo" value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Ex.: Técnico Sênior" />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void aoConfirmar()} disabled={salvando || nome.trim().length < 2}>
            {salvando ? "Salvando..." : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
