/**
 * Decide se uma nota do Bling é a MESMA venda que já existe no Konext.
 *
 * O dono descreveu o que quer: "caso já exista a venda no erp da konext,
 * sistema identifica duplicidade e vincula a nota a venda dentro do erp. os
 * que não existem, inserir no contas a receber normalmente".
 *
 * O detalhe da nota do Bling NÃO traz nenhuma referência ao Konext —
 * `numeroPedidoLoja` vem vazio, e não existe campo de pedido externo. Então
 * não há chave: o casamento é por semelhança, e semelhança erra.
 *
 * O PRINCÍPIO AQUI É: ERRAR PARA MENOS.
 *
 * Casar errado vincula a nota de um cliente à venda de outro, e isso aparece
 * no histórico dos dois, no financeiro e num eventual documento impresso.
 * Não casar apenas deixa a nota sem vínculo — visível, corrigível à mão, e
 * sem nada de errado gravado em lugar nenhum.
 *
 * Por isso:
 *
 * - O documento do cliente tem que bater, e tem que SER um documento (11 ou
 *   14 dígitos). Nota sem documento nunca casa: nome não serve, porque
 *   "João da Silva" é muitos Joões.
 * - O valor tem que bater ao CENTAVO. Tolerância aqui seria convidar duas
 *   vendas próximas a se confundirem.
 * - A data tem que estar dentro de uma janela curta, porque a nota costuma
 *   ser emitida dias depois da venda.
 * - **Dois candidatos = nenhum.** Se o mesmo cliente tem duas vendas do
 *   mesmo valor na mesma semana, não existe informação para escolher — e
 *   escolher uma é um palpite gravado como fato.
 */

import { diferencaEntreDatasDeCalendario } from "@/lib/datas";

/**
 * Quantos dias a nota pode ter sido emitida depois (ou antes) da venda.
 *
 * Sete porque emitir no fim da semana o que se vendeu na segunda é rotina de
 * loja. Mais que isso começa a abraçar a venda do mês seguinte.
 */
export const DIAS_DE_JANELA_DO_CASAMENTO = 7;

export type VendaCandidata = {
  id: string;
  /** Só dígitos, ou nulo. */
  clienteDocumento: string | null;
  valorCentavos: number;
  data: Date;
};

export type NotaParaCasar = {
  clienteDocumento: string | null;
  valorCentavos: number | null;
  dataEmissao: Date | null;
};

export type MotivoDeNaoCasar =
  | "NOTA_SEM_DOCUMENTO"
  | "NOTA_SEM_VALOR"
  | "NOTA_SEM_DATA"
  | "NENHUM_CANDIDATO"
  | "MAIS_DE_UM_CANDIDATO";

export type ResultadoDoCasamento =
  | { casou: true; vendaId: string }
  | { casou: false; motivo: MotivoDeNaoCasar };

/** Documento só é documento com 11 (CPF) ou 14 (CNPJ) dígitos. */
export function documentoComparavel(valor: string | null | undefined): string | null {
  const digitos = (valor ?? "").replace(/\D/g, "");
  return digitos.length === 11 || digitos.length === 14 ? digitos : null;
}

export function casarNotaComVenda({
  nota,
  candidatas,
  diasDeJanela = DIAS_DE_JANELA_DO_CASAMENTO,
}: {
  nota: NotaParaCasar;
  candidatas: VendaCandidata[];
  diasDeJanela?: number;
}): ResultadoDoCasamento {
  const documentoDaNota = documentoComparavel(nota.clienteDocumento);

  if (!documentoDaNota) return { casou: false, motivo: "NOTA_SEM_DOCUMENTO" };
  if (nota.valorCentavos === null) return { casou: false, motivo: "NOTA_SEM_VALOR" };
  if (!nota.dataEmissao) return { casou: false, motivo: "NOTA_SEM_DATA" };

  const dataDaNota = nota.dataEmissao;
  const valorDaNota = nota.valorCentavos;

  const compativeis = candidatas.filter((candidata) => {
    if (documentoComparavel(candidata.clienteDocumento) !== documentoDaNota) return false;
    if (candidata.valorCentavos !== valorDaNota) return false;

    // A nota pode vir antes ou depois da venda: emitir no dia seguinte é
    // comum, e lançar a venda no sistema depois de emitir também.
    const distancia = Math.abs(diferencaEntreDatasDeCalendario(candidata.data, dataDaNota));

    return distancia <= diasDeJanela;
  });

  if (compativeis.length === 0) return { casou: false, motivo: "NENHUM_CANDIDATO" };

  // Dois candidatos indistinguíveis: não há informação para escolher, e
  // escolher seria gravar um palpite como fato.
  if (compativeis.length > 1) return { casou: false, motivo: "MAIS_DE_UM_CANDIDATO" };

  return { casou: true, vendaId: compativeis[0].id };
}

/** O que a tela mostra quando a nota não casou. */
export function explicarNaoCasamento(motivo: MotivoDeNaoCasar): string {
  switch (motivo) {
    case "NOTA_SEM_DOCUMENTO":
      return "A nota não trouxe CPF/CNPJ do cliente, então não dá para saber de quem é a venda.";
    case "NOTA_SEM_VALOR":
      return "O valor da nota ainda não foi lido do Bling.";
    case "NOTA_SEM_DATA":
      return "A nota veio sem data de emissão.";
    case "NENHUM_CANDIDATO":
      return "Nenhuma venda do Konext bate com este cliente, valor e data.";
    case "MAIS_DE_UM_CANDIDATO":
      return "Mais de uma venda do Konext bate. Vincule à mão para não arriscar a errada.";
  }
}
