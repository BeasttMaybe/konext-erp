import "server-only";

import type { PrismaClient } from "@prisma/client";

import { chaveDaEmpresa } from "@/lib/seguranca/chave-da-empresa";
import { abrir, cifrar, CONTEXTO_CHAVE_ZERNIO } from "@/lib/seguranca/cifra";

/**
 * Guarda e lê a CHAVE da API Zernio da loja. Uma linha por loja (como o Bling).
 * A chave fica cifrada com a chave da empresa (banco central), nunca em texto
 * puro no banco da loja. O delegate é resolvido em runtime igual ao do Bling,
 * para não depender do nome exato do client gerado.
 */

type LinhaZernio = { id: string; chaveCifrada: string; ultimoErro: string | null; conectadoEm: Date };

type DelegateZernio = {
  findFirst: (args?: unknown) => Promise<LinhaZernio | null>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

function delegate(prisma: PrismaClient): DelegateZernio {
  const raiz = prisma as unknown as Record<string, DelegateZernio | undefined>;
  const encontrado = raiz.integracaoZernio ?? raiz.IntegracaoZernio;
  if (!encontrado?.findFirst) throw new Error("Delegate Prisma de IntegracaoZernio nao disponivel.");
  return encontrado;
}

export type EstadoIntegracaoZernio = { existe: boolean; ultimoErro: string | null; conectadoEm: Date | null };

export async function estadoIntegracaoZernio(prisma: PrismaClient): Promise<EstadoIntegracaoZernio> {
  const linha = await delegate(prisma).findFirst({ orderBy: { conectadoEm: "asc" } });
  return { existe: Boolean(linha), ultimoErro: linha?.ultimoErro ?? null, conectadoEm: linha?.conectadoEm ?? null };
}

/** A chave decifrada, ou null se não há integração (ou a chave não abre). */
export async function lerChaveZernio(prisma: PrismaClient, empresaId: string): Promise<string | null> {
  const linha = await delegate(prisma).findFirst({ orderBy: { conectadoEm: "asc" } });
  if (!linha?.chaveCifrada) return null;
  return abrir(linha.chaveCifrada, await chaveDaEmpresa(empresaId), CONTEXTO_CHAVE_ZERNIO);
}

export async function salvarChaveZernio(
  prisma: PrismaClient,
  empresaId: string,
  chave: string,
  conectadoPor: string | null
): Promise<void> {
  const cifrada = cifrar(chave, await chaveDaEmpresa(empresaId), CONTEXTO_CHAVE_ZERNIO);
  // Uma linha por loja: reconectar substitui a anterior.
  await delegate(prisma).deleteMany({ where: {} });
  await delegate(prisma).create({ data: { chaveCifrada: cifrada, conectadoPor } });
}

export async function removerChaveZernio(prisma: PrismaClient): Promise<void> {
  await delegate(prisma).deleteMany({ where: {} });
}

/** Registra (ou limpa) o último erro, para a tela explicar o que houve. */
export async function registrarErroZernio(prisma: PrismaClient, erro: string | null): Promise<void> {
  const linha = await delegate(prisma).findFirst({ orderBy: { conectadoEm: "asc" } });
  if (!linha) return;
  await delegate(prisma).update({ where: { id: linha.id }, data: { ultimoErro: erro ? erro.slice(0, 500) : null } });
}
