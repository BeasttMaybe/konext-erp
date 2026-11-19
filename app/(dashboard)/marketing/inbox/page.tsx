import Link from "next/link";
import { Plug } from "lucide-react";

import { obterConversas } from "@/app/actions/marketing";
import { CaixaDeEntrada } from "@/components/marketing/caixa-de-entrada";

export const metadata = { title: "Mensagens | Marketing | TechOS" };

export default async function InboxPage() {
  const r = await obterConversas();
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Mensagens</h1>
        <p className="text-sm text-kx-legenda">Responda os directs das redes num só lugar — com ajuda da IA.</p>
      </div>

      {r.ok ? (
        <CaixaDeEntrada inicial={{ conversas: r.conversas, proximoCursor: r.proximoCursor }} />
      ) : r.motivo === "SEM_CHAVE" ? (
        <div className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
            <Plug className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm font-bold text-kx-texto">Conecte a Zernio para ver as mensagens</p>
          <p className="max-w-md text-sm text-kx-legenda">{r.erro}</p>
          <Link href="/marketing/conexoes" className="rounded-kx-botao bg-kx-primaria px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            Ir para Conexões
          </Link>
        </div>
      ) : (
        <p className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-3 py-2 text-sm text-kx-alerta-texto">{r.erro}</p>
      )}
    </div>
  );
}
