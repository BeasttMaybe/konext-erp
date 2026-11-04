import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buscarOsPublica, PaginaRastreio } from "@/components/rastreio/pagina-rastreio";
import { prisma } from "@/lib/prisma";

/**
 * A rota de rastreio ANTIGA, mantida pelos links que já foram enviados.
 *
 * Ela serve só o banco do tenant principal (`DATABASE_URL`), porque sem o
 * slug da loja na URL não há como descobrir qual banco abrir — era a
 * limitação documentada aqui desde que esta página existe.
 *
 * A rota nova é `/r/<loja>/<os>` e resolve a loja pelo slug. Os botões de
 * "copiar link" e "enviar ao cliente" já geram a forma nova; esta continua
 * de pé porque link de rastreio sai impresso em comprovante e mandado por
 * WhatsApp, e invalidar o que o cliente guardou seria trocar um problema
 * que ninguém tem hoje por um que todo mundo teria amanhã.
 *
 * Nenhuma busca entre bancos é feita aqui, de propósito: uma OS de outra
 * loja simplesmente não é encontrada, que é o comportamento seguro.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const os = await buscarOsPublica(prisma, id);
  const robots = { index: false, follow: false } as const;

  if (!os) return { title: "OS não encontrada | Konext", robots };

  return {
    title: `Rastreio OS #${os.numeroOs} | Konext`,
    description: "Acompanhe o status do reparo do seu equipamento.",
    robots,
  };
}

export default async function RastreioLegado({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || id.length < 10) notFound();

  return <PaginaRastreio os={await buscarOsPublica(prisma, id)} />;
}
