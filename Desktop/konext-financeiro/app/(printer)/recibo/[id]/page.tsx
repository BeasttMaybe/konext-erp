import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ImpressaoAutomaticaRecibo } from "@/components/pdv/impressao-automatica-recibo";

type PropsReciboPage = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    autoprint?: string;
    embed?: string;
  }>;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const formatarDataHora = (data: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);

const formatarFormaPagamento = (formaPagamento: string) => {
  const mapa: Record<string, string> = {
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    CARTAO_DEBITO: "Cartão de Débito",
    CARTAO_CREDITO: "Cartão de Crédito",
    BOLETO: "Boleto",
    CREDIARIO: "Crediário",
    EMPENHO_PUBLICO: "Empenho Público",
  };

  return mapa[formaPagamento] ?? formaPagamento;
};

export default async function ReciboPage({ params, searchParams }: PropsReciboPage) {
  const { id } = await params;
  const filtros = searchParams ? await searchParams : undefined;
  const autoPrint = filtros?.autoprint === "1";
  const embed = filtros?.embed === "1";

  const venda = await prisma.venda.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
          documento: true,
        },
      },
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
            },
          },
        },
      },
    },
  });

  if (!venda) {
    notFound();
  }

  return (
    <div
      className={
        embed
          ? "min-h-screen bg-white text-black p-2"
          : "min-h-screen bg-background text-foreground p-4 print:p-0 print:bg-white print:text-black"
      }
    >
      {autoPrint && <ImpressaoAutomaticaRecibo />}

      <style>{`
        ${embed ? `
          aside,
          nav,
          header,
          [role="banner"],
          [role="complementary"],
          [role="contentinfo"] {
            display: none !important;
          }

          body,
          html,
          main {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
        ` : ""}

        @media print {
          aside,
          nav,
          header,
          [role="banner"],
          [role="complementary"],
          [role="contentinfo"],
          .print-hidden {
            display: none !important;
          }

          body,
          html,
          main {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div
        className={`mx-auto bg-white text-black border border-zinc-300 rounded-md p-4 max-w-[340px] print:max-w-[80mm] print:border-0 print:rounded-none ${
          embed ? "max-w-full" : ""
        }`}
      >
        <div className="text-center border-b border-zinc-300 pb-3 mb-3">
          <p className="text-lg font-bold">KONEXT</p>
          <p className="text-xs">Recibo de Venda</p>
          <p className="text-xs mt-1">{formatarDataHora(venda.criadoEm)}</p>
          <p className="text-xs">Venda #{String(venda.id).slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="space-y-1 text-xs mb-3">
          <p>
            <span className="font-semibold">Cliente:</span>{" "}
            {venda.cliente?.nomeRazaoSocial ?? "Não identificado"}
          </p>
          <p>
            <span className="font-semibold">Documento:</span>{" "}
            {venda.cliente?.documento ?? "-"}
          </p>
          <p>
            <span className="font-semibold">Pagamento:</span>{" "}
            {formatarFormaPagamento(venda.formaPagamento)}
          </p>
        </div>

        <div className="border-t border-b border-zinc-300 py-2 mb-3">
          {venda.itens.length === 0 && (
            <p className="text-xs">Sem itens detalhados.</p>
          )}

          {venda.itens.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs py-1">
              <div className="min-w-0">
                <p className="font-medium truncate">{item.produto.nome}</p>
                <p className="text-[11px] text-zinc-600">
                  {item.quantidade}x {formatarMoeda(item.precoUnitario)}
                </p>
              </div>
              <p className="font-semibold whitespace-nowrap">{formatarMoeda(item.subtotal)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatarMoeda(venda.valorTotal + (venda.desconto ?? 0))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Desconto</span>
            <span>- {formatarMoeda(venda.desconto ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between font-bold border-t border-zinc-300 pt-2 mt-2">
            <span>Total</span>
            <span>{formatarMoeda(venda.valorTotal)}</span>
          </div>
        </div>

        <p className="text-[11px] text-center text-zinc-600 mt-4">Obrigado pela preferência.</p>
      </div>

      {!embed && (
        <div className="print-hidden mt-4 text-center text-xs text-muted-foreground">
          {autoPrint
            ? "O recibo foi aberto em modo de impressao automatica."
            : "Visualizacao de recibo pronta para impressao."}
        </div>
      )}
    </div>
  );
}
