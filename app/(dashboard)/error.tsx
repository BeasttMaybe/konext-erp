"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Limite de erro do grupo (dashboard) (F-20): antes, qualquer excecao nao
 * tratada numa pagina interna derrubava a tela inteira na pagina de erro
 * generica do Next. A mensagem real nunca aparece aqui de proposito — o
 * Next ja oculta `error.message` de Server Components em producao, e o
 * detalhe fica no log do servidor (console.error) para investigacao.
 */
export default function ErroDashboard({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] erro não tratado:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ocorreu um erro inesperado ao carregar esta página. Tente novamente ou volte para o início.
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
  );
}
