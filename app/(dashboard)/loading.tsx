import { Loader2 } from "lucide-react";

/**
 * UI de carregamento do grupo (dashboard), mostrada pelo Next enquanto a
 * page.tsx da rota busca dados (Fase 1B, Parte 5 — F-20).
 */
export default function CarregandoDashboard() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  );
}
