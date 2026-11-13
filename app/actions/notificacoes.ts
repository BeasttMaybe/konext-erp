"use server";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import type { ContextoTenantServidor } from "@/types/tenant";
import { gerarAvisosDeCompromissos } from "@/lib/agenda/avisos-de-compromissos";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";

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

type PrismaNotificacoesAny = ContextoTenantServidor["prisma"] & {
  notificacao?: NotificacaoDelegate;
  Notificacao?: NotificacaoDelegate;
};

async function obterDelegateNotificacaoTenant(): Promise<NotificacaoDelegate | null> {
  const contexto = await exigirContextoTenant();
  const prismaAny = contexto.prisma as PrismaNotificacoesAny;
  return prismaAny.notificacao ?? prismaAny.Notificacao ?? null;
}

export type NotificacaoItem = {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadoEm: Date;
};

/**
 * Busca as 10 notificações mais recentes do tenant, priorizando as não lidas.
 */
export async function listarNotificacoes(): Promise<NotificacaoItem[]> {
  const delegate = await obterDelegateNotificacaoTenant();
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
 * Conta somente as notificações não lidas do tenant — usado para o indicador vermelho.
 */
export async function contarNaoLidas(): Promise<number> {
  // O sininho conta a cada tela: e o momento de virar aviso o compromisso
  // da agenda que chegou na hora. Falha aqui nunca derruba o sininho.
  try {
    const contexto = await exigirContextoTenant();
    await gerarAvisosDeCompromissos(contexto.prisma, contexto.fusoHorario ?? FUSO_HORARIO_PADRAO);
  } catch (erro) {
    console.error("[agenda] falha ao gerar avisos", erro instanceof Error ? erro.message : erro);
  }
  const delegate = await obterDelegateNotificacaoTenant();
  if (!delegate?.count) return 0;

  return delegate.count({ where: { lida: false } });
}

/**
 * Marca uma notificação específica do tenant como lida.
 */
export async function marcarComoLida(id: string): Promise<void> {
  const delegate = await obterDelegateNotificacaoTenant();
  if (!delegate?.update) return;

  await delegate.update({ where: { id }, data: { lida: true } });
}

/**
 * Marca todas as notificações do tenant como lidas de uma vez.
 */
export async function marcarTodasComoLidas(): Promise<void> {
  const delegate = await obterDelegateNotificacaoTenant();
  if (!delegate?.updateMany) return;

  await delegate.updateMany({ where: { lida: false }, data: { lida: true } });
}
