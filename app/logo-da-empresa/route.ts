import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Serve a logo enviada pela tela Empresa.
 *
 * So para quem esta logado (a loja e descoberta pela sessao). O endereco
 * leva `?v=` que muda a cada envio, por isso o navegador pode guardar a
 * imagem por um ano sem nunca mostrar uma logo velha.
 *
 * `nosniff` + tipo conferido pelos bytes no envio: o navegador trata o
 * arquivo como imagem e nada mais.
 */
export async function GET() {
  let contexto;
  try {
    contexto = await exigirContextoTenant();
  } catch {
    return new Response(null, { status: 401 });
  }

  const logo = await contexto.prisma.logoEmpresa.findUnique({
    where: { id: "principal" },
    select: { conteudo: true, tipoConteudo: true },
  });
  if (!logo) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(logo.conteudo), {
    headers: {
      "Content-Type": logo.tipoConteudo,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
