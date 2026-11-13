import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { central } from "~/lib/prisma-central";
import { COOKIE_SESSAO, DURACAO_DA_SESSAO_MS, gerarToken, hash } from "~/lib/regras";

export type Administrador = { id: string; nome: string; email: string };

export async function abrirSessao(administradorId: string): Promise<void> {
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + DURACAO_DA_SESSAO_MS);
  await central().sessaoMaster.create({ data: { administradorId, tokenHash: hash(token), expiraEm }, select: { id: true } });
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const loja = await cookies();
  const token = loja.get(COOKIE_SESSAO)?.value;
  if (token) {
    await central().sessaoMaster.updateMany({ where: { tokenHash: hash(token), revogadaEm: null }, data: { revogadaEm: new Date() } });
  }
  loja.delete(COOKIE_SESSAO);
}

/** Quem esta logado, ou null. Uma leitura por requisicao. */
export const administradorAtual = cache(async (): Promise<Administrador | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const sessao = await central().sessaoMaster.findUnique({
    where: { tokenHash: hash(token) },
    select: { expiraEm: true, revogadaEm: true, administrador: { select: { id: true, nome: true, email: true, ativo: true } } },
  });
  if (!sessao || sessao.revogadaEm || sessao.expiraEm <= new Date() || !sessao.administrador.ativo) return null;
  const { id, nome, email } = sessao.administrador;
  return { id, nome, email };
});

/** Para toda pagina e action do painel. */
export async function exigirAdministrador(): Promise<Administrador> {
  const administrador = await administradorAtual();
  if (!administrador) redirect("/login");
  return administrador;
}

export const gerarHashSenha = (senha: string) => bcrypt.hash(senha, 12);
export const conferirSenha = (senha: string, hashSalvo: string) => bcrypt.compare(senha, hashSalvo);
