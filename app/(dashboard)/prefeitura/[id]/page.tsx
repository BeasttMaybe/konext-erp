import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { obterNotaPrefeitura } from "@/app/actions/prefeitura";
import { LancarCustos } from "@/components/prefeitura/lancar-custos";
import { formatarReais } from "@/lib/dinheiro";

export const metadata = { title: "Nota da Prefeitura | TechOS" };

type Props = { params: Promise<{ id: string }> };

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default async function NotaPrefeituraPage({ params }: Props) {
  const nota = await obterNotaPrefeitura((await params).id);
  if (!nota) notFound();

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <Link href="/prefeitura" className="flex items-center gap-1.5 text-sm font-bold text-kx-info-texto hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar para a Prefeitura
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Prefeitura · nota de saída</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">
            Nota {nota.numero}
            {nota.serie ? `/${nota.serie}` : ""}
          </h1>
          <p className="text-sm text-kx-legenda">
            {nota.clienteNome ?? "Cliente não identificado"} · {data(nota.dataEmissao)} · Venda {formatarReais(nota.receitaCentavos)}
          </p>
        </div>
        {nota.linkDanfe ? (
          <a
            href={nota.linkDanfe}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-1.5 text-sm font-bold text-kx-texto hover:border-kx-destaque"
          >
            Ver DANFE <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-0.5">
          <h2 className="text-[15px] font-bold text-kx-texto">Custo da nota</h2>
          <span className="text-xs text-kx-legenda">
            Informe o custo por item (ou um total único) para apurar o lucro desta venda. O custo fica salvo e não é sobrescrito nas próximas
            sincronizações.
          </span>
        </div>
        <LancarCustos nota={nota} />
      </div>
    </div>
  );
}
