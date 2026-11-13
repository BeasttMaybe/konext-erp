import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

export const metadata = { title: "Ferramentas | TechOS" };

const FERRAMENTAS = [
  {
    href: "/ferramentas/remocao-de-virus",
    nome: "Remoção de Vírus",
    descricao: "Conecte o Android pelo cabo USB, veja os apps de anúncio e vírus e remova direto daqui.",
    icone: ShieldCheck,
  },
];

/** Ferramentas de bancada (modulo "ferramentas" em lib/modulos/catalogo.ts). */
export default function FerramentasPage() {
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Bancada</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Ferramentas</h1>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FERRAMENTAS.map(({ href, nome, descricao, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5 transition-colors hover:border-kx-destaque focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
              <Icone className="h-6 w-6" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-bold text-kx-texto">{nome}</span>
              <span className="text-sm text-kx-legenda">{descricao}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-kx-legenda group-hover:text-kx-texto" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
