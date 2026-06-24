import { notFound } from "next/navigation";
import Link from "next/link";
import { obterContextoGarantiaOS, obterTermoGarantiaOS } from "@/app/actions/garantias";
import { AcaoGarantiaOS } from "@/components/os/garantias/acao-garantia-os";
import { BotaoImprimirGarantia } from "@/components/os/garantias/botao-imprimir-garantia";
import { TermoGarantiaDocumento } from "@/components/os/garantias/termo-garantia-documento";
import { Button } from "@/components/ui/button";

type PropsPaginaGarantia = {
  params: Promise<{ id: string }>;
};

export default async function PaginaGarantiaOS({ params }: PropsPaginaGarantia) {
  const { id } = await params;
  const [termo, contexto] = await Promise.all([
    obterTermoGarantiaOS(id),
    obterContextoGarantiaOS(id),
  ]);

  if (!contexto) {
    notFound();
  }

  if (!termo) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Termo de garantia ainda nao gerado.</h1>
          <p className="mt-2 text-sm text-slate-600">
            A OS {contexto.numeroOS} ainda nao possui termo de garantia cadastrado.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/os/${contexto.osId}`}>Voltar para OS</Link>
            </Button>
            <AcaoGarantiaOS
              osId={contexto.osId}
              statusOS={contexto.statusOS}
              possuiTermoGarantia={false}
              possuiItens={contexto.possuiItens}
              mostrarTextoBloqueio
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        html, body {
          background-color: #ffffff !important;
          color: #000000 !important;
          color-scheme: light !important;
        }

        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          aside, nav, header, footer,
          [role="banner"], [role="complementary"], [role="contentinfo"],
          .print-hidden {
            display: none !important;
            visibility: hidden !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .garantia-tela-wrapper {
            padding: 0 !important;
            background: #fff !important;
          }

          .garantia-folha {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 14mm !important;
          }
        }
      `}</style>

      <div className="garantia-tela-wrapper min-h-screen bg-white py-3 px-4 print:py-0 print:px-0">
        <div className="print-hidden w-[210mm] max-w-full mx-auto mb-2 flex justify-end">
          <BotaoImprimirGarantia />
        </div>

        <article className="garantia-folha w-[210mm] min-h-[297mm] mx-auto bg-white text-black border border-zinc-300 shadow-sm rounded p-[14mm] print:rounded-none print:shadow-none print:border-0">
          <TermoGarantiaDocumento termo={termo} />
        </article>
      </div>
    </>
  );
}