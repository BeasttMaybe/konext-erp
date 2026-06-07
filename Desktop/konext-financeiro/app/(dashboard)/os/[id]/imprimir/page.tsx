import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BotaoImprimirPagina } from "@/components/os/botao-imprimir-pagina";

type PropsPaginaImpressaoOS = {
  params: Promise<{
    id: string;
  }>;
};

function extrairNumeroOsDoSlug(entrada: string): number | null {
  const slug = entrada.trim().toLowerCase();
  const match = slug.match(/^os-(\d+)$|^os-\d{4}-(\d+)$/);
  const numeroTexto = match?.[1] ?? match?.[2];
  if (!numeroTexto) return null;
  const numero = Number(numeroTexto);
  return Number.isFinite(numero) ? numero : null;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const mapaStatusLabel: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando Orcamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovacao",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando Peca",
  EM_MANUTENCAO: "Em Manutencao",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

function extrairPontosDesenho(valor: string | null | undefined): number[] {
  if (!valor) return [];
  return valor
    .split(/[^0-9]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 9);
}

export default async function PaginaImpressaoOS({ params }: PropsPaginaImpressaoOS) {
  const { id } = await params;
  const prismaAny = prisma as any;
  const delegateOrdemServico = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!delegateOrdemServico?.findUnique) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  let os = await delegateOrdemServico.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
          documento: true,
          telefone: true,
        },
      },
      itens: true,
    },
  });

  if (!os) {
    const numeroOsSlug = extrairNumeroOsDoSlug(id);

    if (numeroOsSlug !== null && delegateOrdemServico.findFirst) {
      os = await delegateOrdemServico.findFirst({
        where: {
          numeroOs: numeroOsSlug,
        },
        include: {
          cliente: {
            select: {
              nomeRazaoSocial: true,
              documento: true,
              telefone: true,
            },
          },
          itens: true,
        },
      });
    }
  }

  if (!os) {
    notFound();
  }

  const statusAtual = String(os.status);
  const statusLabel = mapaStatusLabel[statusAtual] ?? statusAtual.replaceAll("_", " ");
  const numeroOs = String(os.numeroOs ?? "-");
  const nomeCliente = String(os.cliente?.nomeRazaoSocial ?? "Nao informado");
  const documentoCliente = String(os.cliente?.documento ?? "Nao informado");
  const telefoneCliente = String(os.cliente?.telefone ?? "Nao informado");
  const equipamento = String(os.equipamento ?? "Nao informado");
  const marca = String(os.marca ?? "Nao informado");
  const modelo = String(os.modelo ?? "Nao informado");
  const imei = String(os.imei ?? "Nao informado");
  const senha = String(os.senha ?? "Nao informada");
  const relatoCliente = String(os.relatoCliente ?? "Nao informado");
  const condicaoFisica = String(os.condicaoFisica ?? "Nao informada");
  const acessorios = String(os.acessorios ?? "Nao informado");
  const pontosDesenho = extrairPontosDesenho(String(os.senhaDesenho ?? ""));

  const itens = (os.itens ?? []).map((item: any) => ({
    id: String(item.id),
    descricao: String(item.descricao ?? ""),
    tipoPeca: String(item.tipoPeca ?? "OUTROS").replaceAll("_", " "),
    custoPeca: Number(item.custoPeca ?? 0),
    valorCobrado: Number(item.valorCobrado ?? 0),
  }));

  const totalOS = itens.reduce((total: number, item: { valorCobrado: number }) => total + item.valorCobrado, 0);

  return (
    <>
      <style>{`
        @media print {
          aside,
          nav,
          header,
          [role="banner"],
          [role="complementary"],
          [role="contentinfo"] {
            display: none !important;
          }

          main,
          body,
          html {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-white text-black p-6 print:p-0">
        <div className="max-w-4xl mx-auto border border-zinc-300 rounded-md p-6 print:border-0 print:rounded-none print:p-2">
        <div className="flex items-center justify-between border-b border-zinc-300 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Ordem de Servico</h1>
            <p className="text-sm text-zinc-700 mt-1">Konext ERP</p>
          </div>

          <div className="text-right">
            <p className="text-sm">OS #{numeroOs}</p>
            <p className="text-sm">Status: {statusLabel}</p>
            <p className="text-sm">Data: {new Date(os.criadoEm).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Cliente</h2>
            <p className="text-sm"><span className="font-semibold">Nome:</span> {nomeCliente}</p>
            <p className="text-sm"><span className="font-semibold">Documento:</span> {documentoCliente}</p>
            <p className="text-sm"><span className="font-semibold">Telefone:</span> {telefoneCliente}</p>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Equipamento</h2>
            <p className="text-sm"><span className="font-semibold">Aparelho:</span> {equipamento}</p>
            <p className="text-sm"><span className="font-semibold">Marca:</span> {marca}</p>
            <p className="text-sm"><span className="font-semibold">Modelo:</span> {modelo}</p>
            <p className="text-sm"><span className="font-semibold">IMEI/Serie:</span> {imei}</p>
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Checklist de entrada</h2>
            <p className="text-sm whitespace-pre-wrap"><span className="font-semibold">Relato:</span> {relatoCliente}</p>
            <p className="text-sm whitespace-pre-wrap mt-2"><span className="font-semibold">Condicao fisica:</span> {condicaoFisica}</p>
            <p className="text-sm whitespace-pre-wrap mt-2"><span className="font-semibold">Acessorios:</span> {acessorios}</p>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Seguranca</h2>
            <p className="text-sm"><span className="font-semibold">Senha:</span> {senha}</p>
            <p className="text-sm mt-2"><span className="font-semibold">Padrao:</span> {pontosDesenho.length > 0 ? pontosDesenho.join("-") : "Nao definido"}</p>
          </section>
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Itens e Orcamento</h2>
          <table className="w-full border border-zinc-300 text-sm">
            <thead>
              <tr className="bg-zinc-100">
                <th className="text-left p-2 border-b border-zinc-300">Descricao</th>
                <th className="text-left p-2 border-b border-zinc-300">Tipo</th>
                <th className="text-right p-2 border-b border-zinc-300">Custo</th>
                <th className="text-right p-2 border-b border-zinc-300">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-zinc-600" colSpan={4}>
                    Nenhum item cadastrado.
                  </td>
                </tr>
              )}

              {itens.map((item: { id: string; descricao: string; tipoPeca: string; custoPeca: number; valorCobrado: number }) => (
                <tr key={item.id}>
                  <td className="p-2 border-t border-zinc-200">{item.descricao}</td>
                  <td className="p-2 border-t border-zinc-200">{item.tipoPeca}</td>
                  <td className="p-2 border-t border-zinc-200 text-right">{formatarMoeda(item.custoPeca)}</td>
                  <td className="p-2 border-t border-zinc-200 text-right font-semibold">{formatarMoeda(item.valorCobrado)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-3">
            <p className="text-base font-bold">Total da OS: {formatarMoeda(totalOS)}</p>
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-zinc-300 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-semibold mb-12">Assinatura do Cliente</p>
            <div className="border-t border-zinc-500" />
          </div>

          <div>
            <p className="text-sm font-semibold mb-12">Assinatura do Tecnico</p>
            <div className="border-t border-zinc-500" />
          </div>
        </div>

        <div className="print:hidden mt-8 flex justify-end">
          <BotaoImprimirPagina />
        </div>
        </div>
      </div>
    </>
  );
}