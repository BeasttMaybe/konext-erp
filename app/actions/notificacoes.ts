"use server";
import { prisma } from "@/lib/prisma";

type NotificacaoRegistro = {
  id: string | number;
  titulo?: string | null;
  mensagem?: string | null;
  lida?: boolean | null;
  criadoEm: Date | string;
};

type NotificacaoDelegate = {
  findMany?: (args: unknown) => Promise<NotificacaoRegistro[]>;
  count?: (args: unknown) => Promise<number>;
  update?: (args: unknown) => Promise<unknown>;
  updateMany?: (args: unknown) => Promise<unknown>;
};

type PrismaNotificacoesAny = typeof prisma & {
  notificacao?: NotificacaoDelegate;
  Notificacao?: NotificacaoDelegate;
};

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
  const prismaAny = prisma as PrismaNotificacoesAny;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate?.findMany) return [];

  const itens = await delegate.findMany({
    orderBy: [{ lida: "asc" }, { criadoEm: "desc" }],
    take: 10,
  });

  return itens.map((n) => ({
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
  const prismaAny = prisma as PrismaNotificacoesAny;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate?.count) return 0;

  return delegate.count({ where: { lida: false } });
}

/**
 * Marca uma notificação específica como lida.
 */
export async function marcarComoLida(id: string): Promise<void> {
  const prismaAny = prisma as PrismaNotificacoesAny;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate?.update) return;

  await delegate.update({ where: { id }, data: { lida: true } });
}

/**
 * Marca todas as notificações como lidas de uma vez.
 */
export async function marcarTodasComoLidas(): Promise<void> {
  const prismaAny = prisma as PrismaNotificacoesAny;
  const delegate = prismaAny.notificacao ?? prismaAny.Notificacao;
  if (!delegate?.updateMany) return;

  await delegate.updateMany({ where: { lida: false }, data: { lida: true } });
}
