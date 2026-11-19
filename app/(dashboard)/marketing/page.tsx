import Link from "next/link";
import { BarChart3, CalendarClock, ChevronRight, Megaphone, Plug, Send } from "lucide-react";

import { obterResumoMarketing } from "@/app/actions/marketing";

export const metadata = { title: "Marketing | TechOS" };

const ATALHOS = [
  {
    href: "/marketing/publicacoes",
    nome: "Publicações",
    descricao: "Crie, gere o texto com IA, publique e agende posts no Instagram, TikTok e Perfil do Google.",
    icone: Send,
  },
  {
    href: "/marketing/google",
    nome: "Perfil do Google",
    descricao: "Veja visualizações, ligações e rotas, e responda às avaliações com ajuda da IA.",
    icone: BarChart3,
  },
  {
    href: "/marketing/anuncios",
    nome: "Anúncios",
    descricao: "Monte campanhas pagas no Meta, Google e TikTok. Você revisa e aprova antes de gastar.",
    icone: Megaphone,
  },
  {
    href: "/marketing/conexoes",
    nome: "Conexões",
    descricao: "Conecte a Zernio uma vez e veja as contas da loja (Instagram, TikTok, Google) ao vivo.",
    icone: Plug,
  },
];

export default async function MarketingPage() {
  const resumo = await obterResumoMarketing();
  const indicadores = [
    { rotulo: "Agendadas", valor: resumo.agendadas, icone: CalendarClock },
    { rotulo: "Rascunhos", valor: resumo.rascunhos },
    { rotulo: "Publicadas", valor: resumo.publicadas },
    { rotulo: "Contas conectadas", valor: resumo.conexoesAtivas },
  ];

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Divulgação da loja</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Marketing</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {indicadores.map((i) => (
          <div key={i.rotulo} className="flex flex-col gap-0.5 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">{i.rotulo}</span>
            <span className="text-2xl font-extrabold text-kx-texto">{i.valor}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ATALHOS.map(({ href, nome, descricao, icone: Icone }) => (
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
