import type { Metadata } from "next";

import { CentralDeAjuda } from "@/components/ajuda/central-de-ajuda";

export const metadata: Metadata = { title: "Ajuda" };

export default function PaginaAjuda() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-kx-texto sm:text-3xl">Ajuda</h1>
        <p className="mt-1 text-sm text-kx-legenda">
          Guias passo a passo das tarefas do dia a dia. Cada guia tem um botão que leva direto à tela.
        </p>
      </div>
      <CentralDeAjuda />
    </div>
  );
}
