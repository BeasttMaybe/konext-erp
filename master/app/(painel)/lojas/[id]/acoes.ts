"use server";

import { revalidatePath } from "next/cache";

import { conferirConfirmacao, operacaoDoModulo, SITUACOES_DA_LOJA, validarModulo, type SituacaoDaLoja } from "~/lib/acoes-regras";
import { central } from "~/lib/prisma-central";
import { exigirAdministrador } from "~/lib/sessao";

export type ResultadoDaAcao = { ok: true } | { ok: false; erro: string };

/**
 * Liga ou desliga um modulo da loja. Vale na proxima tela que alguem da loja
 * abrir (o ERP le ModuloEmpresa a cada requisicao). Fica no historico.
 */
export async function definirModulo(empresaId: string, modulo: string, ativo: boolean): Promise<ResultadoDaAcao> {
  const administrador = await exigirAdministrador();
  if (!validarModulo(modulo)) return { ok: false, erro: "Módulo desconhecido." };
  const db = central();
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
  if (!empresa) return { ok: false, erro: "Loja não encontrada." };

  await db.$transaction(async (tx) => {
    if (operacaoDoModulo(ativo) === "apagar") {
      await tx.moduloEmpresa.deleteMany({ where: { empresaId, modulo } });
    } else {
      await tx.moduloEmpresa.upsert({
        where: { empresaId_modulo: { empresaId, modulo } },
        create: { empresaId, modulo, ativo: false },
        update: { ativo: false },
        select: { empresaId: true },
      });
    }
    await tx.registroMaster.create({
      data: { administradorId: administrador.id, empresaId, acao: ativo ? "LIGAR_MODULO" : "DESLIGAR_MODULO", detalhes: { modulo } },
      select: { id: true },
    });
  });

  revalidatePath(`/lojas/${empresaId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Suspende ou reativa a loja. Suspensa, ninguem da loja entra, e quem esta
 * dentro cai na proxima tela (o ERP confere a situacao a cada requisicao);
 * os links publicos (rastreio, foto) param tambem. Nada e apagado: reativar
 * devolve tudo como estava.
 */
export async function definirSituacaoDaLoja(empresaId: string, situacao: string, confirmacao: string): Promise<ResultadoDaAcao> {
  const administrador = await exigirAdministrador();
  if (!(SITUACOES_DA_LOJA as readonly string[]).includes(situacao)) return { ok: false, erro: "Situação inválida." };
  const db = central();
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { slug: true, status: true } });
  if (!empresa) return { ok: false, erro: "Loja não encontrada." };
  const problema = conferirConfirmacao(situacao as SituacaoDaLoja, confirmacao, empresa.slug);
  if (problema) return { ok: false, erro: problema };
  if (empresa.status === situacao) return { ok: true };

  await db.$transaction(async (tx) => {
    await tx.empresa.update({ where: { id: empresaId }, data: { status: situacao as SituacaoDaLoja }, select: { id: true } });
    await tx.registroMaster.create({
      data: {
        administradorId: administrador.id,
        empresaId,
        acao: situacao === "SUSPENSA" ? "SUSPENDER_LOJA" : "REATIVAR_LOJA",
        detalhes: { antes: empresa.status },
      },
      select: { id: true },
    });
  });

  revalidatePath(`/lojas/${empresaId}`);
  revalidatePath("/");
  return { ok: true };
}
