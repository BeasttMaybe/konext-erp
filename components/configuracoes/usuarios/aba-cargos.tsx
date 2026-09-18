"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listarCargos, listarPermissoesDisponiveis, type CargoListado } from "@/app/actions/cargos";
import type { PermissaoDisponivel } from "@/lib/auth/permissoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setModalAberto({ modo: "criar" })}>
          Criar cargo
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {cargos === null ? (
          <p className="text-sm text-muted-foreground">Carregando cargos...</p>
        ) : cargos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>
        ) : (
          cargos
            .filter((cargo) => !cargo.arquivadoEm)
            .map((cargo) => (
              <Card key={cargo.id} className="border-border bg-background p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {cargo.nome}
                      {cargo.fixo && <Badge variant="outline">Fixo</Badge>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cargo.descricao || "Sem descrição."}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {cargo.quantidadeUsuariosAtivos} {cargo.quantidadeUsuariosAtivos === 1 ? "pessoa" : "pessoas"} neste cargo
                </p>

                <div className="flex flex-wrap gap-1">
                  {modulosDoCargo(cargo).map((modulo) => (
                    <Badge key={modulo} variant="secondary" className="text-[11px]">
                      {modulo}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEditarPermissoes(cargo.id)} disabled={cargo.fixo}>
                    Editar permissões
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setModalAberto({ modo: "duplicar", cargo })}>
                    Duplicar
                  </Button>
                </div>
              </Card>
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
