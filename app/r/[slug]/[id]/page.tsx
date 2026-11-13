import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buscarOsPublica, PaginaRastreio } from "@/components/rastreio/pagina-rastreio";
import { abrirTenantPorSlug } from "@/lib/tenant/tenant-publico-por-slug";

/**
 * O rastreio público, agora de qualquer loja.
 *
 * `/r/<loja>/<os>` — curto de propósito, porque este link vai por WhatsApp.
 *
 * O slug existe aqui pela mesma razão do link de foto: cada loja tem o
 * próprio banco e uma rota sem sessão não tem como saber qual é. A rota
 * antiga, `/rastreio/<os>`, servia só o banco do tenant principal e trazia
 * um comentário dizendo exatamente isso — que faltava "identificador
 * publico seguro". Agora existe, e ela continua de pé só pelos links que já
 * foram mandados pros clientes.
 *
 * O id da OS continua sendo o identificador: são 122 bits sorteados, ele já
 * está impresso em comprovante e mandado por mensagem, e trocá-lo por um
 * token novo invalidaria todo link que um cliente guardou.
 */
export const dynamic = "force-dynamic";

/** Só letras minúsculas, números e hífen — o formato de slug do cadastro. */
const PADRAO_DE_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

async function carregar(slug: string, id: string) {
  // Filtro antes do banco: qualquer pessoa pode chamar esta URL com o que
  // quiser, e lixo não deve virar consulta.
  if (!PADRAO_DE_SLUG.test(slug)) return null;
  if (!id || id.length < 10) return null;

  const loja = await abrirTenantPorSlug(slug);
  if (!loja) return null;

  const os = await buscarOsPublica(loja.prisma, id);
  return os ? { ...os, nomeDaLoja: loja.empresaNome } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const os = await carregar(slug, id);

  // `noindex` sempre: a página mostra o aparelho e o primeiro nome de uma
  // pessoa, e não tem nada que deva aparecer em busca.
  const robots = { index: false, follow: false } as const;

  if (!os) return { title: "OS não encontrada | TechOS", robots };

  return {
    title: `Rastreio OS #${os.numeroOs} | ${os.nomeDaLoja}`,
    description: "Acompanhe o status do reparo do seu equipamento.",
    robots,
  };
}

export default async function RastreioDaLoja({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  if (!PADRAO_DE_SLUG.test(slug)) notFound();

  return <PaginaRastreio os={await carregar(slug, id)} />;
}
