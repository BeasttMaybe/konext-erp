export const ACOES_AUDITORIA = {
  CRIAR: "CRIAR",
  ATUALIZAR_STATUS: "ATUALIZAR_STATUS",
  ATUALIZAR_CONFIGURACOES_OS_GARANTIA: "ATUALIZAR_CONFIGURACOES_OS_GARANTIA",
  ATUALIZAR_CONFIGURACOES_PDV: "ATUALIZAR_CONFIGURACOES_PDV",
  FINALIZAR: "FINALIZAR",
  EXCLUIR_LOGICO: "EXCLUIR_LOGICO",
  EXCLUIR_FISICO: "EXCLUIR_FISICO",
  ADICIONAR_ITEM: "ADICIONAR_ITEM",
  ATUALIZAR_ITEM: "ATUALIZAR_ITEM",
  REMOVER_ITEM: "REMOVER_ITEM",
  GERAR_TERMO_GARANTIA: "GERAR_TERMO_GARANTIA",
  AJUSTAR_TERMO_GARANTIA: "AJUSTAR_TERMO_GARANTIA",
  REGISTRAR_RETORNO_GARANTIA: "REGISTRAR_RETORNO_GARANTIA",
  FINALIZAR_RETORNO_GARANTIA: "FINALIZAR_RETORNO_GARANTIA",
  CRIAR_META: "CRIAR_META",
  ATUALIZAR_META: "ATUALIZAR_META",
  ATUALIZAR_PROGRESSO_META: "ATUALIZAR_PROGRESSO_META",
  ALTERAR_STATUS_META: "ALTERAR_STATUS_META",
  EXCLUIR_META: "EXCLUIR_META",
  SNAPSHOT_PRE_SANEAMENTO: "SNAPSHOT_PRE_SANEAMENTO",
  ALTERAR_SENHA: "ALTERAR_SENHA",
  ABRIR_CAIXA: "ABRIR_CAIXA",
  FECHAR_CAIXA: "FECHAR_CAIXA",
  // Fase 3-2B — detalhe da OS.
  VISUALIZAR_SENHA: "VISUALIZAR_SENHA",
  // Fase 1D-1 — cargos e permissoes (banco central).
  CRIAR_CARGO: "CRIAR_CARGO",
  RENOMEAR_CARGO: "RENOMEAR_CARGO",
  DEFINIR_PERMISSOES_CARGO: "DEFINIR_PERMISSOES_CARGO",
  DUPLICAR_CARGO: "DUPLICAR_CARGO",
  ARQUIVAR_CARGO: "ARQUIVAR_CARGO",
  ATRIBUIR_CARGO_USUARIO: "ATRIBUIR_CARGO_USUARIO",
  // Fase 1D-2 — tecnicos de OS.
  DEFINIR_TECNICOS_OS: "DEFINIR_TECNICOS_OS",
  // Fase 1D-3 — tela de Usuarios e Cargos.
  DESATIVAR_USUARIO: "DESATIVAR_USUARIO",
  REATIVAR_USUARIO: "REATIVAR_USUARIO",
  TRANSFERIR_PROPRIEDADE: "TRANSFERIR_PROPRIEDADE",
  // Fase 3-2D, Parte 5 — baixa/pagamento em lote no Financeiro.
  FINALIZAR_LOTE: "FINALIZAR_LOTE",
  // Fase 4 — marcas de peca da OS. Criar reusa CRIAR; o resto e proprio porque
  // marca usada nunca e apagada, so desativada.
  // Fase 2A-3 — estorno de venda. O cancelamento nao registrava NADA: nem
  // log, nem rastro da conta a receber, que era apagada.
  ESTORNAR_VENDA: "ESTORNAR_VENDA",
  // Propostas comerciais. APROVADA/REJEITADA eram inalcancaveis: nenhuma acao
  // do sistema escrevia esses dois valores do enum. Quem registrou o "sim" do
  // cliente, e quando, e o que sustenta a taxa de conversao da tela.
  RESPONDER_PROPOSTA: "RESPONDER_PROPOSTA",
  ENVIAR_PROPOSTA: "ENVIAR_PROPOSTA",
  AGENDAR_CONTATO_PROPOSTA: "AGENDAR_CONTATO_PROPOSTA",
  // Categorias de produto: mesmo cadastro controlado das marcas de peca. Quem
  // renomeia uma categoria mexe no rotulo de todo o historico que aponta pra
  // ela, entao a acao e propria e nao reusa ATUALIZAR.
  // Produto: alteracao de custo e de preco e alteracao de DINHEIRO, e nenhuma
  // das duas actions antigas (criarProduto/atualizarProduto) registrava nada.
  ATUALIZAR_PRODUTO: "ATUALIZAR_PRODUTO",
  REATIVAR_PRODUTO: "REATIVAR_PRODUTO",
  RENOMEAR_CATEGORIA_PRODUTO: "RENOMEAR_CATEGORIA_PRODUTO",
  DESATIVAR_CATEGORIA_PRODUTO: "DESATIVAR_CATEGORIA_PRODUTO",
  REATIVAR_CATEGORIA_PRODUTO: "REATIVAR_CATEGORIA_PRODUTO",
  // Diagnostico do armazenamento de fotos (R2). Registrado porque saber quando
  // passou pela ultima vez responde "quebrou agora ou nunca funcionou?".
  TESTAR_ARMAZENAMENTO: "TESTAR_ARMAZENAMENTO",
  // Fotos do aparelho na OS. Registrado porque a foto e prova numa discussao
  // com cliente: quem adicionou e quem removeu importa tanto quanto a imagem.
  ADICIONAR_FOTO_OS: "ADICIONAR_FOTO_OS",
  REMOVER_FOTO_OS: "REMOVER_FOTO_OS",
  RENOMEAR_MARCA_PECA: "RENOMEAR_MARCA_PECA",
  DESATIVAR_MARCA_PECA: "DESATIVAR_MARCA_PECA",
  REATIVAR_MARCA_PECA: "REATIVAR_MARCA_PECA",
  // Entrada de nota de compra. Acao propria, e nao CRIAR, porque uma nota
  // lancada nao cria um registro: ela mexe no SALDO e no CUSTO de varios
  // produtos de uma vez, que e a coisa mais consequente que alguem faz no
  // estoque sem estar vendendo nada.
  LANCAR_NOTA_DE_COMPRA: "LANCAR_NOTA_DE_COMPRA",
  // Link de envio de foto pelo celular. Criar e revogar sao registrados
  // porque o link e credencial portadora: quem tem ele sobe foto na OS sem
  // fazer login. Quem abriu esse acesso e quando, e quem fechou, e a unica
  // forma de responder "de onde veio essa foto?" depois.
  CRIAR_LINK_FOTO_OS: "CRIAR_LINK_FOTO_OS",
  REVOGAR_LINK_FOTO_OS: "REVOGAR_LINK_FOTO_OS",
  /** Despesa fixa mensal encerrada (ou reativada) pelo dono — ver `encerrarDespesaFixa`. */
  ENCERRAR_DESPESA_FIXA: "ENCERRAR_DESPESA_FIXA",
  /** Destino dos avisos de vencimento no Telegram alterado. */
  ATUALIZAR_AVISOS_TELEGRAM: "ATUALIZAR_AVISOS_TELEGRAM",
  /** Conta do Bling conectada pelo dono (fluxo OAuth concluido). */
  CONECTAR_BLING: "CONECTAR_BLING",
  /** Conta do Bling desconectada: os tokens sao apagados, as notas ficam. */
  DESCONECTAR_BLING: "DESCONECTAR_BLING",
} as const;

