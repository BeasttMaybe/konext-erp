import Image from "next/image";
import { BotaoImprimirPagina } from "@/components/os/botao-imprimir-pagina";
import { formatarMoedaImpressao, type DadosImpressaoOS } from "@/lib/impressao/obter-dados-impressao-os";
import { ESTILO_IMPRESSAO_A4 } from "./estilos-impressao";

type PropsOsImpressaoA4 = {
  dados: DadosImpressaoOS;
};

export function OsImpressaoA4({ dados }: PropsOsImpressaoA4) {
  const {
    numeroOs,
    statusLabel,
    dataEmissao,
    nomeCliente,
    documentoCliente,
    telefoneCliente,
    equipamento,
    marca,
    modelo,
    imei,
    senha,
    relatoCliente,
    condicaoFisica,
    acessorios,
    pontosDesenho,
    itens,
    totalOS,
    empresa,
    razaoSocialDistinta,
  } = dados;
  const nomeEmpresa = empresa.nomeExibicao;
  const cnpjEmpresa = empresa.cnpj;
  const enderecoEmpresa = empresa.endereco;
  const telefoneEmpresa = empresa.telefone;
  const logoUrl = empresa.logoUrl;

  return (
    <>
      {/* ── ESTILOS ─────────────────────────────────────────────────────── */}
      <style>{ESTILO_IMPRESSAO_A4}</style>

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
                <p className="text-xs text-zinc-500 mt-0.5">{cnpjEmpresa}</p>
                <p className="text-xs text-zinc-500">{enderecoEmpresa}</p>
                <p className="text-xs text-zinc-500">Tel.: {telefoneEmpresa}</p>
                {razaoSocialDistinta && (
                  <p className="text-xs text-zinc-500">{razaoSocialDistinta}</p>
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
                {itens.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100">
                    <td className="py-1.5 pr-3 text-zinc-800">{item.descricao}</td>
                    <td className="py-1.5 pr-3 text-zinc-600 capitalize">{item.tipoPeca}</td>
                    <td className="py-1.5 text-right font-semibold text-zinc-900">
                      {formatarMoedaImpressao(item.valorCobrado)}
                    </td>
                  </tr>
                ))}
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
                    {formatarMoedaImpressao(totalOS)}
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
