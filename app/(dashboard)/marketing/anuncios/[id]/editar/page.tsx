import { notFound } from "next/navigation";

import { obterPublicacao } from "@/app/actions/marketing";
import { CompositorPublicacao } from "@/components/marketing/compositor-publicacao";

export const metadata = { title: "Editar anúncio | TechOS" };

export default async function EditarAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicacao = await obterPublicacao(id);
  if (!publicacao || publicacao.tipo !== "ANUNCIO_PAGO") notFound();
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <CompositorPublicacao tipo="ANUNCIO_PAGO" publicacao={publicacao} />
    </div>
  );
}
