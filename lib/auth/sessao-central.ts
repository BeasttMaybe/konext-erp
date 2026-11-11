// NUNCA "use server" aqui.
//
// Este arquivo comecava com a diretiva, e ela transforma TODA funcao async
// exportada em Server Action -- ou seja, em endpoint HTTP que qualquer um na
// internet pode chamar com os argumentos que quiser. `criarSessaoCentral`
// recebe um id de usuario e devolve um cookie de sessao valido para ele, sem
// pedir senha: como endpoint, e login sem senha para qualquer conta.
//
// O que impedia a exploracao era so o identificador da action nao ir para o
// navegador (nenhum componente de cliente importa este modulo) e ser sorteado
// a cada build. A documentacao do Next e explicita em nao confiar nisso:
// "treat Server Actions as reachable via direct POST requests".
//
// `server-only` faz o contrario da diretiva: quebra o BUILD se um componente
// de cliente importar este modulo. Guardado por
// lib/auth/modulos-de-servidor-nao-sao-actions.test.ts.
import "server-only";


import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import { prismaCentral } from "@/lib/central/prisma-central";
import { COOKIE_SESSAO_CENTRAL } from "@/lib/auth/cookies";
import { precisaRegistrarUso } from "@/lib/auth/uso-da-sessao";

/** "Manter conectado neste computador" marcado: sessao de 7 dias, cookie persistente. */
const DURACAO_SESSAO_LONGA_MS = 1000 * 60 * 60 * 24 * 7;
/** Checkbox desmarcado (padrao): sessao curta de 12h, cookie de sessao do navegador (sem maxAge). */
const DURACAO_SESSAO_CURTA_MS = 1000 * 60 * 60 * 12;

export type SessaoCentralResolvida = {
  id: string;
  usuarioCentralId: string;
  usuarioNome: string;
  usuarioEmail: string;
  empresaId: string;
  empresaSlug: string;
  tenantId: string;
  tenantSlug: string;
  connectionRef: string;
  role: string;
  expiraEm: Date;
};

function gerarTokenSessao(): string {
  return randomBytes(32).toString("base64url");
}

function gerarHashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function criarSessaoCentral(params: {
  usuarioCentralId: string;
  empresaId: string;
  tenantId: string;
  role: "ADMIN" | "GESTOR" | "USUARIO";
  /** "Manter conectado neste computador" do formulario de login (Fase 1B-FIX, Parte 4.5). */
  manterConectado: boolean;
}): Promise<void> {
  const token = gerarTokenSessao();
  const tokenHash = gerarHashToken(token);
  const duracaoMs = params.manterConectado ? DURACAO_SESSAO_LONGA_MS : DURACAO_SESSAO_CURTA_MS;
  const expiraEm = new Date(Date.now() + duracaoMs);

  await prismaCentral.sessaoCentral.create({
    data: {
      tokenHash,
      usuarioCentralId: params.usuarioCentralId,
      empresaId: params.empresaId,
      tenantId: params.tenantId,
      role: params.role,
      expiraEm,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESSAO_CENTRAL, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Sem "manter conectado", o cookie nao leva maxAge: dura so a sessao do
    // navegador. O servidor tambem limita expiraEm a 12h, entao mesmo um
    // navegador configurado para restaurar abas nao estende a sessao alem
    // disso.
    ...(params.manterConectado ? { maxAge: Math.floor(duracaoMs / 1000) } : {}),
  });
}

export async function obterSessaoCentral(): Promise<SessaoCentralResolvida | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO_CENTRAL)?.value;

  if (!token) {
    return null;
  }

  return resolverSessaoPeloHash(gerarHashToken(token));
}

/**
 * A resolucao de verdade, memorizada POR REQUISICAO.
 *
 * O QUE ISTO ECONOMIZA
 *
 * Resolver a sessao custa uma leitura, mais quatro em paralelo, no banco
 * central. E a sessao era resolvida do zero a cada chamada: o layout resolve,
 * a pagina resolve, e cada action de dados que a pagina chama resolve de
 * novo. A tela inicial sozinha fazia isso cinco vezes — vinte e cinco
 * consultas e cinco escritas para descobrir, cinco vezes, quem esta logado.
 *
 * `cache()` do React guarda o resultado dentro da MESMA renderizacao, e joga
 * fora no fim dela: a segunda chamada em diante recebe a mesma promessa.
 * Nada atravessa para a proxima requisicao, entao uma sessao revogada ou um
 * usuario desativado continuam valendo a partir do proximo clique — o mesmo
 * raciocinio de `resolverPermissoesEfetivas`, que ja funcionava assim.
 *
 * A chave e o HASH do token, e nao "a sessao atual": mesmo que um dia duas
 * resolucoes de usuarios diferentes compartilhassem um escopo, cada token
 * teria a sua entrada.
 *
 * Fora de renderizacao (dentro de uma Server Action ou Route Handler) o
 * `cache()` nao tem escopo e simplesmente executa a funcao — comportamento
 * identico ao de antes.
 */
