"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { atribuirCargoAoUsuario, listarCargos, type CargoListado } from "@/app/actions/cargos";
import { desativarUsuario, reativarUsuario, type UsuarioListado } from "@/app/actions/usuarios";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

type PropsModalEditarUsuario = {
  usuario: UsuarioListado;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
};

export function ModalEditarUsuario({ usuario, aberto, onFechar, onSalvo }: PropsModalEditarUsuario) {
  const [cargos, setCargos] = useState<CargoListado[] | null>(null);
  const [cargoSelecionado, setCargoSelecionado] = useState(usuario.cargoId ?? "");
  const [salvandoCargo, setSalvandoCargo] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  useEffect(() => {
    listarCargos().then((resultado) => {
      if (resultado.sucesso) {
        setCargos(resultado.dados.filter((cargo) => !cargo.arquivadoEm));
      } else {
        toast.error(resultado.erro);
      }
    });
  }, []);

  const aoSalvarCargo = async () => {
    if (!cargoSelecionado || cargoSelecionado === usuario.cargoId) {
      onFechar();
      return;
    }

    setSalvandoCargo(true);
    try {
      const resultado = await atribuirCargoAoUsuario({
        usuarioEmpresaId: usuario.usuarioEmpresaId,
        cargoId: cargoSelecionado,
      });
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Cargo atualizado. Vale a partir da próxima ação do usuário — sem precisar de novo login.");
      onSalvo();
    } finally {
      setSalvandoCargo(false);
    }
  };

  const aoAlterarStatus = async () => {
    setAlterandoStatus(true);
    try {
      const resultado = usuario.ativo
        ? await desativarUsuario({ usuarioEmpresaId: usuario.usuarioEmpresaId })
        : await reativarUsuario({ usuarioEmpresaId: usuario.usuarioEmpresaId });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(usuario.ativo ? "Usuário desativado." : "Usuário reativado.");
      onSalvo();
    } finally {
      setAlterandoStatus(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {usuario.nome}</DialogTitle>
          <DialogDescription>{usuario.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cargo-usuario" className="text-xs font-bold text-kx-texto">
              Cargo
            </Label>
            {usuario.souEu ? (
              <p className="text-xs text-kx-legenda">
                Você não pode alterar o seu próprio cargo — peça a outra pessoa com acesso a Usuários e Cargos.
              </p>
            ) : (
              <Select value={cargoSelecionado} onValueChange={setCargoSelecionado}>
                <SelectTrigger id="cargo-usuario" className="h-11 border-kx-campo-borda bg-kx-superficie">
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargos?.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3">
            <Label className="text-xs font-bold text-kx-texto">Status</Label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-kx-legenda">
                {usuario.ativo
                  ? "Este usuário está ativo e consegue entrar no sistema."
                  : "Este usuário está desativado e não consegue entrar no sistema."}
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant={usuario.ativo ? "destructive" : "outline"} size="sm" disabled={alterandoStatus}>
                    {usuario.ativo ? "Desativar" : "Reativar"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{usuario.ativo ? `Desativar ${usuario.nome}?` : `Reativar ${usuario.nome}?`}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {usuario.ativo
                        ? "O usuário perde o acesso ao sistema imediatamente. Pode ser reativado depois."
                        : "O usuário volta a conseguir entrar no sistema."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void aoAlterarStatus()}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          {!usuario.souEu && (
            <Button type="button" className="rounded-kx-botao" onClick={() => void aoSalvarCargo()} disabled={salvandoCargo}>
              {salvandoCargo ? "Salvando..." : "Salvar cargo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
