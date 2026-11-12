import Image from "next/image";
import { QrDaOS } from "./qr-da-os";
import { BotaoImprimirPagina } from "@/components/os/botao-imprimir-pagina";
import { formatarMoedaImpressao, type DadosImpressaoOS } from "@/lib/impressao/obter-dados-impressao-os";
import { ESTILO_IMPRESSAO_A4 } from "./estilos-impressao";

type PropsOsImpressaoA4 = {
  dados: DadosImpressaoOS;
  /** QR que abre a OS no celular — ver `QrDaOS`. */
  qrCodeSvg?: string | null;
};

export function OsImpressaoA4({ dados, qrCodeSvg = null }: PropsOsImpressaoA4) {
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
      <div className="os-tela-wrapper min-h-screen bg-kx-papel py-3 px-4 print:py-0 print:px-0">

        {/* Botão de imprimir — oculto na impressão */}
        <div className="print:hidden w-[210mm] mx-auto mb-2 flex justify-end">
          <BotaoImprimirPagina />
        </div>

        {/* Documento A4 */}
        <div
          className="os-folha w-[210mm] min-h-[297mm] p-[15mm] flex flex-col mx-auto bg-kx-papel text-kx-papel-texto border border-kx-papel-borda shadow-sm rounded print:rounded-none print:shadow-none print:border-0"
        >
          {/* ── CABEÇALHO ─────────────────────────────────────────────── */}
          <header className="flex items-start justify-between gap-6 pb-5 mb-6 border-b-2 border-kx-papel-borda-forte">
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
                <div className="h-14 w-24 flex-shrink-0 bg-kx-papel-alternado rounded flex items-center justify-center print:hidden">
                  <span className="text-[10px] text-kx-papel-legenda text-center leading-tight px-1">
                    Sem logo
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-black tracking-tight text-kx-papel-texto leading-tight">
                  {nomeEmpresa}
                </h1>
                <p className="text-xs text-kx-papel-legenda mt-0.5">{cnpjEmpresa}</p>
                <p className="text-xs text-kx-papel-legenda">{enderecoEmpresa}</p>
                <p className="text-xs text-kx-papel-legenda">Tel.: {telefoneEmpresa}</p>
                {razaoSocialDistinta && (
                  <p className="text-xs text-kx-papel-legenda">{razaoSocialDistinta}</p>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-start gap-4 text-right">
              <div>
              <p className="text-2xl font-black text-kx-papel-texto leading-none">OS #{numeroOs}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-kx-papel-texto-2">
                  <span className="font-semibold">Status:</span> {statusLabel}
                </p>
                <p className="text-xs text-kx-papel-texto-2">
                  <span className="font-semibold">Emissão:</span> {dataEmissao}
                </p>
              </div>
              </div>
              <QrDaOS svg={qrCodeSvg} tamanho="22mm" />
            </div>
          </header>

          {/* ── CLIENTE + EQUIPAMENTO ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 mb-6 pb-5 border-b border-kx-papel-borda break-inside-avoid">
            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-kx-papel-legenda mb-2">
                Cliente
              </h2>
              <p className="text-sm font-semibold text-kx-papel-texto">{nomeCliente}</p>
              <p className="text-xs text-kx-papel-texto-2 mt-0.5">
                <span className="font-medium">Doc.:</span> {documentoCliente}
              </p>
              <p className="text-xs text-kx-papel-texto-2">
                <span className="font-medium">Tel.:</span> {telefoneCliente}
              </p>
            </section>

            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-kx-papel-legenda mb-2">
                Equipamento
              </h2>
              <p className="text-sm font-semibold text-kx-papel-texto">{equipamento}</p>
              <p className="text-xs text-kx-papel-texto-2 mt-0.5">
                <span className="font-medium">Marca / Modelo:</span> {marca} — {modelo}
              </p>
              <p className="text-xs text-kx-papel-texto-2">
                <span className="font-medium">IMEI / Série:</span> {imei}
              </p>
            </section>
          </div>

          {/* ── CHECKLIST + SEGURANÇA ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 mb-6 pb-5 border-b border-kx-papel-borda break-inside-avoid">
            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-kx-papel-legenda mb-2">
                Checklist de Entrada
              </h2>
              <div className="space-y-1 text-xs text-kx-papel-texto-2">
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
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-kx-papel-legenda mb-2">
                Segurança
              </h2>
              <div className="space-y-1 text-xs text-kx-papel-texto-2">
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
            <h2 className="text-[9px] font-bold uppercase tracking-widest text-kx-papel-legenda mb-2">
              Itens e Orçamento
            </h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-kx-papel-borda-forte">
                  <th className="text-left py-1.5 pr-3 font-bold text-kx-papel-texto-2">Descrição</th>
                  <th className="text-left py-1.5 pr-3 font-bold text-kx-papel-texto-2 w-28">Tipo</th>
                  <th className="text-right py-1.5 font-bold text-kx-papel-texto-2 w-24">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-kx-papel-legenda italic">
                      Nenhum item cadastrado nesta OS.
                    </td>
                  </tr>
                )}
                {itens.map((item) => (
                  <tr key={item.id} className="border-b border-kx-papel-borda">
                    <td className="py-1.5 pr-3 text-kx-papel-texto">{item.descricao}</td>
                    <td className="py-1.5 pr-3 text-kx-papel-texto-2 capitalize">{item.tipoPeca}</td>
                    <td className="py-1.5 text-right font-semibold text-kx-papel-texto">
                      {formatarMoedaImpressao(item.valorCobrado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-kx-papel-borda-forte">
                  <td
                    colSpan={2}
                    className="pt-2 text-xs font-bold text-kx-papel-texto-2 uppercase tracking-wide"
                  >
                    Total da OS
                  </td>
                  <td className="pt-2 text-right text-sm font-black text-kx-papel-texto">
                    {formatarMoedaImpressao(totalOS)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* ── ASSINATURAS — mt-auto ancora no fundo do flex container ── */}
          <div className="mt-auto pt-8 break-inside-avoid">
            <div className="grid grid-cols-2 gap-12 border-t border-kx-papel-borda pt-6">
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-10" aria-hidden="true" />
                <div className="border-t border-kx-papel-borda-forte w-full" />
                <p className="text-xs font-semibold text-kx-papel-texto-2 text-center mt-1">
                  Assinatura do Técnico
                </p>
                <p className="text-[10px] text-kx-papel-legenda italic text-center">Nome legível</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-10" aria-hidden="true" />
                <div className="border-t border-kx-papel-borda-forte w-full" />
                <p className="text-xs font-semibold text-kx-papel-texto-2 text-center mt-1">
                  Assinatura do Cliente
                </p>
                <p className="text-[10px] text-kx-papel-legenda italic text-center">Nome legível</p>
              </div>
            </div>

            {/* Aviso de validade */}
            <p className="mt-4 text-center text-[9px] text-kx-papel-legenda border-t border-kx-papel-borda pt-3">
              Este documento é válido como ordem de serviço autorizada. Guarde sua cópia.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
