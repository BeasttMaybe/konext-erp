/**
 * Lê uma NF-e 4.00 já convertida de XML pra objeto.
 *
 * Diferente do PDF, aqui não há inferência nenhuma: cada campo tem nome e
 * posição definidos pelo layout nacional. O trabalho deste módulo é só
 * tradução — e cuidar das armadilhas do formato, que são três e todas
 * silenciosas:
 *
 * 1. **A chave de acesso não é um número.** São 44 dígitos. Qualquer parser
 *    que converta valor de tag pra número automaticamente transforma isso em
 *    ponto flutuante e corrompe os últimos dígitos sem avisar. Por isso o
 *    XML tem que chegar aqui com TODO valor como texto (ver
 *    `lib/compras/ler-xml.ts`), e a conversão pra número acontece aqui, campo
 *    por campo, onde dá pra saber o que é número de verdade.
 *
 * 2. **`det` é objeto quando a nota tem um item só.** O parser só produz
 *    array a partir de dois. Uma nota de um item lida sem esse cuidado vira
 *    uma nota de zero itens.
 *
 * 3. **`vUnCom` tem até dez casas decimais**, enquanto `vProd` tem duas. O
 *    total da linha é a verdade; o unitário é informativo. Ver a tolerância
 *    por quantidade em `./nota`.
 */

import { deDecimal } from "@/lib/dinheiro";

import type { ItemLidoDaNota, NotaLida } from "./nota";

/** Um nó do XML depois de convertido: valores sempre texto. */
type NoXml = Record<string, unknown>;

export class XmlDeNotaInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "XmlDeNotaInvalido";
  }
}

function objeto(valor: unknown): NoXml | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as NoXml)
    : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string") {
    const limpo = valor.trim();
    return limpo === "" ? null : limpo;
  }

  if (typeof valor === "number") return String(valor);
  return null;
}

/**
 * Lê um decimal do XML. O layout da NF-e usa SEMPRE ponto como separador
 * decimal e nunca separador de milhar — é formato de máquina, não pt-BR.
 */
function centavos(valor: unknown): number | null {
  const comoTexto = texto(valor);
  if (comoTexto === null) return null;
  if (!/^-?\d+(\.\d+)?$/.test(comoTexto)) return null;

  return deDecimal(comoTexto);
}

