"use server";

import { revalidatePath } from "next/cache";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { caminhoDaLogo, ehCaminhoDaLogoEnviada, validarLogoRecebida } from "@/lib/dominio/empresa/logo-enviada";
import { SELECAO_SO_O_ID } from "@/lib/configuracoes/campos-lidos";
import { paraMensagemSegura } from "@/lib/erros";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

export type ResultadoLogo = { sucesso: true; logoUrl: string } | { sucesso: false; erro: string };

/**
 * Grava a logo enviada e aponta a configuracao para ela.
 *
 * A logo fica no banco da loja (tabela LogoEmpresa), servida por
 * /logo-da-empresa. Nao vai para o armazenamento de fotos: aquele e
 * opcional e privado (endereco que expira em minutos), e a logo precisa
 * de um endereco fixo para sair em todo documento.
 */
export async function enviarLogoDaEmpresa(dados: FormData): Promise<ResultadoLogo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.empresa");

    const arquivo = dados.get("arquivo");
    if (!(arquivo instanceof File)) return { sucesso: false, erro: "Nenhum arquivo foi recebido." };

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const validacao = validarLogoRecebida(bytes);
    if (!validacao.ok) return { sucesso: false, erro: validacao.erro };

    const configuracao = await contexto.prisma.configuracao.findFirst({
      select: { id: true, logoUrl: true },
      orderBy: { criadoEm: "asc" },
    });
    if (!configuracao) {
      return { sucesso: false, erro: "Salve os dados da empresa uma vez antes de enviar a logo." };
    }

    const logoUrl = caminhoDaLogo(Date.now());
    const conteudo = Buffer.from(bytes);

    await contexto.prisma.$transaction(async (tx) => {
      await tx.logoEmpresa.upsert({
        where: { id: "principal" },
        create: { id: "principal", conteudo, tipoConteudo: validacao.tipo, tamanhoBytes: bytes.length },
        update: { conteudo, tipoConteudo: validacao.tipo, tamanhoBytes: bytes.length },
      });
      await tx.configuracao.update({ where: { id: configuracao.id }, data: { logoUrl }, select: SELECAO_SO_O_ID });
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/logo-empresa.ts:enviarLogoDaEmpresa"),
      {
        acao: ACOES_AUDITORIA.ATUALIZAR_LOGO_EMPRESA,
        entidade: ENTIDADES_AUDITORIA.CONFIGURACAO,
        entidadeId: configuracao.id,
        dadosAntes: { logoUrl: configuracao.logoUrl },
        dadosDepois: { logoUrl, tipoConteudo: validacao.tipo, tamanhoBytes: bytes.length },
      }
    );

    revalidatePath("/", "layout");
    return { sucesso: true, logoUrl };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

/** Tira a logo enviada: apaga o arquivo e limpa o endereco, se apontava para ele. */
export async function removerLogoDaEmpresa(): Promise<{ sucesso: true } | { sucesso: false; erro: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.empresa");

    const configuracao = await contexto.prisma.configuracao.findFirst({
      select: { id: true, logoUrl: true },
      orderBy: { criadoEm: "asc" },
    });

    await contexto.prisma.$transaction(async (tx) => {
      await tx.logoEmpresa.deleteMany({});
      if (configuracao?.logoUrl && ehCaminhoDaLogoEnviada(configuracao.logoUrl)) {
        await tx.configuracao.update({ where: { id: configuracao.id }, data: { logoUrl: null }, select: SELECAO_SO_O_ID });
      }
    });

    if (configuracao) {
      await registrarLogAuditoria(
        contexto.prisma,
        contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/logo-empresa.ts:removerLogoDaEmpresa"),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_LOGO_EMPRESA,
          entidade: ENTIDADES_AUDITORIA.CONFIGURACAO,
          entidadeId: configuracao.id,
          dadosAntes: { logoUrl: configuracao.logoUrl },
          dadosDepois: { logoUrl: null },
        }
      );
    }

    revalidatePath("/", "layout");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}
