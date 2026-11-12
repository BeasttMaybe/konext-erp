"use client";

import { useState } from "react";
import { SecaoConfiguracoes } from "../secao-configuracoes";
import { AbaUsuarios } from "./aba-usuarios";
import { AbaCargos } from "./aba-cargos";
import { TelaPermissoesCargo } from "./tela-permissoes-cargo";

type Visao = { tela: "abas" } | { tela: "permissoes-cargo"; cargoId: string };
type AbaId = "usuarios" | "cargos";

const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: "usuarios", rotulo: "Usuários" },
  { id: "cargos", rotulo: "Cargos" },
];

/**
 * Usuários e Cargos (Fase 3-2E, Parte 3) — referência: referencia-
 * configuracoes-usuarios.html. "Novo usuário" fica dentro da aba Usuários e
 * "Criar cargo" dentro da aba Cargos: cada botão junto da lista que ele
 * altera.
 */
export function SecaoUsuariosCargos() {
  const [visao, setVisao] = useState<Visao>({ tela: "abas" });
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("usuarios");

  if (visao.tela === "permissoes-cargo") {
    return (
      <TelaPermissoesCargo
        cargoId={visao.cargoId}
        onVoltar={() => setVisao({ tela: "abas" })}
      />
    );
  }

  return (
    <SecaoConfiguracoes
      titulo="Usuários e Cargos"
      descricao="Cada tela abaixo salva na hora — não é preciso usar o botão de salvar do rodapé."
    >
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Usuários ou cargos" className="flex w-fit gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-1">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              role="tab"
              aria-selected={abaAtiva === aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`h-9 rounded-kx-botao px-4 text-sm font-bold transition-colors ${
                abaAtiva === aba.id ? "bg-kx-primaria text-primary-foreground" : "text-kx-texto-2 hover:bg-kx-superficie"
              }`}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>

        {abaAtiva === "usuarios" ? (
          <AbaUsuarios />
        ) : (
          <AbaCargos onEditarPermissoes={(cargoId) => setVisao({ tela: "permissoes-cargo", cargoId })} />
        )}
      </div>
    </SecaoConfiguracoes>
  );
}
