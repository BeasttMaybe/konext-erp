import { notFound } from "next/navigation";
import { obterDadosImpressaoOS } from "@/lib/impressao/obter-dados-impressao-os";
import { resolverModeloImpressao } from "@/lib/impressao/resolver-modelo-impressao";
import { OsImpressaoA4 } from "@/components/os/impressao/os-impressao-a4";
import { OsImpressaoTermica } from "@/components/os/impressao/os-impressao-termica";
import { AutoImprimir } from "@/components/os/impressao/auto-imprimir";
import { caminhoDaOS } from "@/lib/dominio/os/link-da-os";
import { gerarQrCodeSvg } from "@/lib/fotos/qrcode-do-link";
import { urlBaseDaRequisicao } from "@/lib/url-da-requisicao";

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

  // QR com o endereco COMPLETO da OS: a camera comum do iPhone reconhece o
  // link sozinha, e o leitor do app aproveita so o id (lib/dominio/os/
  // link-da-os.ts). Sem endereco base, a OS sai sem QR — melhor que um QR
  // que nao abre nada.
  const base = await urlBaseDaRequisicao();
  const qr = base ? gerarQrCodeSvg(`${base}${caminhoDaOS(id)}`) : null;
  const qrCodeSvg = qr?.ok ? qr.svg : null;

  switch (modelo) {
    case "A4":
      return (
        <>
          <AutoImprimir ativar={autoImprimir} />
          <OsImpressaoA4 dados={dados} qrCodeSvg={qrCodeSvg} />
        </>
      );
    case "TERMICA_80MM":
      return (
        <>
          <AutoImprimir ativar={autoImprimir} />
          <OsImpressaoTermica dados={dados} qrCodeSvg={qrCodeSvg} />
        </>
      );
    default: {
      const modeloExaustivo: never = modelo;
      throw new Error(`Modelo de impressão não suportado: ${modeloExaustivo}`);
    }
  }
}
