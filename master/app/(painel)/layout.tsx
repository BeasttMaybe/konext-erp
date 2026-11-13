import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { sair } from "~/app/login/acoes";
import { exigirAdministrador } from "~/lib/sessao";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const administrador = await exigirAdministrador();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-borda bg-fundo/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <ShieldCheck className="h-5 w-5 text-destaque" aria-hidden />
            TechOS Master
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="hidden truncate text-texto-2 sm:inline">{administrador.nome}</span>
            <form action={sair}>
              <button type="submit" className="flex items-center gap-1.5 rounded-lg border border-borda px-3 py-1.5 text-texto-2 hover:text-texto">
                <LogOut className="h-4 w-4" aria-hidden />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
