"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { escopoOrdemServico } from "@/lib/auth/escopos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { sortearSegredoDoLink } from "@/lib/fotos/token-de-envio";
import { gerarQrCodeSvg } from "@/lib/fotos/qrcode-do-link";
import { urlBaseDaRequisicao } from "@/lib/url-da-requisicao";
import { HORAS_DE_VALIDADE_DO_LINK, situacaoDoLink } from "@/lib/dominio/os/fotos";
import { montarUrlDoLink } from "@/lib/dominio/os/link-de-foto";

/**
 * O link de envio de foto pelo celular, do lado de dentro.
 *
 * Criar e revogar exigem sessão, permissão e escopo da OS. O lado público —
 * abrir o link e mandar a foto — mora em `app/actions/foto-pelo-celular.ts`
 * e não compartilha nada daqui, de propósito: misturar as duas metades num
 * arquivo só é como um caminho autenticado vira público por descuido.
 */

export type LinkDeFoto = {
  id: string;
  situacao: "VALIDO" | "EXPIRADO" | "REVOGADO";
  expiraEm: string;
  criadoEm: string;
  ultimoUsoEm: string | null;
  criadoPorNome: string | null;
};

export type LinkRecemCriado = {
  /**
   * A URL completa, com o segredo.
   *
   * Devolvida UMA vez, só nesta resposta. O banco guarda o hash, então nem
   * esta action nem nenhuma outra consegue mostrar o link de novo depois —
   * fechou a tela, gera outro. É o mesmo contrato de uma senha.
   */
  url: string;
  qrCodeSvg: string | null;
  expiraEm: string;
};

export type ResultadoLink =
  | { sucesso: true; link: LinkRecemCriado }
  | { sucesso: false; erro: string };

async function exigirOrdemVisivel(ordemServicoId: string) {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "os.ver");

  const ordem = await contexto.prisma.ordemServico.findFirst({
    where: { AND: [{ id: ordemServicoId }, escopoOrdemServico(contexto)] },
    select: { id: true, numeroOs: true },
  });

  return { contexto, ordem };
}

/** Os links já criados pra esta OS, pra tela poder revogar o que está solto. */
export async function listarLinksDaOS(ordemServicoId: string): Promise<LinkDeFoto[]> {
  const { contexto, ordem } = await exigirOrdemVisivel(ordemServicoId);
  if (!ordem) return [];

  const agora = new Date();

  const tokens = await contexto.prisma.tokenFotoOS.findMany({
    where: { ordemServicoId },
    orderBy: { criadoEm: "desc" },
    take: 10,
    select: {
      id: true,
      expiraEm: true,
      revogadoEm: true,
      ultimoUsoEm: true,
      criadoEm: true,
      criadoPor: { select: { nome: true } },
    },
  });

  return tokens.map((token) => ({
    id: token.id,
    situacao: situacaoDoLink({ expiraEm: token.expiraEm, revogadoEm: token.revogadoEm, agora }),
    expiraEm: token.expiraEm.toISOString(),
    criadoEm: token.criadoEm.toISOString(),
    ultimoUsoEm: token.ultimoUsoEm?.toISOString() ?? null,
    criadoPorNome: token.criadoPor?.nome ?? null,
  }));
}

/**
 * Cria o link e devolve a URL uma única vez.
 *
 * Revoga os links anteriores da mesma OS no caminho. Dois links vivos pra
 * mesma ordem não servem pra nada e atrapalham: quem revoga o que está na
 * mão do técnico supõe que fechou o acesso, e um link antigo esquecido num
 * grupo de WhatsApp continuaria aberto.
 */
export async function criarLinkDeFotos(ordemServicoId: string): Promise<ResultadoLink> {
  try {
    const { contexto, ordem } = await exigirOrdemVisivel(ordemServicoId);
    exigirPermissao(contexto, "os.editar");

    if (!ordem) return { sucesso: false, erro: "Ordem de serviço não encontrada." };

    // `tenantSlug` já vem resolvido no contexto da sessão — este trecho
    // consultava o banco CENTRAL pra buscar um valor que já estava em mãos,
    // somando uma ida ao banco em cada link gerado.
    const slug = contexto.tenantSlug;

    const base = await urlBaseDaRequisicao();
    if (!base) {
      return { sucesso: false, erro: "Não consegui montar o endereço do link." };
    }

    const { segredo, tokenHash } = sortearSegredoDoLink();
    const expiraEm = new Date(Date.now() + HORAS_DE_VALIDADE_DO_LINK * 60 * 60 * 1000);

    await contexto.prisma.$transaction(async (tx) => {
      await tx.tokenFotoOS.updateMany({
        where: { ordemServicoId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });

      const criado = await tx.tokenFotoOS.create({
        data: {
          ordemServicoId,
          tokenHash,
          expiraEm,
          criadoPorId: contexto.usuarioOperacional?.id || null,
        },
        select: { id: true },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/link-foto-os.ts:criarLinkDeFotos"
        ),
        {
          acao: ACOES_AUDITORIA.CRIAR_LINK_FOTO_OS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: ordemServicoId,
          // O SEGREDO NUNCA ENTRA NO LOG. Um log de auditoria é lido por mais
          // gente e guardado por mais tempo que a tabela do token — gravar o
          // link ali desfaria, de uma vez, o motivo de guardar só o hash.
          dadosDepois: { tokenId: criado.id, expiraEm: expiraEm.toISOString() },
        }
      );
    });

    const url = montarUrlDoLink(base, slug, segredo);
    const qrCode = gerarQrCodeSvg(url);

    revalidatePath(`/os/${ordemServicoId}`);

    return {
      sucesso: true,
      link: {
        url,
        qrCodeSvg: qrCode.ok ? qrCode.svg : null,
        expiraEm: expiraEm.toISOString(),
      },
    };
  } catch (erro) {
    console.error("Erro ao criar link de fotos:", erro);
    return { sucesso: false, erro: "Não consegui criar o link." };
  }
}

export async function revogarLinkDeFotos(
  tokenId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");

    // O token é buscado pelo escopo da OS, não só pelo id: sem isso, um id de
    // token de outra ordem (ou de uma ordem que este técnico não enxerga)
    // seria revogável por quem tivesse o número.
    const token = await contexto.prisma.tokenFotoOS.findFirst({
      where: {
        id: tokenId,
        ordemServico: escopoOrdemServico(contexto),
      },
      select: { id: true, ordemServicoId: true, revogadoEm: true },
    });

    if (!token) return { sucesso: false, erro: "Link não encontrado." };
    if (token.revogadoEm) return { sucesso: true };

    await contexto.prisma.$transaction(async (tx) => {
      await tx.tokenFotoOS.update({
        where: { id: token.id },
        data: { revogadoEm: new Date() },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/link-foto-os.ts:revogarLinkDeFotos"
        ),
        {
          acao: ACOES_AUDITORIA.REVOGAR_LINK_FOTO_OS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: token.ordemServicoId,
          dadosDepois: { tokenId: token.id },
        }
      );
    });

    revalidatePath(`/os/${token.ordemServicoId}`);

    return { sucesso: true };
  } catch (erro) {
    console.error("Erro ao revogar link de fotos:", erro);
    return { sucesso: false, erro: "Não consegui revogar o link." };
  }
}

