import { RomSamsung } from "@/components/ferramentas/rom-samsung";

export const metadata = { title: "Rom Samsung | TechOS" };

export default function RomSamsungPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <RomSamsung />
    </div>
  );
}
