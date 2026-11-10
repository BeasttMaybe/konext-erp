import { notFound } from "next/navigation";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { ImpressaoAutomaticaRecibo } from "@/components/pdv/impressao-automatica-recibo";
import { montarResumoEmpresaDocumentos } from "@/lib/configuracoes-documentos";
import { deDecimal, formatarReais, paraMoeda, somar } from "@/lib/dinheiro";

type PropsReciboPage = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    autoprint?: string;
    embed?: string;
  }>;
};

type VendaReciboView = {
  id: string;
  criadoEm: Date;
  formaPagamento: string;
  valorTotal: number;
  desconto: number;
  cliente: {
    nomeRazaoSocial: string;
    documento: string | null;
  } | null;
  itens: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    produto: {
      nome: string;
    } | null;
  }>;
  pagamentos: Array<{
    formaPagamento: string;
    valorBruto: number;
  }>;
};

// Formatação de dinheiro delega inteiramente pra lib/dinheiro.ts (Fase
// 2A-2) — `venda.valorTotal`/`desconto`/item.*/pagamento.valorBruto já
// chegam convertidos pra número (reais) na borda (carregarVendaRecibo
// abaixo), então formatar aqui é só reconverter pra centavos e formatar.
const formatarMoeda = (valorEmReais: number) => formatarReais(deDecimal(valorEmReais));

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
    NAO_INFORMADO: "Não informado",
  };

  return mapa[formaPagamento] ?? formaPagamento;
};

