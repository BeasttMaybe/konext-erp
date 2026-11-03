import type { Metadata } from "next";

import { abrirLinkDeFoto } from "@/app/actions/foto-pelo-celular";
import { EnvioPeloCelular } from "@/components/os/fotos/envio-pelo-celular";

/**
 * A página que o celular abre ao ler o QR code.
 *
 * Fora de `(dashboard)` de propósito: não tem menu, não tem barra lateral e
 * não tem sessão. É uma tela de uma coisa só, feita pra uma mão segurando o
 * telefone enquanto a outra segura o aparelho do cliente.
 */

/**
 * Nunca indexada, e nunca guardada por proxy.
 *
 * O endereço tem o segredo dentro. Um buscador que o encontre publica o
 * acesso; um proxy que o guarde entrega o acesso depois de revogado.
 */
export const metadata: Metadata = {
  title: "Enviar fotos | Konext",
  robots: { index: false, follow: false, nocache: true },
};

/** Cada abertura confere o token de novo — nada de página servida de cache. */
export const dynamic = "force-dynamic";

export default async function PaginaEnvioDeFoto({
  params,
}: {
  params: Promise<{ slug: string; segredo: string }>;
}) {
  const { slug, segredo } = await params;
  const abertura = await abrirLinkDeFoto(slug, segredo);

  if (!abertura.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-kx-fundo p-6">
        <div className="w-full max-w-sm space-y-3 rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-6 text-center">
          <h1 className="text-lg font-semibold text-kx-texto">Link indisponível</h1>
          <p className="text-sm text-kx-texto-2">{abertura.erro}</p>
        </div>
      </main>
    );
  }

  return <EnvioPeloCelular slug={slug} segredo={segredo} ordem={abertura.ordem} />;
}
