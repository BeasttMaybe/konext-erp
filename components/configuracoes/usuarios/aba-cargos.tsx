"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listarCargos, listarPermissoesDisponiveis, type CargoListado } from "@/app/actions/cargos";
import type { PermissaoDisponivel } from "@/lib/auth/permissoes";
import { Button } from "@/components/ui/button";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { ModalCargo } from "./modal-cargo";

type PropsAbaCargos = {
  onEditarPermissoes: (cargoId: string) => void;
};

export function AbaCargos({ onEditarPermissoes }: PropsAbaCargos) {
  const [cargos, setCargos] = useState<CargoListado[] | null>(null);
  const [catalogo, setCatalogo] = useState<PermissaoDisponivel[]>([]);
  const [modalAberto, setModalAberto] = useState<{ modo: "criar" } | { modo: "duplicar"; cargo: CargoListado } | null>(null);

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

                <div className="flex gap-2 pt-1">
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
                </div>
              </div>
            ))
        )}
      </div>

      {modalAberto && (
        <ModalCargo
          modo={modalAberto.modo}
          cargoOrigem={modalAberto.modo === "duplicar" ? modalAberto.cargo : undefined}
          cargosExistentes={cargos ?? []}
          aberto
          onFechar={() => setModalAberto(null)}
          onCriado={(cargoId) => {
            setModalAberto(null);
            recarregar();
            onEditarPermissoes(cargoId);
          }}
        />
      )}
    </div>
  );
}
