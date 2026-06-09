import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { BotaoImprimirPagina } from "@/components/os/botao-imprimir-pagina";

type PropsPaginaImpressaoOS = {
  params: Promise<{ id: string }>;
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
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const mapaStatusLabel: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando Orçamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando Peça",
  EM_MANUTENCAO: "Em Manutenção",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

function extrairPontosDesenho(valor: string | null | undefined): number[] {
  if (!valor) return [];
  return valor
    .split(/[^0-9]+/)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= 9);
}

export default async function PaginaImpressaoOS({ params }: PropsPaginaImpressaoOS) {
  const { id } = await params;
  const prismaAny = prisma as any;
  const delegateOrdemServico = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!delegateOrdemServico?.findUnique) {
    throw new Error("Delegate Prisma de OrdemServico não disponível.");
  }

  const includeQuery = {
    cliente: { select: { nomeRazaoSocial: true, documento: true, telefone: true } },
    itens: true,
  };

  const [osRaw, config] = await Promise.all([
    delegateOrdemServico.findUnique({ where: { id }, include: includeQuery }),
    obterConfiguracoes(),
  ]);

  let os = osRaw;

  if (!os) {
    const slug = extrairNumeroOsDoSlug(id);
    if (slug !== null && delegateOrdemServico.findFirst) {
      os = await delegateOrdemServico.findFirst({
        where: { numeroOs: slug },
        include: includeQuery,
      });
    }
  }

  if (!os) notFound();

  // Dados da empresa
  const nomeEmpresa = config.nomeFantasia || config.razaoSocial || "Konext";
  const cnpjEmpresa = config.cnpj || "";
  const enderecoEmpresa = [
    config.logradouro,
    config.numero,
    config.bairro,
    config.cidade,
    config.estado,
  ]
    .filter(Boolean)
    .join(", ");
  const telefoneEmpresa = config.telefone || "";
  const logoUrl = config.logoUrl || "";

  // Dados da OS
  const statusLabel =
    mapaStatusLabel[String(os.status)] ?? String(os.status).replaceAll("_", " ");
  const numeroOs = String(os.numeroOs ?? "-");
  const dataEmissao = new Date(os.criadoEm).toLocaleDateString("pt-BR");
  const nomeCliente = String(os.cliente?.nomeRazaoSocial ?? "Não informado");
  const documentoCliente = String(os.cliente?.documento ?? "Não informado");
  const telefoneCliente = String(os.cliente?.telefone ?? "Não informado");
  const equipamento = String(os.equipamento ?? "Não informado");
  const marca = String(os.marca ?? "Não informado");
  const modelo = String(os.modelo ?? "Não informado");
  const imei = String(os.imei ?? "Não informado");
  const senha = String(os.senha ?? "Não informada");
  const relatoCliente = String(os.relatoCliente ?? "Não informado");
  const condicaoFisica = String(os.condicaoFisica ?? "Não informada");
  const acessorios = String(os.acessorios ?? "Não informado");
  const pontosDesenho = extrairPontosDesenho(String(os.senhaDesenho ?? ""));

  const itens = (os.itens ?? []).map((item: any) => ({
    id: String(item.id),
    descricao: String(item.descricao ?? ""),
    tipoPeca: String(item.tipoPeca ?? "OUTROS").replaceAll("_", " ").toLowerCase(),
    valorCobrado: Number(item.valorCobrado ?? 0),
  }));

  const totalOS = itens.reduce(
    (acc: number, item: { valorCobrado: number }) => acc + item.valorCobrado,
    0
  );

  return (
    <>
      {/* ── ESTILOS ─────────────────────────────────────────────────────── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        /*
         * Sobrescreve o tema escuro do ERP.
         * globals.css usa hsl(var(--background)) SEM !important,
         * por isso !important aqui sempre vence.
         */
        html, body {
          background-color: #ffffff !important;
          color: #000000 !important;
          color-scheme: light !important;
        }

        /* Remove headers/footers padrão do browser (URLs, timestamps) */
        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          aside, nav, header, footer,
          [role="banner"], [role="complementary"], [role="contentinfo"],
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .os-tela-wrapper {
            padding: 0 !important;
            background: #fff !important;
          }

          .os-folha {
            width: 210mm !important;
            height: 297mm !important;
            min-height: unset !important;
            padding: 15mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* ── WRAPPER DE TELA ─────────────────────────────────────────────── */}
      <div className="os-tela-wrapper min-h-screen bg-white py-3 px-4 print:py-0 print:px-0">

        {/* Botão de imprimir — oculto na impressão */}
        <div className="print:hidden w-[210mm] mx-auto mb-2 flex justify-end">
          <BotaoImprimirPagina />
        </div>

        {/* Documento A4 */}
        <div
          className="os-folha w-[210mm] min-h-[297mm] p-[15mm] flex flex-col mx-auto bg-white text-black border border-zinc-300 shadow-sm rounded print:rounded-none print:shadow-none print:border-0"
        >
          {/* ── CABEÇALHO ─────────────────────────────────────────────── */}
          <header className="flex items-start justify-between gap-6 pb-5 mb-6 border-b-2 border-zinc-800">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative h-14 w-24 flex-shrink-0">
                  <Image
                    src={logoUrl}
                    alt={`Logo ${nomeEmpresa}`}
                    fill
                    className="object-contain object-left"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="h-14 w-24 flex-shrink-0 bg-zinc-100 rounded flex items-center justify-center print:hidden">
                  <span className="text-[10px] text-zinc-400 text-center leading-tight px-1">
                    Sem logo
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-black tracking-tight text-zinc-900 leading-tight">
                  {nomeEmpresa}
                </h1>
                {cnpjEmpresa && (
                  <p className="text-xs text-zinc-500 mt-0.5">CNPJ: {cnpjEmpresa}</p>
                )}
                {enderecoEmpresa && (
                  <p className="text-xs text-zinc-500">{enderecoEmpresa}</p>
                )}
                {telefoneEmpresa && (
                  <p className="text-xs text-zinc-500">Tel.: {telefoneEmpresa}</p>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-zinc-900 leading-none">OS #{numeroOs}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-zinc-600">
                  <span className="font-semibold">Status:</span> {statusLabel}
                </p>
                <p className="text-xs text-zinc-600">
                  <span className="font-semibold">Emissão:</span> {dataEmissao}
                </p>
              </div>
            </div>
          </header>

          {/* ── CLIENTE + EQUIPAMENTO ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 mb-6 pb-5 border-b border-zinc-200 break-inside-avoid">
            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Cliente
              </h2>
              <p className="text-sm font-semibold text-zinc-900">{nomeCliente}</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                <span className="font-medium">Doc.:</span> {documentoCliente}
              </p>
              <p className="text-xs text-zinc-600">
                <span className="font-medium">Tel.:</span> {telefoneCliente}
              </p>
            </section>

            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Equipamento
              </h2>
              <p className="text-sm font-semibold text-zinc-900">{equipamento}</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                <span className="font-medium">Marca / Modelo:</span> {marca} — {modelo}
              </p>
              <p className="text-xs text-zinc-600">
                <span className="font-medium">IMEI / Série:</span> {imei}
              </p>
            </section>
          </div>

          {/* ── CHECKLIST + SEGURANÇA ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 mb-6 pb-5 border-b border-zinc-200 break-inside-avoid">
            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Checklist de Entrada
              </h2>
              <div className="space-y-1 text-xs text-zinc-700">
                <p>
                  <span className="font-semibold">Relato do cliente:</span>{" "}
                  <span className="whitespace-pre-wrap">{relatoCliente}</span>
                </p>
                <p>
                  <span className="font-semibold">Condição física:</span>{" "}
                  <span className="whitespace-pre-wrap">{condicaoFisica}</span>
                </p>
                <p>
                  <span className="font-semibold">Acessórios:</span>{" "}
                  <span className="whitespace-pre-wrap">{acessorios}</span>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Segurança
              </h2>
              <div className="space-y-1 text-xs text-zinc-700">
                <p>
                  <span className="font-semibold">Senha:</span> {senha}
                </p>
                <p>
                  <span className="font-semibold">Padrão de desbloqueio:</span>{" "}
                  {pontosDesenho.length > 0 ? pontosDesenho.join(" → ") : "Não definido"}
                </p>
              </div>
            </section>
          </div>

          {/* ── ITENS E ORÇAMENTO ─────────────────────────────────────── */}
          <section className="mb-4 break-inside-avoid">
            <h2 className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Itens e Orçamento
            </h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-zinc-800">
                  <th className="text-left py-1.5 pr-3 font-bold text-zinc-700">Descrição</th>
                  <th className="text-left py-1.5 pr-3 font-bold text-zinc-700 w-28">Tipo</th>
                  <th className="text-right py-1.5 font-bold text-zinc-700 w-24">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-zinc-400 italic">
                      Nenhum item cadastrado nesta OS.
                    </td>
                  </tr>
                )}
                {itens.map(
                  (item: {
                    id: string;
                    descricao: string;
                    tipoPeca: string;
                    valorCobrado: number;
                  }) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="py-1.5 pr-3 text-zinc-800">{item.descricao}</td>
                      <td className="py-1.5 pr-3 text-zinc-600 capitalize">{item.tipoPeca}</td>
                      <td className="py-1.5 text-right font-semibold text-zinc-900">
                        {formatarMoeda(item.valorCobrado)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-800">
                  <td
                    colSpan={2}
                    className="pt-2 text-xs font-bold text-zinc-700 uppercase tracking-wide"
                  >
                    Total da OS
                  </td>
                  <td className="pt-2 text-right text-sm font-black text-zinc-900">
                    {formatarMoeda(totalOS)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* ── ASSINATURAS — mt-auto ancora no fundo do flex container ── */}
          <div className="mt-auto pt-8 break-inside-avoid">
            <div className="grid grid-cols-2 gap-12 border-t border-zinc-200 pt-6">
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-10" aria-hidden="true" />
                <div className="border-t border-zinc-500 w-full" />
                <p className="text-xs font-semibold text-zinc-700 text-center mt-1">
                  Assinatura do Técnico
                </p>
                <p className="text-[10px] text-zinc-400 italic text-center">Nome legível</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-10" aria-hidden="true" />
                <div className="border-t border-zinc-500 w-full" />
                <p className="text-xs font-semibold text-zinc-700 text-center mt-1">
                  Assinatura do Cliente
                </p>
                <p className="text-[10px] text-zinc-400 italic text-center">Nome legível</p>
              </div>
            </div>

            {/* Aviso de validade */}
            <p className="mt-4 text-center text-[9px] text-zinc-400 border-t border-zinc-100 pt-3">
              Este documento é válido como ordem de serviço autorizada. Guarde sua cópia.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
