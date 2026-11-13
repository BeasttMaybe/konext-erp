import { RemocaoDeVirus } from "@/components/ferramentas/remocao-de-virus";

export const metadata = { title: "Remoção de Vírus | TechOS" };

export default function RemocaoDeVirusPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <RemocaoDeVirus />
    </div>
  );
}
