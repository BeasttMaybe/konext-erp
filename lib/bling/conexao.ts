import "server-only";

import type { PrismaClient } from "@prisma/client";

import { ErroDoBling, renovarTokens, type TokensDoBling } from "./api";

/**
 * Guarda os tokens do Bling e entrega sempre um access token válido.
 *
 * O PROBLEMA QUE ESTE MÓDULO EXISTE PARA RESOLVER
 *
 * O refresh token do Bling v3 ROTACIONA: ao renovar, o Bling devolve um
 * refresh token novo e invalida o anterior na hora. Isso transforma a
 * renovação simultânea num jeito de perder a conexão de vez:
 *
 *   requisição A lê o token vencido  ─┐
 *   requisição B lê o token vencido  ─┘  as duas leem o MESMO refresh token
 *   A renova  → Bling devolve refresh R2 e mata R1
 *   B renova com R1 → invalid_grant → conexão morta
 *
 * E o dono teria que reconectar à mão sem entender por quê. Pior: duas
 * requisições paralelas chegando com o token vencido é o caso NORMAL — basta
 * o dono abrir duas telas, ou o cron rodar enquanto ele navega.
 *
 * A trava é no BANCO, não na memória do processo: em serverless cada
 * invocação é um processo novo e não enxerga as outras, então uma trava em
 * memória protegeria contra nada.
 *
 * Ela guarda o INSTANTE em que a renovação começou, não um booleano, para
 * poder destravar sozinha. Um processo que morresse no meio da renovação
 * deixaria um booleano preso para sempre, e a loja ficaria sem Bling até
 * alguém mexer no banco à mão.
 */

/** Depois disto, a trava é considerada abandonada. Renovar leva ~1s. */
const SEGUNDOS_ATE_A_TRAVA_EXPIRAR = 60;

/** Quanto esperar a trava do outro processo antes de desistir desta chamada. */
const TENTATIVAS_DE_ESPERA = 10;
const MILISSEGUNDOS_ENTRE_TENTATIVAS = 600;

export type ConexaoBling = {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiraEm: Date;
  renovandoDesde: Date | null;
  conectadoEm: Date;
  ultimaSincronizacaoEm: Date | null;
  ultimoErro: string | null;
};

type DelegateIntegracao = {
  findFirst: (args?: unknown) => Promise<ConexaoBling | null>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  update: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<unknown>;
};

function delegate(prisma: PrismaClient): DelegateIntegracao {
  const raiz = prisma as unknown as Record<string, DelegateIntegracao | undefined>;
  const encontrado = raiz.integracaoBling ?? raiz.IntegracaoBling;

  if (!encontrado?.findFirst) {
    throw new ErroDoBling("Delegate Prisma de IntegracaoBling nao disponivel.", null);
  }

  return encontrado;
}

export async function lerConexao(prisma: PrismaClient): Promise<ConexaoBling | null> {
  return delegate(prisma).findFirst({ orderBy: { conectadoEm: "asc" } });
}

/**
 * Grava a conexão recém-autorizada, substituindo qualquer uma anterior.
 *
 * Reconectar apaga a conexão velha em vez de criar uma segunda linha: duas
 * conexões ativas para a mesma loja significariam dois refresh tokens vivos,
 * e eles se invalidariam mutuamente na primeira renovação.
 */
export async function salvarConexaoNova({
  prisma,
  tokens,
  conectadoPor,
}: {
  prisma: PrismaClient;
  tokens: TokensDoBling;
  conectadoPor: string | null;
}): Promise<void> {
  const integracao = delegate(prisma);

  await integracao.deleteMany({ where: {} });
  await integracao.create({
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiraEm: tokens.expiraEm,
      conectadoPor,
    },
  });
}

export async function desconectar(prisma: PrismaClient): Promise<void> {
  await delegate(prisma).deleteMany({ where: {} });
}

function esperar(milissegundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milissegundos));
}

/**
 * Tenta pegar a trava de renovação.
 *
 * O `updateMany` com `where` é o que torna isto atômico: o Postgres resolve a
 * condição e a escrita na mesma instrução, então entre dois processos que
 * chegam juntos exatamente um vê `count: 1`. Ler e depois escrever, mesmo que
 * em duas linhas seguidas, deixaria a janela aberta — que é precisamente o
 * problema que esta trava existe para fechar.
 */
async function tentarTravar(prisma: PrismaClient, conexaoId: string): Promise<boolean> {
  const limiteDeAbandono = new Date(Date.now() - SEGUNDOS_ATE_A_TRAVA_EXPIRAR * 1000);

  const resultado = await delegate(prisma).updateMany({
    where: {
      id: conexaoId,
      OR: [{ renovandoDesde: null }, { renovandoDesde: { lt: limiteDeAbandono } }],
    },
    data: { renovandoDesde: new Date() },
  });

  return resultado.count === 1;
}

function precisaRenovar(conexao: ConexaoBling): boolean {
  return conexao.expiraEm.getTime() <= Date.now();
}

/**
 * Um access token válido, renovando se preciso.
 *
 * Quem não consegue a trava ESPERA o outro terminar e relê, em vez de renovar
 * também — esperar um segundo é melhor que derrubar a conexão da loja.
 */
export async function obterAccessTokenValido(prisma: PrismaClient): Promise<string> {
  const integracao = delegate(prisma);
  const conexao = await lerConexao(prisma);

  if (!conexao) {
    throw new ErroDoBling("Esta loja ainda não conectou a conta do Bling.", null, true);
  }

  if (!precisaRenovar(conexao)) return conexao.accessToken;

  if (!(await tentarTravar(prisma, conexao.id))) {
    for (let tentativa = 0; tentativa < TENTATIVAS_DE_ESPERA; tentativa += 1) {
      await esperar(MILISSEGUNDOS_ENTRE_TENTATIVAS);

      const atualizada = await lerConexao(prisma);
      if (!atualizada) {
        throw new ErroDoBling("A conexão com o Bling foi removida.", null, true);
      }

      if (!precisaRenovar(atualizada)) return atualizada.accessToken;
    }

    throw new ErroDoBling(
      "A renovação do token do Bling demorou demais. Tente de novo em instantes.",
      null
    );
  }

  try {
    const tokens = await renovarTokens(conexao.refreshToken);

    await integracao.update({
      where: { id: conexao.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiraEm: tokens.expiraEm,
        renovandoDesde: null,
        ultimoErro: null,
      },
    });

    return tokens.accessToken;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);

    // A trava sai mesmo em falha: deixá-la presa condenaria a loja a esperar
    // o tempo de abandono a cada tentativa. O erro fica gravado para a tela
    // poder dizer o que houve em vez de só "não funcionou".
    await integracao
      .update({
        where: { id: conexao.id },
        data: { renovandoDesde: null, ultimoErro: mensagem.slice(0, 500) },
      })
      .catch(() => {});

    throw erro;
  }
}

export async function registrarSincronizacao({
  prisma,
  erro,
}: {
  prisma: PrismaClient;
  erro?: string | null;
}): Promise<void> {
  const conexao = await lerConexao(prisma);
  if (!conexao) return;

  await delegate(prisma).update({
    where: { id: conexao.id },
    data: {
      ultimaSincronizacaoEm: new Date(),
      ultimoErro: erro ? erro.slice(0, 500) : null,
    },
  });
}
