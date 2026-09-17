"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PapelEmpresa, Permissao } from "@/lib/auth/permissoes";

type ContextoPermissoesValor = {
  papel: PapelEmpresa;
  permissoes: ReadonlySet<Permissao>;
};

const ContextoPermissoes = createContext<ContextoPermissoesValor | undefined>(undefined);

/**
 * Alimentado pelo layout do dashboard (Server Component) com o resultado
 * serializavel de `obterPermissoesDoContexto`. A ocultacao de botao aqui e so
 * cosmetica — quem garante a regra e sempre `exigirPermissao` no servidor.
 */
export function ProvedorPermissoes({
  papel,
  permissoes,
  children,
}: {
  papel: PapelEmpresa;
  permissoes: readonly Permissao[];
  children: ReactNode;
}) {
  const valor = useMemo<ContextoPermissoesValor>(
    () => ({ papel, permissoes: new Set(permissoes) }),
    [papel, permissoes]
  );

  return <ContextoPermissoes.Provider value={valor}>{children}</ContextoPermissoes.Provider>;
}

export function usePermissoes(): ContextoPermissoesValor {
  const contexto = useContext(ContextoPermissoes);

  if (!contexto) {
    throw new Error("usePermissoes deve ser usado dentro de ProvedorPermissoes.");
  }

  return contexto;
}

/** Verdadeiro se o usuario logado tem a permissao informada. */
export function useTemPermissao(permissao: Permissao): boolean {
  const { permissoes } = usePermissoes();
  return permissoes.has(permissao);
}

/** Verdadeiro se o usuario logado tem QUALQUER uma das permissoes informadas. */
export function useTemAlgumaPermissao(permissoesRequeridas: readonly Permissao[]): boolean {
  const { permissoes } = usePermissoes();
  return permissoesRequeridas.some((permissao) => permissoes.has(permissao));
}
