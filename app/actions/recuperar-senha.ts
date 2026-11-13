"use server";

import { headers } from "next/headers";
import { after } from "next/server";

import { prismaCentral } from "@/lib/central/prisma-central";
import { gerarHashSenha, validarNovaSenha } from "@/lib/auth/senha";
import {
  enderecoDoSistema,
  gerarTokenDeRecuperacao,
  hashDoToken,
  MAXIMO_DE_LINKS_POR_HORA,
  MENSAGEM_LINK_INVALIDO,
  situacaoDoToken,
  tokenTemFormatoValido,
  VALIDADE_DO_LINK_MS,
} from "@/lib/auth/recuperacao-de-senha";
import { zerarFalhasDoEmail } from "@/lib/auth/tentativas-login";
import { enviarEmail, envioDeEmailConfigurado, escaparHtml } from "@/lib/email/enviar-email";
import { registrarLogAuditoriaCentral } from "@/lib/auditoria-central";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";

/**
 * "Esqueci minha senha" (lib/auth/recuperacao-de-senha.ts). As duas actions
 * atendem quem NAO tem sessao, de proposito: a primeira so manda um link para
 * o e-mail da propria conta, a segunda so vale com o token desse link.
 */

export type ResultadoPedido = { ok: true; mensagem: string } | { ok: false; erro: string };

const RESPOSTA_PADRAO =
  "Se este e-mail tiver conta no Konext, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam — o link vale 30 minutos.";

/**
 * Responde SEMPRE a mesma coisa, com ou sem conta, para nao revelar quais
 * e-mails existem. O envio do e-mail roda depois da resposta (`after`), para
 * que o tempo de resposta tambem nao revele.
 */
export async function pedirLinkDeRecuperacao(emailInformado: string): Promise<ResultadoPedido> {
  const email = String(emailInformado ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) {
    return { ok: false, erro: "Informe o e-mail da sua conta." };
  }
  if (!envioDeEmailConfigurado()) {
    return { ok: false, erro: "O envio de e-mail ainda não está ativo. Peça uma senha nova ao administrador da sua loja." };
  }

  const cabecalhos = await headers();
  const base = enderecoDoSistema(
    { URL_DO_SISTEMA: process.env.URL_DO_SISTEMA, VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL },
    cabecalhos.get("host")
  );
  if (!base) {
    console.error("[recuperar-senha] sem URL_DO_SISTEMA nem VERCEL_PROJECT_PRODUCTION_URL");
    return { ok: false, erro: "Não foi possível enviar agora. Peça uma senha nova ao administrador da sua loja." };
  }

  after(async () => {
    try {
      const usuario = await prismaCentral.usuarioCentral.findUnique({
        where: { email },
        select: { id: true, nome: true, ativo: true },
      });
      if (!usuario?.ativo) return;

      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
      const recentes = await prismaCentral.tokenRecuperacaoSenha.count({
        where: { usuarioId: usuario.id, criadoEm: { gte: umaHoraAtras } },
      });
      if (recentes >= MAXIMO_DE_LINKS_POR_HORA) return;

      const token = gerarTokenDeRecuperacao();
      await prismaCentral.tokenRecuperacaoSenha.create({
        data: { usuarioId: usuario.id, tokenHash: hashDoToken(token), expiraEm: new Date(Date.now() + VALIDADE_DO_LINK_MS) },
        select: { id: true },
      });

      const link = `${base}/login/redefinir?token=${token}`;
      const nome = usuario.nome.split(" ")[0] ?? usuario.nome;
      await enviarEmail({
        para: email,
        assunto: "Konext ERP — criar uma senha nova",
        texto: `Olá, ${nome}.\n\nRecebemos um pedido para criar uma senha nova no Konext ERP. Use o link abaixo (vale 30 minutos, uma vez só):\n\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
        html: `<p>Olá, ${escaparHtml(nome)}.</p><p>Recebemos um pedido para criar uma senha nova no Konext ERP.</p><p><a href="${escaparHtml(link)}">Criar minha senha nova</a></p><p>O link vale 30 minutos e funciona uma vez só.</p><p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
      });
    } catch (erro) {
      console.error("[recuperar-senha] falha no pedido", erro instanceof Error ? erro.message : erro);
    }
  });

  return { ok: true, mensagem: RESPOSTA_PADRAO };
}

export type ResultadoRedefinicao = { ok: true } | { ok: false; erro: string };

/**
 * Troca a senha com o token do link. Marca este e todos os outros links da
 * pessoa como usados, derruba as sessoes abertas e zera o limite de login.
 */
export async function redefinirSenhaPeloLink(dados: {
  token: string;
  novaSenha: string;
  confirmacao: string;
}): Promise<ResultadoRedefinicao> {
  const token = String(dados.token ?? "");
  if (!tokenTemFormatoValido(token)) return { ok: false, erro: MENSAGEM_LINK_INVALIDO.inexistente };
  if (dados.novaSenha !== dados.confirmacao) return { ok: false, erro: "A confirmação não confere com a nova senha." };
  const validacao = validarNovaSenha(dados.novaSenha);
  if (!validacao.valida) return { ok: false, erro: validacao.motivo };

  try {
    const registro = await prismaCentral.tokenRecuperacaoSenha.findUnique({
      where: { tokenHash: hashDoToken(token) },
      select: {
        id: true,
        expiraEm: true,
        usadoEm: true,
        usuario: { select: { id: true, email: true, ativo: true, empresas: { select: { empresaId: true }, take: 1 } } },
      },
    });
    const situacao = situacaoDoToken(registro, new Date());
    if (situacao !== "valido" || !registro) return { ok: false, erro: MENSAGEM_LINK_INVALIDO[situacao === "valido" ? "inexistente" : situacao] };
    if (!registro.usuario.ativo) return { ok: false, erro: MENSAGEM_LINK_INVALIDO.inexistente };

    const novoHash = await gerarHashSenha(dados.novaSenha);
    const agora = new Date();
    const usuarioId = registro.usuario.id;

    const trocou = await prismaCentral.$transaction(async (tx) => {
      // So um uso: se outra requisicao usou o mesmo link no meio, para aqui.
      const marcado = await tx.tokenRecuperacaoSenha.updateMany({
        where: { id: registro.id, usadoEm: null },
        data: { usadoEm: agora },
      });
      if (marcado.count !== 1) return false;
      await tx.usuarioCentral.update({ where: { id: usuarioId }, data: { senha: novoHash }, select: { id: true } });
      await tx.tokenRecuperacaoSenha.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: agora } });
      await tx.sessaoCentral.updateMany({ where: { usuarioCentralId: usuarioId, revogadaEm: null }, data: { revogadaEm: agora } });
      const empresaId = registro.usuario.empresas[0]?.empresaId;
      if (empresaId) {
        await registrarLogAuditoriaCentral(
          tx,
          { usuarioId, empresaId, origem: "app/actions/recuperar-senha.ts:redefinirSenhaPeloLink" },
          { acao: ACOES_AUDITORIA.REDEFINIR_SENHA_PELO_LINK, entidade: ENTIDADES_AUDITORIA.USUARIO_CENTRAL, entidadeId: usuarioId }
        );
      }
      return true;
    });
    if (!trocou) return { ok: false, erro: MENSAGEM_LINK_INVALIDO.usado };

    await zerarFalhasDoEmail(registro.usuario.email);
    return { ok: true };
  } catch (erro) {
    console.error("[recuperar-senha] falha ao redefinir", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível trocar a senha agora. Tente de novo em instantes." };
  }
}
