"use server";

import { revalidatePath } from "next/cache";

import { criarOuContinuarLoja, type ResultadoDaCriacao } from "~/lib/provisionar";
import { central } from "~/lib/prisma-central";
import { exigirAdministrador } from "~/lib/sessao";

export async function criarLoja(dados: {
  nomeDaLoja: string;
  slug: string;
  donoNome: string;
  donoEmail: string;
}): Promise<ResultadoDaCriacao> {
  const administrador = await exigirAdministrador();
  const resultado = await criarOuContinuarLoja(
    {
      nomeDaLoja: String(dados.nomeDaLoja ?? ""),
      slug: String(dados.slug ?? "").trim().toLowerCase(),
      donoNome: String(dados.donoNome ?? ""),
      donoEmail: String(dados.donoEmail ?? ""),
    },
    administrador.id
  );
  revalidatePath("/");
  return resultado;
}

/** Continua uma criacao interrompida, com os dados gravados no inicio dela. */
export async function continuarCriacao(empresaId: string): Promise<ResultadoDaCriacao> {
  const administrador = await exigirAdministrador();
  const inicio = await central().registroMaster.findFirst({
    where: { empresaId, acao: "CRIAR_LOJA_INICIO" },
    orderBy: { criadoEm: "asc" },
    select: { detalhes: true },
  });
  const d = (inicio?.detalhes ?? {}) as Record<string, string>;
  if (!d.slug || !d.donoEmail) return { ok: false, erro: "Não encontrei os dados do início desta criação." };
  const resultado = await criarOuContinuarLoja(
    { nomeDaLoja: d.nomeDaLoja ?? d.slug, slug: d.slug, donoNome: d.donoNome ?? d.donoEmail, donoEmail: d.donoEmail },
    administrador.id
  );
  // Sem revalidatePath aqui: qualquer revalidacao faz o Next re-renderizar a
  // pagina atual ja "no ar", e o aviso que mostra a senha do responsavel
  // (vista uma vez so) sumiria. O botao "Ver a loja" do resultado recarrega.
  return resultado;
}
