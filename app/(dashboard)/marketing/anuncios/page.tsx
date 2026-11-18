import { listarPublicacoes } from "@/app/actions/marketing";
import { ListaPublicacoes } from "@/components/marketing/lista-publicacoes";

export const metadata = { title: "Anúncios | Marketing | TechOS" };

export default async function AnunciosPage() {
  const publicacoes = await listarPublicacoes("ANUNCIO_PAGO");
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <ListaPublicacoes publicacoes={publicacoes} tipo="ANUNCIO_PAGO" />
    </div>
  );
}
