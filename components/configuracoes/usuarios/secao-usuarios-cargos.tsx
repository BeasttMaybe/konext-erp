"use client";

import { useState } from "react";
import { SecaoConfiguracoes } from "../secao-configuracoes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaUsuarios } from "./aba-usuarios";
import { AbaCargos } from "./aba-cargos";
import { TelaPermissoesCargo } from "./tela-permissoes-cargo";

type Visao = { tela: "abas" } | { tela: "permissoes-cargo"; cargoId: string };

export function SecaoUsuariosCargos() {
  const [visao, setVisao] = useState<Visao>({ tela: "abas" });

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
      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <AbaUsuarios />
        </TabsContent>

        <TabsContent value="cargos">
          <AbaCargos onEditarPermissoes={(cargoId) => setVisao({ tela: "permissoes-cargo", cargoId })} />
        </TabsContent>
      </Tabs>
    </SecaoConfiguracoes>
  );
}
