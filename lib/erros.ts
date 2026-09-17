/**
 * Taxonomia de erros da aplicacao e traducao segura para o cliente (F-20,
 * F-38, F-40).
 *
 * Antes, varios catches faziam `error instanceof Error ? error.message : "..."`
 * e devolviam isso direto para o cliente. Isso e seguro para erros que o
 * proprio app lanca de proposito (mensagens pt-BR escritas a mao), mas
 * qualquer excecao inesperada — Prisma, rede, bug — tambem passava pelo
 * mesmo caminho e vazava detalhe interno (nome de coluna, stack, codigo de
 * erro do Postgres) para quem esta na tela.
 *
 * `paraMensagemSegura` e o unico funil: erros conhecidos (`ErroNegocio`,
 * `ErroPermissao`, `ErroSessao`) sao seguros por construcao e devolvem a
 * propria mensagem; qualquer outra coisa e logada com `console.error` no
 * servidor e vira uma mensagem generica pt-BR para o cliente.
 */

import { Prisma } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";
import { ErroPermissao } from "@/lib/auth/permissoes";

export { ErroPermissao };

/** Falha de regra de negocio conhecida (estoque, limites, estado invalido). Mensagem sempre segura para o cliente. */
export class ErroNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNegocio";
  }
}

/** Sessao ausente, expirada ou revogada. Mensagem sempre segura para o cliente. */
export class ErroSessao extends Error {
  constructor(mensagem = "Sua sessão expirou. Faça login novamente.") {
    super(mensagem);
    this.name = "ErroSessao";
  }
}

const MENSAGEM_GENERICA = "Não foi possível concluir a operação. Tente novamente em instantes.";

const ASSINATURAS_ERRO_INTERNO: RegExp[] = [
  /prisma/i,
  /\bp\d{4}\b/i, // codigos de erro do Prisma, ex.: P2002, P2025
  /postgres|econnrefused|econnreset|enotfound/i,
  /at Object\.|at async |\.ts:\d+:\d+|\.js:\d+:\d+/, // trechos de stack trace
  /unknown argument|unique constraint|foreign key constraint/i,
];

function pareceErroInterno(mensagem: string): boolean {
  if (!mensagem.trim()) return true;
  return ASSINATURAS_ERRO_INTERNO.some((padrao) => padrao.test(mensagem));
}

function ehErroPrismaInterno(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError ||
    erro instanceof Prisma.PrismaClientUnknownRequestError ||
    erro instanceof Prisma.PrismaClientValidationError ||
    erro instanceof Prisma.PrismaClientInitializationError ||
    erro instanceof Prisma.PrismaClientRustPanicError
  );
}

/**
 * Se `erro` for um dos tipos conhecidos e seguros (`ErroNegocio`,
 * `ErroPermissao`, `ErroSessao`), devolve a propria mensagem; caso
 * contrario, `null`. Pensado para catches que ja tem tratamento especifico
 * proprio (ex.: codigos de erro do Prisma) e só caem num fallback generico
 * no final: chame isto como a PRIMEIRA checagem, antes desse tratamento
 * proprio — sem isso, o catch engolia o motivo real de "sem permissao" e
 * devolvia uma mensagem generica de "nao foi possivel", escondendo do
 * usuario por que a acao foi negada (Fase 1B-UI, Parte 1).
 */
export function mensagemDeErroConhecido(erro: unknown): string | null {
  if (erro instanceof ErroNegocio || erro instanceof ErroPermissao || erro instanceof ErroSessao) {
    return erro.message;
  }
  return null;
}

/**
 * Traduz qualquer erro capturado em um catch de server action/component para
 * uma mensagem pt-BR segura de mostrar ao usuario. Chame como PRIMEIRA linha
 * do catch: erros de controle de fluxo do Next (`redirect`, `notFound`) sao
 * relancados imediatamente, antes de qualquer outra logica.
 */
export function paraMensagemSegura(erro: unknown): string {
  unstable_rethrow(erro);

  const mensagemConhecida = mensagemDeErroConhecido(erro);
  if (mensagemConhecida !== null) {
    return mensagemConhecida;
  }

  if (ehErroPrismaInterno(erro)) {
    console.error("[erros] erro interno do Prisma ocultado do cliente:", erro);
    return MENSAGEM_GENERICA;
  }

  if (erro instanceof Error) {
    if (pareceErroInterno(erro.message)) {
      console.error("[erros] mensagem de erro potencialmente interna ocultada do cliente:", erro);
      return MENSAGEM_GENERICA;
    }
    return erro.message;
  }

  console.error("[erros] valor lancado que nao e Error:", erro);
  return MENSAGEM_GENERICA;
}
