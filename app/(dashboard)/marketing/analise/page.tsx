import { PainelAnalise } from "@/components/marketing/painel-analise";

export const metadata = { title: "Análise & Dicas | Marketing | TechOS" };

export default function AnaliseMarketingPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Análise & Dicas</h1>
        <p className="text-sm text-kx-legenda">O que melhorar para aparecer mais no Google e atrair clientes — com base nos seus dados reais.</p>
      </div>
      <PainelAnalise />
    </div>
  );
}
