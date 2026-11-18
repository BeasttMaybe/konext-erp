import { CompositorPublicacao } from "@/components/marketing/compositor-publicacao";

export const metadata = { title: "Nova publicação | TechOS" };

export default function NovaPublicacaoPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <CompositorPublicacao tipo="POST_ORGANICO" />
    </div>
  );
}
