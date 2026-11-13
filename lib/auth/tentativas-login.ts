import "server-only";

import { prismaCentral } from "@/lib/central/prisma-central";
import { decidirBloqueio, JANELA_DE_TENTATIVAS_MS, resumoDe, type Bloqueio } from "@/lib/auth/limite-login";

/**
 * Leitura e gravacao das falhas de login (tabela TentativaLoginFalha, banco
 * central). Regras em lib/auth/limite-login.ts.
 *
 * Tudo aqui e best-effort: se o banco falhar ao contar, o login segue como
 * antes (o bcrypt e a senha continuam sendo a protecao principal) — melhor do
 * que ninguem conseguir entrar por causa do contador.
 */

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export async function bloqueioDoLogin(email: string, ip: string, agora = new Date()): Promise<Bloqueio> {
  try {
    const desde = new Date(agora.getTime() - JANELA_DE_TENTATIVAS_MS);
    const [doEmail, doIp] = await Promise.all([
      prismaCentral.tentativaLoginFalha.findMany({
        where: { emailHash: resumoDe(email), criadoEm: { gte: desde } },
        select: { criadoEm: true },
        orderBy: { criadoEm: "desc" },
        take: 50,
      }),
      prismaCentral.tentativaLoginFalha.findMany({
        where: { ipHash: resumoDe(ip), criadoEm: { gte: desde } },
        select: { criadoEm: true },
        orderBy: { criadoEm: "desc" },
        take: 50,
      }),
    ]);
    return decidirBloqueio(
      doEmail.map((f) => f.criadoEm),
      doIp.map((f) => f.criadoEm),
      agora
    );
  } catch (erro) {
    console.error("[auth] limite de login indisponivel", erro instanceof Error ? erro.message : erro);
    return { bloqueado: false };
  }
}

export async function registrarFalhaDeLogin(email: string, ip: string): Promise<void> {
  try {
    await prismaCentral.tentativaLoginFalha.create({
      data: { emailHash: resumoDe(email), ipHash: resumoDe(ip) },
      select: { id: true },
    });
    // Faxina de vez em quando: so a janela importa, um dia e folga de sobra.
    if (Math.random() < 0.05) {
      await prismaCentral.tentativaLoginFalha.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - UM_DIA_MS) } } });
    }
  } catch (erro) {
    console.error("[auth] nao registrou falha de login", erro instanceof Error ? erro.message : erro);
  }
}

export async function zerarFalhasDoEmail(email: string): Promise<void> {
  try {
    await prismaCentral.tentativaLoginFalha.deleteMany({ where: { emailHash: resumoDe(email) } });
  } catch (erro) {
    console.error("[auth] nao zerou falhas de login", erro instanceof Error ? erro.message : erro);
  }
}
