"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type NotificacaoItem = {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadoEm: Date;
};

/**
 * Busca as 10 notificações mais recentes, priorizando as não lidas.
 */
export async function listarNotificacoes(): Promise<NotificacaoItem[]> {
  const prismaAny = prisma as any;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate) return [];

  const itens = await delegate.findMany({
    orderBy: [{ lida: "asc" }, { criadoEm: "desc" }],
    take: 10,
  });

  return itens.map((n: any) => ({
    id: String(n.id),
    titulo: String(n.titulo),
    mensagem: String(n.mensagem),
    lida: Boolean(n.lida),
    criadoEm: new Date(n.criadoEm),
  }));
}

/**
 * Conta somente as notificações não lidas — usado para o indicador vermelho.
 */
export async function contarNaoLidas(): Promise<number> {
  const prismaAny = prisma as any;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate) return 0;

  return delegate.count({ where: { lida: false } });
}

/**
 * Marca uma notificação específica como lida.
 */
export async function marcarComoLida(id: string): Promise<void> {
  const prismaAny = prisma as any;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate) return;

  await delegate.update({ where: { id }, data: { lida: true } });
  revalidatePath("/", "layout");
}

/**
 * Marca todas as notificações como lidas de uma vez.
 */
export async function marcarTodasComoLidas(): Promise<void> {
  const prismaAny = prisma as any;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate) return;

  await delegate.updateMany({ where: { lida: false }, data: { lida: true } });
  revalidatePath("/", "layout");
}
