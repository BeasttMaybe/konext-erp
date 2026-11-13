import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { exigirAdministrador } from "~/lib/sessao";

import { FormularioLojaNova } from "./formulario";

// Criar o banco no Neon e aplicar as migrations leva de 20 s a 1 min.
export const maxDuration = 300;

export default async function NovaLojaPage() {
  await exigirAdministrador();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Link href="/" className="flex w-fit items-center gap-1.5 text-sm text-texto-2 hover:text-texto">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Lojas
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold">Nova loja</h1>
        <p className="text-sm text-legenda">
          Cria o banco da loja, os cargos padrão e o acesso de administrador do responsável. A loja nasce com todos os módulos ligados.
        </p>
      </div>
      <div className="rounded-xl border border-borda bg-painel p-5">
        <FormularioLojaNova enderecoDoErp={process.env.URL_DO_ERP?.trim() || null} />
      </div>
    </div>
  );
}
