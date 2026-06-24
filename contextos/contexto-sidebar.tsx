"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/**
 * Contexto para gerenciar o estado da Sidebar (aberta/contraída)
 */
interface ContextoSidebarType {
  contraida: boolean;
  setContraida: (contraida: boolean) => void;
}

const ContextoSidebar = createContext<ContextoSidebarType | undefined>(
  undefined
);

export function ProvedorSidebar({ children }: { children: ReactNode }) {
  const [contraida, setContraida] = useState(false);

  return (
    <ContextoSidebar.Provider value={{ contraida, setContraida }}>
      {children}
    </ContextoSidebar.Provider>
  );
}

export function useSidebar() {
  const contexto = useContext(ContextoSidebar);
  if (!contexto) {
    throw new Error("useSidebar deve ser usado dentro de ProvedorSidebar");
  }
  return contexto;
}
