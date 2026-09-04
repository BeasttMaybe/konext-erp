import type { ModeloImpressaoOS } from "@prisma/client";

export function resolverModeloImpressao(
  valorParam: string | string[] | undefined,
  modeloPadrao: ModeloImpressaoOS
): ModeloImpressaoOS {
  const valor = Array.isArray(valorParam) ? valorParam[0] : valorParam;

  switch (valor) {
    case "a4":
      return "A4";
    case "termica":
      return "TERMICA_80MM";
    default:
      return modeloPadrao;
  }
}
