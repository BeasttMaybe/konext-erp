import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { central } from "~/lib/prisma-central";
import { administradorAtual } from "~/lib/sessao";

import { FormularioEntrar, FormularioPrimeiroAcesso } from "./formularios";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await administradorAtual()) redirect("/");
  const primeiroAcesso = (await central().administradorMaster.count()) === 0;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-borda bg-painel p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destaque/15 text-destaque">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-extrabold">Konext Master</h1>
            <p className="text-xs text-legenda">{primeiroAcesso ? "Primeiro acesso" : "Acesso restrito"}</p>
          </div>
        </div>
        {primeiroAcesso ? <FormularioPrimeiroAcesso /> : <FormularioEntrar />}
      </div>
    </main>
  );
}
