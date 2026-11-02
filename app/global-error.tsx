"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * Limite de erro da raiz (Fase 1B, Parte 5 — F-20): so entra em cena quando
 * o proprio root layout falha. Por isso precisa definir <html>/<body> e
 * importar globals.css — ele SUBSTITUI o layout raiz enquanto ativo, em vez
 * de renderizar dentro dele.
 */
export default function ErroGlobal({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global] erro não tratado na raiz da aplicação:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      {/* Sem carregador de fonte aqui: `--font-geist-sans` nao era lida por CSS
          nenhum do projeto, e isto e justamente a tela que aparece quando o
          layout raiz FALHOU — nao e lugar pra depender de download de fonte. */}
      <body className="antialiased bg-background text-foreground">
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <h1 className="text-lg font-semibold">Algo deu errado</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ocorreu um erro inesperado na aplicação. Tente novamente em instantes.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => unstable_retry()}>
              Tentar novamente
            </Button>
            <Button asChild>
              <Link href="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
