import type { ReactNode } from "react";
import { PackageX } from "lucide-react";

import { moduloPeloId, type IdModulo } from "@/lib/modulos/catalogo";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Porta das telas de um modulo (lib/modulos/catalogo.ts): com o modulo
 * contratado, mostra a tela; sem, um aviso. Usado no layout.tsx da pasta de
 * cada modulo — entrar no modulo por link, favorito ou endereco digitado
 * passa sempre por aqui.
 */
export async function PortaoDoModulo({ modulo, children }: { modulo: IdModulo; children: ReactNode }) {
  const contexto = await exigirContextoTenant();
  if (!contexto.modulosAtivos || contexto.modulosAtivos.has(modulo)) return <>{children}</>;

  const dados = moduloPeloId(modulo);
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-kx-superficie">
        <PackageX className="h-6 w-6 text-kx-legenda" aria-hidden />
      </div>
      <h1 className="text-lg font-bold text-kx-texto">{dados?.nome ?? "Este módulo"} não está no seu plano</h1>
      <p className="max-w-md text-sm text-kx-texto-2">
        {dados?.descricao} Para liberar, fale com o suporte do TechOS.
      </p>
    </div>
  );
}
