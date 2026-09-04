import { notFound } from "next/navigation";
import { obterDadosImpressaoOS } from "@/lib/impressao/obter-dados-impressao-os";
import { resolverModeloImpressao } from "@/lib/impressao/resolver-modelo-impressao";
import { OsImpressaoA4 } from "@/components/os/impressao/os-impressao-a4";
import { OsImpressaoTermica } from "@/components/os/impressao/os-impressao-termica";
import { AutoImprimir } from "@/components/os/impressao/auto-imprimir";

type PropsPaginaImpressaoOS = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaImpressaoOS({ params, searchParams }: PropsPaginaImpressaoOS) {
  const { id } = await params;
  const query = await searchParams;

  const dados = await obterDadosImpressaoOS(id);

  if (!dados) {
    notFound();
  }

  const modelo = resolverModeloImpressao(query.modelo, dados.modeloImpressaoOSPadrao);
  const autoImprimir = query.auto === "1";

  switch (modelo) {
    case "A4":
      return (
        <>
          <AutoImprimir ativar={autoImprimir} />
          <OsImpressaoA4 dados={dados} />
        </>
      );
    case "TERMICA_80MM":
      return (
        <>
          <AutoImprimir ativar={autoImprimir} />
          <OsImpressaoTermica dados={dados} />
        </>
      );
    default: {
      const modeloExaustivo: never = modelo;
      throw new Error(`Modelo de impressão não suportado: ${modeloExaustivo}`);
    }
  }
}
