import "server-only";

import { cache } from "react";

import { prismaCentral } from "@/lib/central/prisma-central";
import { IDS_DE_MODULO, resolverModulosAtivos, type IdModulo } from "@/lib/modulos/catalogo";

/**
 * Modulos ligados da loja (ModuloEmpresa no banco central; regras em
 * lib/modulos/catalogo.ts). Uma leitura por requisicao.
 *
 * Se a leitura falhar, tudo ligado: um soluco do banco central nao pode
 * fechar a loja inteira — o pior caso e alguem usar por alguns segundos um
 * modulo que nao contratou.
 */
export const modulosAtivosDaEmpresa = cache(async (empresaId: string): Promise<ReadonlySet<IdModulo>> => {
  try {
    const gravados = await prismaCentral.moduloEmpresa.findMany({
      where: { empresaId },
      select: { modulo: true, ativo: true },
    });
    return resolverModulosAtivos(gravados);
  } catch (erro) {
    console.error("[modulos] leitura falhou; liberando todos", erro instanceof Error ? erro.message : erro);
    return new Set(IDS_DE_MODULO);
  }
});
