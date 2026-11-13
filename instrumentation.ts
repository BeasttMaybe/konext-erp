import type { Instrumentation } from "next";

/**
 * Todo erro de servidor que o Next captura (tela, rota, action) passa por
 * aqui e vai para lib/sistema/registrar-erro.ts: registro no banco central e,
 * com TELEGRAM_CHAT_ERROS configurado, aviso no Telegram.
 *
 * Import dinamico e so no runtime Node: o registro usa o Prisma e node:crypto,
 * que nao existem no runtime Edge.
 */
export const onRequestError: Instrumentation.onRequestError = async (erro, requisicao, contexto) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registrarErroDoSistema } = await import("@/lib/sistema/registrar-erro");
  await registrarErroDoSistema(erro, requisicao, contexto);
};
