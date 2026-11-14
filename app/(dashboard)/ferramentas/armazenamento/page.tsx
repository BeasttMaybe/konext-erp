import { Armazenamento } from "@/components/ferramentas/armazenamento";

export const metadata = { title: "O que está pesando | TechOS" };

export default function ArmazenamentoPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <Armazenamento />
    </div>
  );
}
