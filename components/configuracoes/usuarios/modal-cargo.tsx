"use client";

import { useState } from "react";
import { toast } from "sonner";
import { criarCargo, duplicarCargo, renomearCargo, type CargoListado } from "@/app/actions/cargos";
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
  modo: "criar" | "duplicar" | "renomear";
  cargoOrigem?: CargoListado;
  cargosExistentes: CargoListado[];
  aberto: boolean;
  onFechar: () => void;
  /** "criar"/"duplicar" navegam pra edição de permissões do cargo novo. */
  onCriado: (cargoId: string) => void;
  /** "renomear" só fecha e recarrega a lista — não é um cargo novo. */
  onRenomeado?: () => void;
};

export function ModalCargo({ modo, cargoOrigem, aberto, onFechar, onCriado, onRenomeado }: PropsModalCargo) {
  const [nome, setNome] = useState(() => {
    if (modo === "duplicar" && cargoOrigem) return `${cargoOrigem.nome} (cópia)`;
    if (modo === "renomear" && cargoOrigem) return cargoOrigem.nome;
    return "";
  });
  const [salvando, setSalvando] = useState(false);

  const aoConfirmar = async () => {
    setSalvando(true);
    try {
      if (modo === "renomear" && cargoOrigem) {
        const resultado = await renomearCargo({ cargoId: cargoOrigem.id, nome });
        if (!resultado.sucesso) {
          toast.error(resultado.erro);
          return;
        }
        toast.success("Cargo renomeado.");
        onRenomeado?.();
        return;
      }

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

  const titulo = modo === "duplicar" ? `Duplicar "${cargoOrigem?.nome}"` : modo === "renomear" ? `Renomear "${cargoOrigem?.nome}"` : "Criar cargo";
  const descricao =
    modo === "duplicar"
      ? "Cria um novo cargo com as mesmas permissões, que você pode ajustar depois."
      : modo === "renomear"
        ? "Escolha um novo nome para o cargo. Precisa ser único na empresa."
        : "O cargo começa sem nenhuma permissão — você define tudo na tela seguinte.";

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="nome-cargo" className="text-xs font-bold text-kx-texto">
            Nome do cargo
          </Label>
          <Input
            id="nome-cargo"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Técnico Sênior"
            className="h-11 border-kx-campo-borda bg-kx-superficie"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className="rounded-kx-botao" onClick={() => void aoConfirmar()} disabled={salvando || nome.trim().length < 2}>
            {salvando ? "Salvando..." : modo === "renomear" ? "Renomear" : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
