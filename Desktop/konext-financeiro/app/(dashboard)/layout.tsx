"use client";

import { ConteudoPrincipal } from "@/components/layout/conteudo-principal";
import { Rodape } from "@/components/layout/rodape";
import { BarraLateral } from "@/components/layout/barralateral";
import { Cabecalho } from "@/components/layout/cabecalho";

/**
 * Layout do Dashboard - Envolve a sidebar, cabeçalho e rodapé
 * Todos os próximos menus já vêm com a sidebar dinâmica correta
 */
export default function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <BarraLateral />
      <Cabecalho />

      {/* Conteúdo Principal com Sidebar Dinâmica */}
      <ConteudoPrincipal>
        {children}
      </ConteudoPrincipal>

      <Rodape />
    </div>
  );
}
