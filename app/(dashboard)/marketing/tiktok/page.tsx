import Link from "next/link";
import { Plug } from "lucide-react";

import { obterAnaliseRede, obterMelhorHorario } from "@/app/actions/marketing";
import { PainelAnaliseRede } from "@/components/marketing/painel-analise-rede";
import { MelhorHorario } from "@/components/marketing/melhor-horario";

export const metadata = { title: "TikTok | Marketing | TechOS" };

export default async function TikTokPage() {
  const [r, melhor] = await Promise.all([obterAnaliseRede("TIKTOK", 30), obterMelhorHorario("TIKTOK")]);
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">TikTok</h1>
        <p className="text-sm text-kx-legenda">Desempenho da conta no TikTok — últimos 30 dias.</p>
      </div>

      {r.ok ? (
        <>
          <PainelAnaliseRede analise={r.analise} />
          {melhor.ok ? <MelhorHorario slots={melhor.slots} /> : null}
        </>
      ) : r.motivo === "SEM_CHAVE" || r.motivo === "SEM_CONTA" ? (
        <div className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
            <Plug className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm font-bold text-kx-texto">
            {r.motivo === "SEM_CHAVE" ? "Conecte a Zernio para ver os dados do TikTok" : "Ligue o TikTok na Zernio"}
          </p>
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
