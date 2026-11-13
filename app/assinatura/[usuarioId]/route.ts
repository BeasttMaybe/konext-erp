import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Serve a assinatura de um usuario da loja, para os documentos impressos.
 *
 * So para quem esta logado, e so de usuarios da MESMA loja (o banco e o da
 * loja da sessao). Endereco versionado (?v=), por isso cache longo; e
 * `private`: nao fica em cache compartilhado no caminho.
 */
export async function GET(_requisicao: Request, { params }: { params: Promise<{ usuarioId: string }> }) {
  let contexto;
  try {
    contexto = await exigirContextoTenant();
  } catch {
    return new Response(null, { status: 401 });
  }

  const { usuarioId } = await params;
  const assinatura = await contexto.prisma.assinaturaUsuario.findUnique({
    where: { usuarioId },
    select: { conteudo: true, tipoConteudo: true },
  });
  if (!assinatura) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(assinatura.conteudo), {
    headers: {
      "Content-Type": assinatura.tipoConteudo,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