function quantidade(valor: unknown): number | null {
  const comoTexto = texto(valor);
  if (comoTexto === null) return null;

  const numero = Number(comoTexto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Soma todo `vICMSST`, `vIPI` e `vFCPST` que existir dentro do bloco de
 * imposto do item, em qualquer profundidade.
 *
 * A varredura é recursiva de propósito: o nó do ICMS tem nome VARIÁVEL
 * conforme a tributação — ICMS00, ICMS10, ICMS60, ICMSSN201, ICMSST, e mais
 * uma dúzia. Procurar por caminho fixo significaria escrever a lista inteira
 * e errar a próxima que o layout inventar. O que importa é o nome do campo,
 * não onde ele está pendurado.
 *
 * `vICMSSTRet` fica de fora: é ST já retido numa operação anterior, que o
 * emitente informa mas não cobra de novo nesta nota.
 */
const CAMPOS_DE_IMPOSTO_QUE_CUSTAM = new Set(["vICMSST", "vIPI", "vFCPST"]);

function somarImpostosDoItem(no: unknown): number {
  const objetoAtual = objeto(no);
  if (!objetoAtual) return 0;

  let total = 0;

  for (const [chave, valor] of Object.entries(objetoAtual)) {
    if (CAMPOS_DE_IMPOSTO_QUE_CUSTAM.has(chave)) {
      total += centavos(valor) ?? 0;
      continue;
    }

    if (Array.isArray(valor)) {
      for (const filho of valor) total += somarImpostosDoItem(filho);
      continue;
    }

    total += somarImpostosDoItem(valor);
  }

  return total;
}

/** `det` vira objeto quando a nota tem um item só, e array a partir de dois. */
function comoLista(valor: unknown): NoXml[] {
  if (Array.isArray(valor)) return valor.map(objeto).filter((no): no is NoXml => no !== null);

  const unico = objeto(valor);
  return unico ? [unico] : [];
}

/** Os 44 dígitos, de `infNFe@Id` (vem prefixado de "NFe") ou do campo solto. */
function acharChaveDeAcesso(infNFe: NoXml, raiz: NoXml): string | null {
  const candidatos = [
    texto(infNFe["@_Id"]),
    texto(objeto(raiz.protNFe)?.infProt && objeto(objeto(raiz.protNFe)?.infProt)?.chNFe),
  ];

  for (const candidato of candidatos) {
    const digitos = candidato?.replace(/\D/g, "") ?? "";
    if (digitos.length === 44) return digitos;
  }

  return null;
}

/** `dhEmi` é ISO com fuso ("2026-10-22T10:00:00-03:00"); `dEmi` é só a data. */
function acharDataDeEmissao(ide: NoXml): string | null {
  const bruta = texto(ide.dhEmi) ?? texto(ide.dEmi);
  if (!bruta) return null;

  const encontrado = /^(\d{4}-\d{2}-\d{2})/.exec(bruta);
  return encontrado ? encontrado[1] : null;
}

export type NotaXmlLida = NotaLida & {
  /** CNPJ de quem RECEBEU a nota — é com ele que se confere o destinatário. */
  destinatarioCnpj: string | null;
};

/**
 * Converte o objeto do XML numa nota de compra.
 *
 * Aceita tanto `nfeProc` (a nota autorizada, com protocolo) quanto a `NFe`
 * sozinha, porque é comum o fornecedor mandar só o miolo por e-mail.
 */
export function lerNotaDeXml(documento: NoXml): NotaXmlLida {
  const raiz = objeto(documento.nfeProc) ?? documento;
  const nfe = objeto(raiz.NFe) ?? objeto(raiz.nfe) ?? raiz;
  const infNFe = objeto(nfe.infNFe);

  if (!infNFe) {
    throw new XmlDeNotaInvalido(
      "Este XML não é uma NF-e: não tem o bloco `infNFe`. Se o arquivo veio do fornecedor por e-mail, confira se não é o XML de cancelamento ou o recibo de entrega."
    );
  }

  const ide = objeto(infNFe.ide) ?? {};
  const emit = objeto(infNFe.emit) ?? {};
  const dest = objeto(infNFe.dest) ?? {};
  const totais = objeto(objeto(infNFe.total)?.ICMSTot) ?? {};

  const itens: ItemLidoDaNota[] = [];

  for (const det of comoLista(infNFe.det)) {
    const prod = objeto(det.prod);
    if (!prod) continue;

    const qtd = quantidade(prod.qCom);
    const valorTotalCentavos = centavos(prod.vProd);

    if (qtd === null || valorTotalCentavos === null) continue;

    const unitario = centavos(prod.vUnCom);

    // `cEAN` traz literalmente "SEM GTIN" quando o produto não tem código de
    // barras — virar código de barras de produto faria todos os produtos sem
    // GTIN colidirem num só.
    const ean = texto(prod.cEAN);
    const eanValido = ean && /^\d{8,14}$/.test(ean) ? ean : null;

    itens.push({
      ordem: itens.length + 1,
      // `indTot` ausente vale 1 pelo layout: o item compõe o total.
      compoeTotal: (texto(prod.indTot) ?? "1") !== "0",
      impostosCentavos: somarImpostosDoItem(det.imposto),
      descricao: texto(prod.xProd) ?? `Item ${itens.length + 1}`,
      // O XML nomeia o produto inteiro em `xProd`: não existe cabeçalho de
      // seção pra desgrudar, como acontece no PDF.
      grupo: null,
      codigoFornecedor: texto(prod.cProd),
      ean: eanValido,
      ncm: texto(prod.NCM),
      unidade: texto(prod.uCom),
      quantidade: qtd,
      valorUnitarioCentavos: unitario ?? 0,
      valorTotalCentavos,
    });
  }

  const cnpjDoEmitente = texto(emit.CNPJ)?.replace(/\D/g, "") ?? null;
  const cnpjDoDestinatario = texto(dest.CNPJ)?.replace(/\D/g, "") ?? null;

  return {
    origem: "XML",
    chaveAcesso: acharChaveDeAcesso(infNFe, raiz),
    numero: texto(ide.nNF),
    serie: texto(ide.serie),
    emitenteNome: texto(emit.xNome) ?? texto(emit.xFant),
    emitenteCnpj: cnpjDoEmitente,
    destinatarioCnpj: cnpjDoDestinatario,
    emitidaEm: acharDataDeEmissao(ide),
    itens,
    valorProdutosCentavos: centavos(totais.vProd),
    valorFreteCentavos: centavos(totais.vFrete) ?? 0,
    valorDescontoCentavos: centavos(totais.vDesc) ?? 0,
    // Os componentes que a fórmula do total exige e que o conferidor não
    // conhecia: sem eles, toda nota com substituição tributária era
    // reprovada sem ter nada de errado.
    valorImpostosCentavos:
      (centavos(totais.vST) ?? 0) +
      (centavos(totais.vIPI) ?? 0) +
      (centavos(totais.vFCPST) ?? 0) +
      (centavos(totais.vII) ?? 0),
    valorOutrosCentavos: (centavos(totais.vSeg) ?? 0) + (centavos(totais.vOutro) ?? 0),
    valorTotalCentavos: centavos(totais.vNF),
    linhasIgnoradas: [],
  };
}

/** Por que uma nota pode não ser uma compra desta loja. */
export type AlertaDeDestinatario = "EMITIDA_PELA_LOJA" | "DESTINADA_A_OUTRO_CNPJ";

/**
 * Confere se a nota é mesmo uma COMPRA da loja.
 *
 * Importar sem conferir isso tem duas consequências ruins e nenhuma barulho:
 * o XML de uma venda que a própria loja emitiu entraria no estoque somando
 * em vez de subtrair, e o XML de outra empresa entraria com produtos que
 * nunca chegaram na prateleira.
 *
 * Sem CNPJ cadastrado nas configurações não há o que comparar, e aí o certo
 * é não dizer nada: inventar um alerta que não se pode sustentar é pior do
 * que ficar quieto.
 */
export function conferirDestinatario(
  nota: NotaXmlLida,
  cnpjDaLoja: string | null | undefined
): AlertaDeDestinatario | null {
  const meu = cnpjDaLoja?.replace(/\D/g, "") ?? "";
  if (meu.length !== 14) return null;

  if (nota.emitenteCnpj === meu) return "EMITIDA_PELA_LOJA";
  if (nota.destinatarioCnpj !== null && nota.destinatarioCnpj !== meu) {
    return "DESTINADA_A_OUTRO_CNPJ";
  }

  return null;
}
