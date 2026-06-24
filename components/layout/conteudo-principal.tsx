"use client";

import { ReactNode } from "react";
import { useSidebar } from "@/contextos/contexto-sidebar";
import { cn } from "@/lib/utils";

interface ConteudoPrincipalProps {
  children: ReactNode;
}

/**
 * Componente wrapper para o conteúdo principal
 * Ajusta o margin-left dinamicamente baseado no estado da sidebar
 */
export function ConteudoPrincipal({ children }: ConteudoPrincipalProps) {
  const { contraida } = useSidebar();

  return (
    <main
      className={cn(
        "flex-1 mt-16 bg-transparent transition-all duration-300 ease-in-out",
        contraida ? "ml-20" : "ml-64"
      )}
    >
      {children}
    </main>
  );
}
