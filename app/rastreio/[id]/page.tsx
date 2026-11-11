import { notFound, redirect } from "next/navigation";

import { caminhoDeRastreio } from "@/lib/dominio/os/link-de-foto";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

export const dynamic = "force-dynamic";

/**
 * Endereco antigo do rastreio: `/rastreio/<os>`, sem a loja no caminho.
 *
 * O QUE ESTA PAGINA FAZIA
 *
 * Abria a OS num cliente Prisma global, preso a `DATABASE_URL` — o banco da
 * loja principal, sempre, quem quer que estivesse pedindo. Num sistema com
 * um banco por loja, isso e uma leitura que ignora o isolamento: um usuario
 * logado na loja B, de posse de um id de OS da loja A, lia a OS da loja A.
 * Era o ultimo consumidor daquele cliente global (`lib/prisma.ts`), que saiu
 * junto.
 *
 * O QUE FAZ AGORA
 *
 * Nao le banco nenhum. Descobre a loja pela SESSAO de quem abriu e manda para
 * o endereco novo, `/r/<loja>/<os>`, que abre o banco certo. Quem nao tem
 * sessao e mandado ao login pelo proxy antes de chegar aqui — exatamente
 * como ja acontecia, entao nenhum link que funcionava deixa de funcionar.
 */
export default async function RastreioLegado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length < 10) notFound();

  const contexto = await exigirContextoTenant();

  redirect(caminhoDeRastreio(contexto.tenantSlug, id));
}
