import { BotaoImprimirPagina } from "@/components/os/botao-imprimir-pagina";
import { QrDaOS } from "./qr-da-os";
import { formatarMoedaImpressao, type DadosImpressaoOS } from "@/lib/impressao/obter-dados-impressao-os";
import { ESTILO_IMPRESSAO_TERMICA } from "./estilos-impressao";

type PropsOsImpressaoTermica = {
  dados: DadosImpressaoOS;
  /** QR que abre a OS no celular — ver `QrDaOS`. */
  qrCodeSvg?: string | null;
};

export function OsImpressaoTermica({ dados, qrCodeSvg = null }: PropsOsImpressaoTermica) {
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
    relatoCliente,
    itens,
    totalOS,
    empresa,
    garantia,
    imprimirLogoTermica,
    mensagemRodapeImpressaoOS,
  } = dados;

  const mostrarLogo = imprimirLogoTermica && Boolean(empresa.logoUrl);
  const mostrarCnpj = empresa.cnpj !== "CNPJ não informado";
  const mostrarTelefone = empresa.telefone !== "Telefone não informado";
  const mostrarEndereco = empresa.endereco !== "Endereço não informado";

  return (
    <>
      <style>{ESTILO_IMPRESSAO_TERMICA}</style>

      <div className="print:hidden flex justify-center py-3">
        <BotaoImprimirPagina />
      </div>

      <div className="os-termica-wrapper">
        <div className="os-termica documento-impresso">
          {mostrarLogo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={empresa.logoUrl}
              alt={`Logo ${empresa.nomeExibicao}`}
              style={{ maxHeight: "24mm", maxWidth: "60mm", display: "block", margin: "0 auto 6px", objectFit: "contain" }}
            />
          )}

          <p className="termica-centro termica-negrito">{empresa.nomeExibicao}</p>
          {mostrarCnpj && <p className="termica-centro">{empresa.cnpj}</p>}
          {mostrarTelefone && <p className="termica-centro">{empresa.telefone}</p>}
          {mostrarEndereco && <p className="termica-centro">{empresa.endereco}</p>}

          <hr className="termica-separador" />

          <p className="termica-centro termica-negrito">ORDEM DE SERVIÇO Nº {numeroOs}</p>
          <p className="termica-centro">Emissão: {dataEmissao}</p>
          <p className="termica-centro">Status: {statusLabel}</p>
          {qrCodeSvg ? (
            <div className="termica-centro" style={{ marginTop: "2mm" }}>
              <QrDaOS svg={qrCodeSvg} tamanho="28mm" legenda="Aponte o celular para abrir a OS" />
            </div>
          ) : null}

          <hr className="termica-separador" />

          <p className="termica-negrito">CLIENTE</p>
          <p>{nomeCliente}</p>
          <p>Doc.: {documentoCliente}</p>
          <p>Tel.: {telefoneCliente}</p>

          <hr className="termica-separador" />

          <p className="termica-negrito">EQUIPAMENTO</p>
          <p>{equipamento}</p>
          <p>Marca/Modelo: {marca} — {modelo}</p>
          <p>IMEI/Série: {imei}</p>

          <hr className="termica-separador" />

          <p className="termica-negrito">DEFEITO RELATADO</p>
          <p>{relatoCliente}</p>

          <hr className="termica-separador" />

          <p className="termica-negrito">ITENS</p>
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              {itens.length === 0 && (
                <tr className="termica-linha-item">
                  <td colSpan={2}>Nenhum item cadastrado.</td>
                </tr>
              )}
              {itens.map((item) => (
                <tr key={item.id} className="termica-linha-item">
                  <td>
                    {item.descricao}
                    {item.tipoPeca ? ` (${item.tipoPeca})` : ""}
                  </td>
                  <td align="right" style={{ whiteSpace: "nowrap" }}>
                    {formatarMoedaImpressao(item.valorCobrado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="termica-separador" />

          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td className="termica-negrito">TOTAL</td>
                <td align="right" className="termica-negrito">
                  {formatarMoedaImpressao(totalOS)}
                </td>
              </tr>
            </tbody>
          </table>

          {garantia && (
            <>
              <hr className="termica-separador" />
              {garantia.origem === "OS" ? (
                <>
                  <p>Garantia: {garantia.prazoDias} dias</p>
                  <p>Válida até: {garantia.dataFim}</p>
                </>
              ) : (
                <p>Garantia padrão: {garantia.prazoDias} dias (termo não emitido)</p>
              )}
            </>
          )}

          {mensagemRodapeImpressaoOS && (
            <>
              <hr className="termica-separador" />
              <p className="termica-centro whitespace-pre-wrap">{mensagemRodapeImpressaoOS}</p>
            </>
          )}

          <hr className="termica-separador" />

          <div className="termica-assinatura termica-centro">
            <div className="termica-separador" style={{ marginTop: "24px" }} />
            <p>{nomeCliente}</p>
          </div>

          <div className="termica-rodape-espaco" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}
