"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import { prismaCentral } from "@/lib/central/prisma-central";
import { COOKIE_SESSAO_CENTRAL } from "@/lib/auth/cookies";

/** "Manter conectado neste computador" marcado: sessao de 7 dias, cookie persistente. */
const DURACAO_SESSAO_LONGA_MS = 1000 * 60 * 60 * 24 * 7;
/** Checkbox desmarcado (padrao): sessao curta de 12h, cookie de sessao do navegador (sem maxAge). */
const DURACAO_SESSAO_CURTA_MS = 1000 * 60 * 60 * 12;

export type SessaoCentralResolvida = {
  id: string;
  usuarioCentralId: string;
  usuarioNome: string;
  usuarioEmail: string;
  empresaId: string;
  empresaSlug: string;
  tenantId: string;
  tenantSlug: string;
  connectionRef: string;
  role: string;
  expiraEm: Date;
};

function gerarTokenSessao(): string {
  return randomBytes(32).toString("base64url");
}

function gerarHashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function criarSessaoCentral(params: {
  usuarioCentralId: string;
  empresaId: string;
  tenantId: string;
  role: "ADMIN" | "GESTOR" | "USUARIO";
  /** "Manter conectado neste computador" do formulario de login (Fase 1B-FIX, Parte 4.5). */
  manterConectado: boolean;
}): Promise<void> {
  const token = gerarTokenSessao();
  const tokenHash = gerarHashToken(token);
  const duracaoMs = params.manterConectado ? DURACAO_SESSAO_LONGA_MS : DURACAO_SESSAO_CURTA_MS;
  const expiraEm = new Date(Date.now() + duracaoMs);

  await prismaCentral.sessaoCentral.create({
    data: {
      tokenHash,
      usuarioCentralId: params.usuarioCentralId,
      empresaId: params.empresaId,
      tenantId: params.tenantId,
      role: params.role,
      expiraEm,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESSAO_CENTRAL, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Sem "manter conectado", o cookie nao leva maxAge: dura so a sessao do
    // navegador. O servidor tambem limita expiraEm a 12h, entao mesmo um
    // navegador configurado para restaurar abas nao estende a sessao alem
    // disso.
    ...(params.manterConectado ? { maxAge: Math.floor(duracaoMs / 1000) } : {}),
  });
}

export async function obterSessaoCentral(): Promise<SessaoCentralResolvida | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO_CENTRAL)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = gerarHashToken(token);
  const agora = new Date();

  const sessao = await prismaCentral.sessaoCentral.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usuarioCentralId: true,
      empresaId: true,
      tenantId: true,
      role: true,
      expiraEm: true,
      revogadaEm: true,
    },
  });

  if (!sessao || sessao.revogadaEm || sessao.expiraEm <= agora) {
    return null;
  }

  const [usuarioCentral, empresa, tenant, vinculo] = await Promise.all([
    prismaCentral.usuarioCentral.findUnique({
      where: { id: sessao.usuarioCentralId },
      select: { id: true, nome: true, email: true, ativo: true },
    }),
    prismaCentral.empresa.findUnique({
      where: { id: sessao.empresaId },
      select: { id: true, slug: true, status: true },
    }),
    prismaCentral.tenant.findUnique({
      where: { id: sessao.tenantId },
      select: { id: true, slug: true, status: true, connectionRef: true },
    }),
    prismaCentral.usuarioEmpresa.findUnique({
      where: {
        usuarioId_empresaId: {
          usuarioId: sessao.usuarioCentralId,
          empresaId: sessao.empresaId,
        },
      },
      select: { ativo: true, role: true },
    }),
  ]);

  if (
    !usuarioCentral?.ativo ||
    !empresa ||
    empresa.status !== "ATIVA" ||
    !tenant ||
    tenant.status !== "ATIVO" ||
    !tenant.connectionRef ||
    !vinculo?.ativo
  ) {
    return null;
  }

  await prismaCentral.sessaoCentral.update({
    where: { id: sessao.id },
    data: { ultimoUsoEm: agora },
  });

  return {
    id: sessao.id,
    usuarioCentralId: usuarioCentral.id,
    usuarioNome: usuarioCentral.nome,
    usuarioEmail: usuarioCentral.email,
    empresaId: empresa.id,
    empresaSlug: empresa.slug,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    connectionRef: tenant.connectionRef,
    role: vinculo.role,
    expiraEm: sessao.expiraEm,
  };
}

export async function revogarSessaoCentralAtual(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO_CENTRAL)?.value;

  if (token) {
    const tokenHash = gerarHashToken(token);
    await prismaCentral.sessaoCentral.updateMany({
      where: {
        tokenHash,
        revogadaEm: null,
      },
      data: {
        revogadaEm: new Date(),
      },
    });
  }

  cookieStore.delete(COOKIE_SESSAO_CENTRAL);
}

/**
 * Exige sessao central valida. Unico conceito de identidade autenticadora do sistema.
 *
 * Sem sessao valida, redireciona para o login em vez de lancar (F-20): antes
 * a chamada lancava um Error puro que, sem `error.tsx`/tratamento, derrubava
 * a pagina inteira na tela de erro generica do Next em vez de mandar o
 * usuario para o login. O cookie invalido/expirado e sempre removido antes
 * do redirecionamento.
 */
export async function exigirSessaoCentral(): Promise<SessaoCentralResolvida> {
  const sessao = await obterSessaoCentral();

  if (!sessao) {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_SESSAO_CENTRAL);
    redirect("/login?expirada=1");
  }

  return sessao;
}
