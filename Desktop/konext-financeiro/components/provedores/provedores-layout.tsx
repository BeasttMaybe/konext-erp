"use client";

import { ProvedorTema } from "@/components/provedores/provedor-tema";
import { ProvedorSidebar } from "@/contextos/contexto-sidebar";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

/**
 * Componente wrapper para aplicar provedores de contexto ao layout
 */
export function ProvedoresLayout({ children }: { children: ReactNode }) {
  return (
    <ProvedorTema>
      <ProvedorSidebar>
        {children}
        <Toaster richColors position="top-right" />
      </ProvedorSidebar>
    </ProvedorTema>
  );
}
