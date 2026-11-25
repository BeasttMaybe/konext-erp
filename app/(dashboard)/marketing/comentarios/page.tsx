import Link from "next/link";
import { Plug } from "lucide-react";

import { obterPostsComentarios } from "@/app/actions/marketing";
import { ComentariosPosts } from "@/components/marketing/comentarios-posts";

export const metadata = { title: "Comentários | Marketing | TechOS" };

function AvisoConectar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
        <Plug className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-bold text-kx-texto">{titulo}</p>
      <p className="max-w-md text-sm text-kx-legenda">{texto}</p>
      <Link href="/marketing/conexoes" className="rounded-kx-botao bg-kx-primaria px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
        Ir para Conexões
      </Link>
    </div>
  );
}

export default async function ComentariosPage() {
  const dados = await obterPostsComentarios();

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Comentários dos posts</h1>
        <p className="text-sm text-kx-legenda">Veja os comentários dos seus posts no Instagram e responda (com ajuda da IA) ou oculte.</p>
      </div>

      {dados.ok ? (
        <ComentariosPosts inicial={{ conta: dados.conta, posts: dados.posts, proximoCursor: dados.proximoCursor }} />
      ) : dados.motivo === "SEM_CHAVE" ? (
        <AvisoConectar
          titulo="Conecte a Zernio para ver os comentários"
          texto="O ERP lê os comentários dos seus posts pela Zernio. Conecte a sua chave em Conexões."
        />
      ) : dados.motivo === "SEM_CONTA" ? (
        <AvisoConectar
          titulo="Ligue o Instagram na Zernio"
          texto="A Zernio está conectada, mas o Instagram ainda não aparece entre as contas. Ligue-o em zernio.com e volte aqui."
        />
      ) : (
        <p className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-6 text-center text-sm text-kx-legenda">{dados.erro}</p>
      )}
    </div>
  );
}