export const ENTIDADES_AUDITORIA = {
  ORDEM_SERVICO: "ORDEM_SERVICO",
  ITEM_OS: "ITEM_OS",
  CONFIGURACAO: "CONFIGURACAO",
  TERMO_GARANTIA_OS: "TERMO_GARANTIA_OS",
  RETORNO_GARANTIA_OS: "RETORNO_GARANTIA_OS",
  META: "META",
  CONTA_PAGAR: "CONTA_PAGAR",
  CONTA_RECEBER: "CONTA_RECEBER",
  VENDA: "VENDA",
  USUARIO_CENTRAL: "USUARIO_CENTRAL",
  CAIXA_SESSION: "CAIXA_SESSION",
  SISTEMA: "SISTEMA",
  // Fase 1D-1 — banco central.
  CARGO: "CARGO",
  USUARIO_EMPRESA: "USUARIO_EMPRESA",
  // Fase 1D-3 — protecao do dono.
  EMPRESA: "EMPRESA",
  // Fase 4 — cadastro de marcas de peca.
  MARCA_PECA: "MARCA_PECA",
  PROPOSTA: "PROPOSTA",
  CATEGORIA_PRODUTO: "CATEGORIA_PRODUTO",
  PRODUTO: "PRODUTO",
  NOTA_DE_COMPRA: "NOTA_DE_COMPRA",
} as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[keyof typeof ACOES_AUDITORIA];
export type EntidadeAuditoria = (typeof ENTIDADES_AUDITORIA)[keyof typeof ENTIDADES_AUDITORIA];
