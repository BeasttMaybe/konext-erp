"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type UsuarioSessaoDelegate = {
  findUnique?: (args: unknown) => Promise<{ id: string; nome: string; email: string; role: string } | null>;
};

type PrismaSessaoClient = typeof prisma & {
  usuario?: UsuarioSessaoDelegate;
  Usuario?: UsuarioSessaoDelegate;
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

/**
 * Utilitário central de sessão.
 *
 * IMPORTANTE (segurança): o middleware apenas protege a NAVEGAÇÃO entre páginas.
 * Server Actions são endpoints POST que podem ser chamados diretamente, então
 * cada ação sensível PRECISA validar a sessão no backend usando estas funções.
 */

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  role: string;
};

/**
 * Lê o cookie de sessão e retorna o usuário autenticado, ou null se não houver
 * sessão válida. Nunca lança erro — use quando a ausência de sessão é aceitável.
 */
export async function obterUsuarioSessao(): Promise<UsuarioSessao | null> {
  const cookieStore = await cookies();
  const sessaoId = cookieStore.get("konext_session")?.value;

  if (!sessaoId) {
    return null;
  }

  try {
    const prismaAny = prisma as PrismaSessaoClient;
    const usuarioDelegate = prismaAny.usuario ?? prismaAny.Usuario;

    if (usuarioDelegate?.findUnique) {
      const usuario = await usuarioDelegate.findUnique({
        where: { id: sessaoId },
        select: { id: true, nome: true, email: true, role: true },
      });

      if (!usuario?.id) return null;

      return {
        id: String(usuario.id),
        nome: String(usuario.nome ?? ""),
        email: String(usuario.email ?? ""),
        role: String(usuario.role ?? "USUARIO"),
      };
    }

    const resultado = await prismaAny.$queryRaw<
      Array<{ id: string; nome: string; email: string; role: string }>
    >`
      SELECT id, nome, email, role
      FROM "Usuario"
      WHERE id = ${sessaoId}
      LIMIT 1
    `;

    const usuario = resultado?.[0];
    if (!usuario?.id) return null;

    return {
      id: String(usuario.id),
      nome: String(usuario.nome ?? ""),
      email: String(usuario.email ?? ""),
      role: String(usuario.role ?? "USUARIO"),
    };
  } catch {
    return null;
  }
}

/**
 * Exige sessão válida. Lança erro padronizado quando não autenticado.
 * Use no início de Server Actions que fazem mutações sensíveis.
 */
export async function exigirSessao(): Promise<UsuarioSessao> {
  const usuario = await obterUsuarioSessao();

  if (!usuario) {
    throw new Error("Sessão expirada ou inválida. Faça login novamente.");
  }

  return usuario;
}
