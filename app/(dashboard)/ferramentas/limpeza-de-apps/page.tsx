import { LimpezaDeApps } from "@/components/ferramentas/limpeza-de-apps";

export const metadata = { title: "Limpeza de apps | TechOS" };

export default function LimpezaDeAppsPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <LimpezaDeApps />
    </div>
  );
}