export default async function ReciboPage({ params, searchParams }: PropsReciboPage) {
  const { prisma } = await exigirContextoTenant();
  const { id } = await params;
  const filtros = searchParams ? await searchParams : undefined;
  const autoPrint = filtros?.autoprint === "1";
  const embed = filtros?.embed === "1";

  const consultaComPagamentos = {
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
      pagamentos: {
        select: {
          formaPagamento: true,
          valorBruto: true,
        },
        orderBy: {
          criadoEm: "asc" as const,
        },
      },
    },
  };

  const consultaLegada = {
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
  };

  const carregarVendaRecibo = async (): Promise<VendaReciboView | null> => {
    try {
      const vendaComPagamentos = await prisma.venda.findUnique(consultaComPagamentos);
      if (!vendaComPagamentos) return null;

      return {
        id: vendaComPagamentos.id,
        criadoEm: vendaComPagamentos.criadoEm,
        formaPagamento: vendaComPagamentos.formaPagamento,
        valorTotal: paraMoeda(deDecimal(vendaComPagamentos.valorTotal)),
        desconto: paraMoeda(deDecimal(vendaComPagamentos.desconto ?? 0)),
        cliente: vendaComPagamentos.cliente
          ? {
              nomeRazaoSocial: vendaComPagamentos.cliente.nomeRazaoSocial,
              documento: vendaComPagamentos.cliente.documento,
            }
          : null,
        itens: vendaComPagamentos.itens.map((item) => ({
          id: item.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          precoUnitario: paraMoeda(deDecimal(item.precoUnitario)),
          subtotal: paraMoeda(deDecimal(item.subtotal)),
          produto: item.produto ? { nome: item.produto.nome } : null,
        })),
        pagamentos: vendaComPagamentos.pagamentos.map((pagamento) => ({
          formaPagamento: pagamento.formaPagamento,
          valorBruto: paraMoeda(deDecimal(pagamento.valorBruto)),
        })),
      };
    } catch {
      const vendaLegada = await prisma.venda.findUnique(consultaLegada);
      if (!vendaLegada) return null;

      return {
        id: vendaLegada.id,
        criadoEm: vendaLegada.criadoEm,
        formaPagamento: vendaLegada.formaPagamento,
        valorTotal: paraMoeda(deDecimal(vendaLegada.valorTotal)),
        desconto: paraMoeda(deDecimal(vendaLegada.desconto ?? 0)),
        cliente: vendaLegada.cliente
          ? {
              nomeRazaoSocial: vendaLegada.cliente.nomeRazaoSocial,
              documento: vendaLegada.cliente.documento,
            }
          : null,
        itens: vendaLegada.itens.map((item) => ({
          id: item.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          precoUnitario: paraMoeda(deDecimal(item.precoUnitario)),
          subtotal: paraMoeda(deDecimal(item.subtotal)),
          produto: item.produto ? { nome: item.produto.nome } : null,
        })),
        pagamentos: [],
      };
    }
  };

  const [venda, configuracao] = await Promise.all([carregarVendaRecibo(), obterConfiguracoes()]);

  if (!venda) {
    notFound();
  }

  const resumoEmpresa = montarResumoEmpresaDocumentos(configuracao);

  return (
    <div
      className={
        embed
          ? "min-h-screen bg-kx-papel text-kx-papel-texto p-2"
          : "min-h-screen bg-background text-foreground p-4 print:p-0 print:bg-kx-papel print:text-kx-papel-texto"
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
            background: var(--kx-papel) !important;
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
            background: var(--kx-papel) !important;
          }
        }
      `}</style>

      <div
        className={`mx-auto bg-kx-papel text-kx-papel-texto border border-kx-papel-borda rounded-md p-4 max-w-[340px] print:max-w-[80mm] print:border-0 print:rounded-none ${
          embed ? "max-w-full" : ""
        }`}
      >
        <div className="text-center border-b border-kx-papel-borda pb-3 mb-3">
          {resumoEmpresa.logoUrl ? (
            <div className="mb-2 flex justify-center">
              <img
                src={resumoEmpresa.logoUrl}
                alt={`Logo ${resumoEmpresa.nomeExibicao}`}
                className="max-h-12 max-w-[120px] object-contain"
              />
            </div>
          ) : null}
          <p className="text-lg font-bold">{resumoEmpresa.nomeExibicao}</p>
          <p className="text-xs">Recibo de Venda</p>
          <p className="mt-1 text-[11px] text-kx-papel-texto-2">{resumoEmpresa.cnpj}</p>
          <p className="text-[11px] text-kx-papel-texto-2">{resumoEmpresa.telefone}</p>
          <p className="text-[11px] text-kx-papel-texto-2">{resumoEmpresa.endereco}</p>
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
          {(venda.pagamentos?.length ?? 0) > 0 ? (
            <div>
              <p>
                <span className="font-semibold">Pagamentos:</span>
              </p>
              {venda.pagamentos?.map((pagamento, indice) => (
                <p key={`${pagamento.formaPagamento}-${indice}`} className="pl-2">
                  {formatarFormaPagamento(pagamento.formaPagamento)}: {formatarMoeda(pagamento.valorBruto)}
                </p>
              ))}
            </div>
          ) : (
            <p>
              <span className="font-semibold">Pagamento:</span>{" "}
              {formatarFormaPagamento(venda.formaPagamento)}
            </p>
          )}
        </div>

        <div className="border-t border-b border-kx-papel-borda py-2 mb-3">
          {venda.itens.length === 0 && (
            <p className="text-xs">Sem itens detalhados.</p>
          )}

          {venda.itens.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs py-1">
              <div className="min-w-0">
                <p className="font-medium truncate">{item.descricao || item.produto?.nome || "Item sem descricao"}</p>
                <p className="text-[11px] text-kx-papel-texto-2">
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
            <span>{formatarMoeda(paraMoeda(somar(deDecimal(venda.valorTotal), deDecimal(venda.desconto ?? 0))))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Desconto</span>
            <span>- {formatarMoeda(venda.desconto ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between font-bold border-t border-kx-papel-borda pt-2 mt-2">
            <span>Total</span>
            <span>{formatarMoeda(venda.valorTotal)}</span>
          </div>
        </div>

        <p className="text-[11px] text-center text-kx-papel-texto-2 mt-4 whitespace-pre-wrap">
          {resumoEmpresa.mensagemCupom || "Obrigado pela preferência."}
        </p>
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
