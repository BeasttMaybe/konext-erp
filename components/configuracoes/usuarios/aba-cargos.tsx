"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { arquivarCargo, listarCargos, listarPermissoesDisponiveis, type CargoListado } from "@/app/actions/cargos";
import type { PermissaoDisponivel } from "@/lib/auth/permissoes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { ModalCargo } from "./modal-cargo";

type PropsAbaCargos = {
  onEditarPermissoes: (cargoId: string) => void;
};

type ModalCargoAberto =
  | { modo: "criar" }
  | { modo: "duplicar"; cargo: CargoListado }
  | { modo: "renomear"; cargo: CargoListado };

/**
 * Renomear/Excluir (Fase 3-2E, fix) — ficam no cartão, ao lado de
 * Duplicar, SEM desabilitar pro cargo Fixo (Administrador): ao contrário
 * de "Editar permissões" (bloqueado no cliente porque o cargo não tem
 * permissão nenhuma pra editar), renomear/arquivar são ações que o
 * servidor recusa com uma mensagem clara — a recusa em si é o
 * comportamento a mostrar, não um botão escondido.
 */
export function AbaCargos({ onEditarPermissoes }: PropsAbaCargos) {
  const [cargos, setCargos] = useState<CargoListado[] | null>(null);
  const [catalogo, setCatalogo] = useState<PermissaoDisponivel[]>([]);
  const [modalAberto, setModalAberto] = useState<ModalCargoAberto | null>(null);
  const [cargoParaExcluir, setCargoParaExcluir] = useState<CargoListado | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const recarregar = () => {
    listarCargos().then((resultado) => {
      if (resultado.sucesso) {
        setCargos(resultado.dados);
      } else {
        toast.error(resultado.erro);
        setCargos([]);
      }
    });
  };

  const confirmarExclusao = async () => {
    if (!cargoParaExcluir) return;
    setExcluindo(true);
    try {
      const resultado = await arquivarCargo({ cargoId: cargoParaExcluir.id });
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(`Cargo "${cargoParaExcluir.nome}" excluído.`);
      setCargoParaExcluir(null);
      recarregar();
    } finally {
      setExcluindo(false);
    }
  };

  useEffect(() => {
    recarregar();
    listarPermissoesDisponiveis().then((resultado) => {
      if (resultado.sucesso) setCatalogo(resultado.dados);
    });
  }, []);

  const rotuloModuloPorPermissao = useMemo(
    () => new Map(catalogo.map((item) => [item.permissao, item.rotuloModulo])),
    [catalogo]
  );

  const modulosDoCargo = (cargo: CargoListado): string[] => {
    const modulos = new Set(cargo.permissoes.map((permissao) => rotuloModuloPorPermissao.get(permissao)).filter(Boolean));
    return Array.from(modulos) as string[];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" className="rounded-kx-botao" onClick={() => setModalAberto({ modo: "criar" })}>
          Criar cargo
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {cargos === null ? (
          <p className="text-sm text-kx-legenda">Carregando cargos...</p>
        ) : cargos.length === 0 ? (
          <p className="text-sm text-kx-legenda">Nenhum cargo cadastrado.</p>
        ) : (
          cargos
            .filter((cargo) => !cargo.arquivadoEm)
            .map((cargo) => (
              <div key={cargo.id} className="flex flex-col gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-kx-texto">
                      {cargo.nome}
                      {cargo.fixo && <PilulaStatus variante="neutro">Fixo</PilulaStatus>}
                    </p>
                    <p className="mt-1 text-xs text-kx-legenda">{cargo.descricao || "Sem descrição."}</p>
                  </div>
                </div>

                <p className="text-xs text-kx-legenda">
                  {cargo.quantidadeUsuariosAtivos} {cargo.quantidadeUsuariosAtivos === 1 ? "pessoa" : "pessoas"} neste cargo
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {modulosDoCargo(cargo).map((modulo) => (
                    <PilulaStatus key={modulo} variante="neutro">
                      {modulo}
                    </PilulaStatus>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-kx-botao"
                    onClick={() => onEditarPermissoes(cargo.id)}
                    disabled={cargo.fixo}
                  >
                    Editar permissões
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-kx-botao" onClick={() => setModalAberto({ modo: "duplicar", cargo })}>
                    Duplicar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-kx-botao" onClick={() => setModalAberto({ modo: "renomear", cargo })}>
                    Renomear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-kx-botao text-kx-erro-texto hover:bg-kx-erro-fundo hover:text-kx-erro-texto"
                    onClick={() => setCargoParaExcluir(cargo)}
                  >
                    Excluir cargo
                  </Button>
                </div>
              </div>
            ))
        )}
      </div>

      {modalAberto && (
        <ModalCargo
          modo={modalAberto.modo}
          cargoOrigem={modalAberto.modo === "criar" ? undefined : modalAberto.cargo}
          cargosExistentes={cargos ?? []}
          aberto
          onFechar={() => setModalAberto(null)}
          onCriado={(cargoId) => {
            setModalAberto(null);
            recarregar();
            onEditarPermissoes(cargoId);
          }}
          onRenomeado={() => {
            setModalAberto(null);
            recarregar();
          }}
        />
      )}

      <AlertDialog open={Boolean(cargoParaExcluir)} onOpenChange={(aberto) => !aberto && setCargoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o cargo &quot;{cargoParaExcluir?.nome}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              O cargo é arquivado — deixa de aparecer na lista e não pode mais ser atribuído a ninguém. Só é
              possível excluir um cargo sem nenhuma pessoa atribuída a ele no momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmarExclusao()}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
