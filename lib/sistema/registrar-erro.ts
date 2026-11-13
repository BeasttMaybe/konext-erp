import { createHash } from "node:crypto";

import { prismaCentral } from "@/lib/central/prisma-central";
import { COOKIE_SESSAO_CENTRAL } from "@/lib/auth/cookies";
import { enviarMensagemNoTelegram } from "@/lib/notificacoes/telegram";
import {
  DIAS_GUARDADOS,
  deveAvisar,
  digestDo,
  ehControleDeFluxo,
  origemDoErro,
  resumirMensagem,
  textoDoAviso,
  valorDoCookie,
} from "@/lib/sistema/erro-do-sistema";

/**
 * Chamado por instrumentation.ts para todo erro de servidor. Regras em
 * lib/sistema/erro-do-sistema.ts. NUNCA lanca: falhar ao registrar um erro nao
 * pode produzir um segundo erro.
 */
export async function registrarErroDoSistema(
  erro: unknown,
  requisicao: { method?: string; headers?: Record<string, string | string[] | undefined> },
  contexto: { routeType?: string; routePath?: string }
): Promise<void> {
  try {
    if (ehControleDeFluxo(erro)) return;
    if (!process.env.CENTRAL_DATABASE_URL) return;

    const origem = origemDoErro(contexto, requisicao.method);
    const mensagem = resumirMensagem(erro);
    const empresa = await empresaDaRequisicao(requisicao.headers?.cookie);

    const registro = await prismaCentral.erroDoSistema.create({
      data: { origem, mensagem, digest: digestDo(erro), empresaId: empresa?.id ?? null },
      select: { id: true },
    });

    const chat = process.env.TELEGRAM_CHAT_ERROS?.trim();
    if (chat) {
      const agora = new Date();
      const [ultimoIgual, avisosNaUltimaHora] = await Promise.all([
        prismaCentral.erroDoSistema.findFirst({
          where: { origem, mensagem, avisadoEm: { not: null } },
          orderBy: { avisadoEm: "desc" },
          select: { avisadoEm: true },
        }),
        prismaCentral.erroDoSistema.count({ where: { avisadoEm: { gte: new Date(agora.getTime() - 60 * 60 * 1000) } } }),
      ]);
      if (deveAvisar({ ultimoAvisoDoMesmoErro: ultimoIgual?.avisadoEm ?? null, avisosNaUltimaHora, agora })) {
        const envio = await enviarMensagemNoTelegram({
          chatId: chat,
          texto: textoDoAviso({ origem, mensagem, loja: empresa?.slug ?? null, ambiente: process.env.VERCEL_ENV ?? null }),
        });
        if (envio.enviado) {
          await prismaCentral.erroDoSistema.update({ where: { id: registro.id }, data: { avisadoEm: agora }, select: { id: true } });
        }
      }
    }

    if (Math.random() < 0.02) {
      await prismaCentral.erroDoSistema.deleteMany({
        where: { criadoEm: { lt: new Date(Date.now() - DIAS_GUARDADOS * 24 * 60 * 60 * 1000) } },
      });
    }
  } catch (falha) {
    console.error("[erros] nao foi possivel registrar o erro", falha instanceof Error ? falha.message : falha);
  }
}

/** A loja de quem fez a requisicao, pelo cookie de sessao (hash, igual a lib/auth/sessao-central.ts). */
async function empresaDaRequisicao(cookie: string | string[] | undefined): Promise<{ id: string; slug: string } | null> {
  const token = valorDoCookie(cookie, COOKIE_SESSAO_CENTRAL);
  if (!token) return null;
  const sessao = await prismaCentral.sessaoCentral.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { empresaId: true },
  });
  if (!sessao) return null;
  return prismaCentral.empresa.findUnique({ where: { id: sessao.empresaId }, select: { id: true, slug: true } });
}

export type ErroRecente = { id: string; origem: string; mensagem: string; criadoEm: string };

/** Ultimos erros da loja (tela Estado do sistema). */
export async function errosRecentesDaLoja(empresaId: string, limite = 8): Promise<{ total24h: number; ultimos: ErroRecente[] }> {
  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total24h, ultimos] = await Promise.all([
      prismaCentral.erroDoSistema.count({ where: { empresaId, criadoEm: { gte: desde } } }),
      prismaCentral.erroDoSistema.findMany({
        where: { empresaId },
        orderBy: { criadoEm: "desc" },
        take: limite,
        select: { id: true, origem: true, mensagem: true, criadoEm: true },
      }),
    ]);
    return { total24h, ultimos: ultimos.map((e) => ({ ...e, criadoEm: e.criadoEm.toISOString() })) };
  } catch {
    return { total24h: 0, ultimos: [] };
  }
}
