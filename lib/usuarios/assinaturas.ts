import "server-only";

import { assinanteDaOS, caminhoDaAssinatura, type AssinaturaDoDocumento, type Assinante } from "@/lib/dominio/usuarios/assinatura";
import type { PrismaClient } from "@prisma/client";

type ComAssinaturas = Pick<PrismaClient, "assinaturaUsuario">;

/**
 * Endereco da assinatura de cada usuario pedido (so quem tem uma). Le so o id
 * e a data — nunca os bytes, que ficam para a rota /assinatura.
 */
export async function enderecosDasAssinaturas(prisma: ComAssinaturas, usuarioIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const linhas = await prisma.assinaturaUsuario.findMany({
    where: { usuarioId: { in: ids } },
    select: { usuarioId: true, atualizadoEm: true },
  });
  return new Map(linhas.map((l) => [l.usuarioId, caminhoDaAssinatura(l.usuarioId, l.atualizadoEm.getTime())]));
}

/** O bloco de assinatura de um documento, para quem assina (ou `null`). */
export async function assinaturaDoDocumento(
  prisma: ComAssinaturas,
  assinante: Assinante | null
): Promise<AssinaturaDoDocumento | null> {
  if (!assinante) return null;
  const enderecos = await enderecosDasAssinaturas(prisma, [assinante.usuarioId]);
  return { nome: assinante.nome, url: enderecos.get(assinante.usuarioId) ?? null };
}

/**
 * Assinatura de quem responde pela OS (tecnico principal; sem tecnico, quem
 * abriu) — para documentos que nao carregam a OS inteira, como o termo.
 */
export async function assinaturaDaOS(
  prisma: ComAssinaturas & Pick<PrismaClient, "ordemServico">,
  osId: string
): Promise<AssinaturaDoDocumento | null> {
  const os = await prisma.ordemServico.findUnique({
    where: { id: osId },
    select: {
      tecnicos: { select: { principal: true, usuario: { select: { id: true, nome: true } } }, orderBy: { criadoEm: "asc" } },
      criadoPor: { select: { id: true, nome: true } },
    },
  });
  if (!os) return null;
  return assinaturaDoDocumento(prisma, assinanteDaOS(os));
}