const resolverSessaoPeloHash = cache(async (tokenHash: string): Promise<SessaoCentralResolvida | null> => {
  const agora = new Date();

  const sessao = await prismaCentral.sessaoCentral.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usuarioCentralId: true,
      empresaId: true,
      tenantId: true,
      role: true,
      expiraEm: true,
      revogadaEm: true,
      ultimoUsoEm: true,
    },
  });

  if (!sessao || sessao.revogadaEm || sessao.expiraEm <= agora) {
    return null;
  }

  const [usuarioCentral, empresa, tenant, vinculo] = await Promise.all([
    prismaCentral.usuarioCentral.findUnique({
      where: { id: sessao.usuarioCentralId },
      select: { id: true, nome: true, email: true, ativo: true },
    }),
    prismaCentral.empresa.findUnique({
      where: { id: sessao.empresaId },
      select: { id: true, slug: true, status: true },
    }),
    prismaCentral.tenant.findUnique({
      where: { id: sessao.tenantId },
      select: { id: true, slug: true, status: true, connectionRef: true },
    }),
    prismaCentral.usuarioEmpresa.findUnique({
      where: {
        usuarioId_empresaId: {
          usuarioId: sessao.usuarioCentralId,
          empresaId: sessao.empresaId,
        },
      },
      select: { ativo: true, role: true },
    }),
  ]);

  if (
    !usuarioCentral?.ativo ||
    !empresa ||
    empresa.status !== "ATIVA" ||
    !tenant ||
    tenant.status !== "ATIVO" ||
    !tenant.connectionRef ||
    !vinculo?.ativo
  ) {
    return null;
  }

  if (precisaRegistrarUso(sessao.ultimoUsoEm, agora)) {
    // Melhor esforco: "ultimo acesso" e informacao de tela. Uma falha ao
    // grava-la nao pode derrubar a requisicao de quem esta trabalhando —
    // antes, um soluco do banco central aqui virava tela de erro.
    await prismaCentral.sessaoCentral
      .update({ where: { id: sessao.id }, data: { ultimoUsoEm: agora } })
      .catch((erro: unknown) => {
        console.error("[sessao] nao foi possivel registrar o ultimo uso:", erro);
      });
  }

  return {
    id: sessao.id,
    usuarioCentralId: usuarioCentral.id,
    usuarioNome: usuarioCentral.nome,
    usuarioEmail: usuarioCentral.email,
    empresaId: empresa.id,
    empresaSlug: empresa.slug,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    connectionRef: tenant.connectionRef,
    role: vinculo.role,
    expiraEm: sessao.expiraEm,
  };
});

export async function revogarSessaoCentralAtual(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO_CENTRAL)?.value;

  if (token) {
    const tokenHash = gerarHashToken(token);
    await prismaCentral.sessaoCentral.updateMany({
      where: {
        tokenHash,
        revogadaEm: null,
      },
      data: {
        revogadaEm: new Date(),
      },
    });
  }

  cookieStore.delete(COOKIE_SESSAO_CENTRAL);
}

/**
 * Exige sessao central valida. Unico conceito de identidade autenticadora do sistema.
 *
 * Sem sessao valida, redireciona para o login em vez de lancar (F-20): antes
 * a chamada lancava um Error puro que, sem `error.tsx`/tratamento, derrubava
 * a pagina inteira na tela de erro generica do Next em vez de mandar o
 * usuario para o login.
 *
 * O redirecionamento passa por /api/auth/expirar-sessao (Route Handler) em
 * vez de apagar o cookie aqui e ir direto pro /login: esta funcao e chamada
 * tanto de dentro de Server Actions (onde apagar cookie e permitido) quanto
 * — via exigirContextoTenant, de todo layout/pagina protegida — durante a
 * renderizacao comum de Server Component, onde NAO e (o Next.js so deixa
 * mutar cookie numa Server Action ou num Route Handler; fazia isso direto
 * aqui e a pagina quebrava com "Cookies can only be modified..." em vez de
 * mandar pro login). O Route Handler funciona nos dois casos por igual, sem
 * a funcao precisar saber de onde foi chamada.
 */
export async function exigirSessaoCentral(): Promise<SessaoCentralResolvida> {
  const sessao = await obterSessaoCentral();

  if (!sessao) {
    redirect("/api/auth/expirar-sessao");
  }

  return sessao;
}
