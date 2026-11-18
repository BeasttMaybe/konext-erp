import { listarPublicacoes } from "@/app/actions/marketing";
import { ListaPublicacoes } from "@/components/marketing/lista-publicacoes";

export const metadata = { title: "Publicações | Marketing | TechOS" };

export default async function PublicacoesPage() {
  const publicacoes = await listarPublicacoes("POST_ORGANICO");
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <ListaPublicacoes publicacoes={publicacoes} tipo="POST_ORGANICO" />
    </div>
  );
}
