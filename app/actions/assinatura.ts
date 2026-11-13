"use server";

import { caminhoDaAssinatura, validarAssinaturaRecebida } from "@/lib/dominio/usuarios/assinatura";
import { paraMensagemSegura } from "@/lib/erros";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * A assinatura de quem esta logado. Cada pessoa so mexe na PROPRIA — nao ha
 * permissao para gravar a assinatura de outro: assinatura e pessoal.
 */

type Resultado<T> = ({ sucesso: true } & T) | { sucesso: false; erro: string };

const SEM_USUARIO = "Seu acesso não está ligado a um usuário desta loja; peça ao administrador para revisar.";

export async function obterMinhaAssinatura(): Promise<Resultado<{ url: string | null }>> {
  try {
    const contexto = await exigirContextoTenant();
    const usuarioId = contexto.usuarioOperacional.id;
    if (!usuarioId) return { sucesso: true, url: null };
    const linha = await contexto.prisma.assinaturaUsuario.findUnique({
      where: { usuarioId },
      select: { atualizadoEm: true },
    });
    return { sucesso: true, url: linha ? caminhoDaAssinatura(usuarioId, linha.atualizadoEm.getTime()) : null };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function salvarMinhaAssinatura(dados: FormData): Promise<Resultado<{ url: string }>> {
  try {
    const contexto = await exigirContextoTenant();
    const usuarioId = contexto.usuarioOperacional.id;
    if (!usuarioId) return { sucesso: false, erro: SEM_USUARIO };

    const arquivo = dados.get("arquivo");
    if (!(arquivo instanceof File)) return { sucesso: false, erro: "Nenhuma assinatura foi recebida." };
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const validacao = validarAssinaturaRecebida(bytes);
    if (!validacao.ok) return { sucesso: false, erro: validacao.erro };

    const conteudo = Buffer.from(bytes);
    const gravada = await contexto.prisma.assinaturaUsuario.upsert({
      where: { usuarioId },
      create: { usuarioId, conteudo, tipoConteudo: validacao.tipo, tamanhoBytes: bytes.length },
      update: { conteudo, tipoConteudo: validacao.tipo, tamanhoBytes: bytes.length },
      select: { atualizadoEm: true },
    });
    return { sucesso: true, url: caminhoDaAssinatura(usuarioId, gravada.atualizadoEm.getTime()) };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function removerMinhaAssinatura(): Promise<Resultado<object>> {
  try {
    const contexto = await exigirContextoTenant();
    const usuarioId = contexto.usuarioOperacional.id;
    if (!usuarioId) return { sucesso: false, erro: SEM_USUARIO };
    await contexto.prisma.assinaturaUsuario.deleteMany({ where: { usuarioId } });
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}
