import { CompositorPublicacao } from "@/components/marketing/compositor-publicacao";

export const metadata = { title: "Novo anúncio | TechOS" };

export default function NovoAnuncioPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <CompositorPublicacao tipo="ANUNCIO_PAGO" />
    </div>
  );
}
