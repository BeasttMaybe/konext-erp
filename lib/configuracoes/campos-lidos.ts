/**
 * As colunas de `Configuracao` que o sistema le — e so elas.
 *
 * POR QUE EXISTE UMA LISTA
 *
 * Em 10/11/2026 o sistema saiu do ar por causa de uma leitura SEM `select`.
 * Sem `select`, o Prisma monta um SELECT com todas as colunas que o build em
 * execucao conhece. Duas colunas mortas foram apagadas do banco enquanto um
 * build anterior ainda estava no ar; esse build continuou pedindo as duas, e
 * toda tela que carregava as configuracoes caiu — por causa de colunas que
 * nenhuma linha de codigo usava.
 *
 * Com a lista, o que o sistema pede ao banco e exatamente o que ele usa. Uma
 * coluna que ninguem le pode sumir sem derrubar nada, qualquer que seja o
 * build no ar.
 *
 * O RISCO DE UMA LISTA, E O QUE O COBRE
 *
 * Um campo lido pelo codigo e ESQUECIDO aqui nao da erro: chega `undefined`
 * e a tela mostra o valor padrao — uma taxa de cartao errada, por exemplo,
 * sem aviso nenhum. `campos-lidos.test.ts` le o codigo de
 * app/actions/configuracoes.ts e falha se algum campo usado la nao estiver
 * nesta lista, e se algum nome daqui nao existir no schema.
 *
 * Na ordem do schema, para o diff de uma coluna nova cair no lugar obvio.
 */
export const CAMPOS_LIDOS_DE_CONFIGURACAO = [
  "id",
  "razaoSocial",
  "nomeFantasia",
  "cnpj",
  "inscricaoEstadual",
  "telefone",
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "cidade",
  "estado",
  "endereco",
  "logoUrl",
  "mensagemCupom",
  "modeloImpressaoOSPadrao",
  "imprimirLogoTermica",
  "mensagemRodapeImpressaoOS",
  "permitirVendaSemEstoque",
  "permitirPagamentoMisto",
  "permitirDescontoPDV",
  "descontoMaximoPDVPercentual",
  "permitirVendaFiado",
  "habilitarPix",
  "habilitarDinheiro",
  "habilitarCartaoDebito",
  "habilitarCartaoCredito",
  "habilitarBoleto",
  "habilitarCrediario",
  "taxaCartaoDebitoPercentual",
  "taxaCartaoCredito1xPercentual",
  "taxaCartaoCredito2xPercentual",
  "taxaCartaoCredito3xPercentual",
  "taxaCartaoCredito4xPercentual",
  "taxaCartaoCredito5xPercentual",
  "taxaCartaoCredito6xPercentual",
  "taxaCartaoCredito7xPercentual",
  "taxaCartaoCredito8xPercentual",
  "taxaCartaoCredito9xPercentual",
  "taxaCartaoCredito10xPercentual",
  "taxaCartaoCredito11xPercentual",
  "taxaCartaoCredito12xPercentual",
  "prazoPadraoBoletoDias",
  "prazoPadraoCrediarioDias",
  "maxParcelasCartaoCredito",
  "fechamentoAutomaticoCaixaAtivo",
  "fechamentoAutomaticoCaixaHorario",
  "prazoGarantiaPadraoDias",
  "prazoMinimoGarantiaDias",
  "prazoMaximoGarantiaDias",
  "exigirGarantiaAntesEntrega",
  "exigirItemParaGarantia",
  "exigirItemParaEnviarPDV",
  "exigirDiagnosticoParaFinalizar",
  "custoPecaOSJaPago",
  "permitirFinalizarSemPagamento",
  "permitirGarantiaPersonalizada",
  "textoCoberturaGarantia",
  "textoExclusoesGarantia",
  "textoResponsabilidadeDados",
] as const;

export type CampoLidoDeConfiguracao = (typeof CAMPOS_LIDOS_DE_CONFIGURACAO)[number];

/** O `select` do Prisma correspondente a lista acima. */
export const SELECAO_DE_CONFIGURACAO: Readonly<Record<CampoLidoDeConfiguracao, true>> = Object.freeze(
  Object.fromEntries(CAMPOS_LIDOS_DE_CONFIGURACAO.map((campo) => [campo, true])) as Record<
    CampoLidoDeConfiguracao,
    true
  >
);

/**
 * Para escritas cujo resultado nao e usado.
 *
 * `update` e `create` sem `select` devolvem a linha inteira — o mesmo SELECT
 * largo, com o mesmo defeito. Quem so quer gravar pede so o id de volta.
 */
export const SELECAO_SO_O_ID = Object.freeze({ id: true } as const);
