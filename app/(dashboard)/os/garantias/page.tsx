import { redirect } from "next/navigation";

/**
 * Fase 1C-3, Parte 5: Garantia virou uma aba dentro de /os, nao uma rota
 * propria — este redirect existe so pra nao quebrar links e favoritos
 * antigos. Nenhum link novo no codigo aponta mais pra cá (ver
 * lib/navegacao/itens-navegacao.ts, components/dashboard/bloco-garantia.tsx
 * e app/actions/dashboard.ts).
 */
export default function GarantiasOSPage() {
  redirect("/os?modo=garantia");
}
