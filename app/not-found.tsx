import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 404 para toda a aplicacao (Fase 1B, Parte 5 — F-20): tambem cobre
 * qualquer URL que nao bate com nenhuma rota, alem dos `notFound()`
 * explicitos dentro de uma rota.
 */
export default function NaoEncontrado() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        O endereço acessado não existe ou foi movido.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
