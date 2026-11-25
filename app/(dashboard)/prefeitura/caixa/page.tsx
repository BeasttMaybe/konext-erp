import { HandCoins, Landmark } from "lucide-react";

import { obterCaixaPrefeitura } from "@/app/actions/prefeitura";
import { CaixaBloco } from "@/components/prefeitura/caixa-bloco";

export const metadata = { title: "Caixa | Prefeitura | TechOS" };

export default async function CaixaPrefeituraPage() {
  const caixa = await obterCaixaPrefeitura();

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-kx-legenda">
          <Landmark className="h-3.5 w-3.5" /> Prefeitura
        </span>
        <h1 className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight text-kx-texto">
          <HandCoins className="h-5 w-5" aria-hidden /> Caixa
        </h1>
        <p className="text-sm text-kx-legenda">
          Posição atual das contas a receber da prefeitura: o que há a receber, o que venceu, o que já entrou e em quantos dias, em média, a
          prefeitura paga.
        </p>
      </div>

      <CaixaBloco caixa={caixa} />
    </div>
  );
}
