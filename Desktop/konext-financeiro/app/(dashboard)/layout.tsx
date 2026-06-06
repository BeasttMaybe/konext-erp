"use client";

import { ConteudoPrincipal } from "@/components/layout/conteudo-principal";
import { Rodape } from "@/components/layout/rodape";

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
    <div className="min-h-screen flex flex-col">
      {/* Conteúdo Principal com Sidebar Dinâmica */}
      <ConteudoPrincipal>
        <div className="container mx-auto p-6">
          {children}
        </div>
      </ConteudoPrincipal>

      <Rodape />
    </div>
  );
}
