-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleUsuario" AS ENUM ('ADMIN', 'OPERADOR', 'TECNICO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "TipoPapel" AS ENUM ('CLIENTE', 'FORNECEDOR');

-- CreateEnum
CREATE TYPE "CategoriaCliente" AS ENUM ('CLIENTE_FINAL', 'EMPRESA', 'ORGAO_PUBLICO');

-- CreateEnum
CREATE TYPE "EstagioFunil" AS ENUM ('PROSPECCAO', 'DIAGNOSTICO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "StatusPropostaComercial" AS ENUM ('RASCUNHO', 'ENVIADA', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "ResultadoRetornoGarantia" AS ENUM ('PROCEDENTE', 'IMPROCEDENTE', 'SEM_GARANTIA', 'RESOLVIDO_SEM_TROCA', 'TROCA_REALIZADA', 'COBRANCA_ADICIONAL', 'EM_ANALISE');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('AGUARDANDO_ORCAMENTO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'AGUARDANDO_PECA', 'EM_MANUTENCAO', 'GARANTIA_RETORNO', 'PRONTO', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "TipoPeca" AS ENUM ('TELA', 'BATERIA', 'CONECTOR_CARGA', 'TAMPA_IPHONE', 'TAMPA_ANDROID', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'RECEBIDO', 'ATRASADO', 'RENEGOCIADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'TED', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_CREDITO_AVISTA', 'CARTAO_CREDITO_PARCELADO', 'CARTAO_DEBITO', 'BOLETO', 'CREDIARIO', 'EMPENHO_PUBLICO');

-- CreateEnum
CREATE TYPE "OrigemReceita" AS ENUM ('VENDA_PDV', 'ORDEM_SERVICO', 'CONTRATO_RECORRENTE', 'LICITACAO', 'AVULSO');

-- CreateEnum
CREATE TYPE "TipoDespesa" AS ENUM ('UNICA', 'PARCELADA', 'FIXA_MENSAL');

-- CreateEnum
CREATE TYPE "StatusParcelaDespesa" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO');

-- CreateEnum
CREATE TYPE "StatusNotaFiscal" AS ENUM ('EMITIDA', 'CANCELADA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('CLIENTE_FINAL', 'EMPRESA', 'ORGAO_PUBLICO');

-- CreateEnum
CREATE TYPE "CategoriaProduto" AS ENUM ('ACESSORIO', 'PECA_REPARO', 'EQUIPAMENTO_REDE', 'SERVICO', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrigemPedido" AS ENUM ('VENDAS', 'PDV');

-- CreateEnum
CREATE TYPE "CaixaStatus" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "CategoriaMeta" AS ENUM ('FINANCEIRA', 'OPERACIONAL', 'COMERCIAL', 'ESTOQUE', 'ESTRUTURAL', 'EQUIPAMENTO', 'REFORMA', 'OUTRA');

-- CreateEnum
CREATE TYPE "TipoValorMeta" AS ENUM ('DINHEIRO', 'QUANTIDADE', 'PERCENTUAL', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "OrigemProgressoMeta" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "DirecaoMeta" AS ENUM ('MAIOR_MELHOR', 'MENOR_MELHOR');

-- CreateEnum
CREATE TYPE "FonteAutomaticaMeta" AS ENUM ('ORDENS_SERVICO', 'FINANCEIRO', 'PDV', 'VENDAS', 'ESTOQUE', 'GARANTIAS');

-- CreateEnum
CREATE TYPE "MetricaAutomaticaMeta" AS ENUM ('FATURAMENTO_OS', 'QUANTIDADE_OS_FINALIZADAS', 'QUANTIDADE_OS_CRIADAS', 'TICKET_MEDIO_OS', 'TAXA_RETORNO_GARANTIA', 'GARANTIAS_ATIVAS', 'RETORNOS_GARANTIA', 'FATURAMENTO_PDV', 'QUANTIDADE_VENDAS', 'RECEBIMENTOS_FINANCEIRO', 'DESPESAS_FINANCEIRO', 'QUANTIDADE_ITEM_ESTOQUE');

-- CreateEnum
CREATE TYPE "PrioridadeMeta" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "StatusMeta" AS ENUM ('EM_ANDAMENTO', 'ATENCAO', 'ATRASADA', 'CONCLUIDA', 'PAUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoHistoricoMeta" AS ENUM ('CRIACAO', 'ATUALIZACAO_PROGRESSO', 'ALTERACAO_STATUS', 'ALTERACAO_PRAZO', 'ALTERACAO_CHECKLIST', 'SINCRONIZACAO_AUTOMATICA', 'CONCLUSAO', 'PAUSA', 'CANCELAMENTO', 'OBSERVACAO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "fotoPerfilUrl" TEXT,
    "role" "RoleUsuario" NOT NULL DEFAULT 'ADMIN',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "empresaId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "motivo" TEXT,
    "origem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL DEFAULT '',
    "nomeFantasia" TEXT NOT NULL DEFAULT 'Konext',
    "cnpj" TEXT NOT NULL DEFAULT '',
    "inscricaoEstadual" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "cep" TEXT NOT NULL DEFAULT '',
    "logradouro" TEXT NOT NULL DEFAULT '',
    "numero" TEXT NOT NULL DEFAULT '',
    "bairro" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT '',
    "endereco" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "chavePix" TEXT,
    "mensagemCupom" TEXT,
    "habilitarMargemAutomatica" BOOLEAN NOT NULL DEFAULT true,
    "permitirVendaSemEstoque" BOOLEAN NOT NULL DEFAULT false,
    "permitirPagamentoMisto" BOOLEAN NOT NULL DEFAULT true,
    "permitirDescontoPDV" BOOLEAN NOT NULL DEFAULT true,
    "descontoMaximoPDVPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "permitirVendaFiado" BOOLEAN NOT NULL DEFAULT false,
    "habilitarPix" BOOLEAN NOT NULL DEFAULT true,
    "habilitarDinheiro" BOOLEAN NOT NULL DEFAULT true,
    "habilitarCartaoDebito" BOOLEAN NOT NULL DEFAULT true,
    "habilitarCartaoCredito" BOOLEAN NOT NULL DEFAULT true,
    "habilitarBoleto" BOOLEAN NOT NULL DEFAULT false,
    "habilitarCrediario" BOOLEAN NOT NULL DEFAULT false,
    "taxaCartaoDebitoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito1xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito2xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito3xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito4xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito5xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito6xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito7xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito8xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito9xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito10xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito11xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaCartaoCredito12xPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "prazoPadraoBoletoDias" INTEGER NOT NULL DEFAULT 7,
    "prazoPadraoCrediarioDias" INTEGER NOT NULL DEFAULT 30,
    "maxParcelasCartaoCredito" INTEGER NOT NULL DEFAULT 12,
    "prazoGarantiaPadraoDias" INTEGER NOT NULL DEFAULT 90,
    "prazoMinimoGarantiaDias" INTEGER NOT NULL DEFAULT 1,
    "prazoMaximoGarantiaDias" INTEGER NOT NULL DEFAULT 365,
    "exigirGarantiaAntesEntrega" BOOLEAN NOT NULL DEFAULT true,
    "exigirItemParaGarantia" BOOLEAN NOT NULL DEFAULT true,
    "exigirItemParaEnviarPDV" BOOLEAN NOT NULL DEFAULT true,
    "exigirDiagnosticoParaFinalizar" BOOLEAN NOT NULL DEFAULT false,
    "permitirFinalizarSemPagamento" BOOLEAN NOT NULL DEFAULT true,
    "permitirGarantiaPersonalizada" BOOLEAN NOT NULL DEFAULT true,
    "textoCoberturaGarantia" TEXT,
    "textoExclusoesGarantia" TEXT,
    "textoResponsabilidadeDados" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'FISICA',
    "papel" "TipoPapel" NOT NULL DEFAULT 'CLIENTE',
    "nomeRazaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "documento" TEXT NOT NULL,
    "inscricaoEstadual" TEXT,
    "email" TEXT,
    "telefone" TEXT NOT NULL,
    "isWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "categoria" "CategoriaCliente" NOT NULL DEFAULT 'CLIENTE_FINAL',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidade" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estagio" "EstagioFunil" NOT NULL DEFAULT 'PROSPECCAO',
    "dataFechamento" TIMESTAMP(3),
    "clienteId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaComercial" (
    "id" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "aosCuidados" TEXT,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "validade" TIMESTAMP(3) NOT NULL,
    "proximoContato" TIMESTAMP(3),
    "equipamento" TEXT,
    "defeito" TEXT,
    "introducao" TEXT,
    "condicoesPagamento" TEXT,
    "termosGarantia" TEXT,
    "observacoesInternas" TEXT,
    "subtotalBruto" DOUBLE PRECISION NOT NULL,
    "descontoTotal" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "status" "StatusPropostaComercial" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaItem" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "descontoPercentual" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "numeroOs" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "equipamento" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "imei" TEXT,
    "senha" TEXT,
    "senhaDesenho" TEXT,
    "relatoCliente" TEXT NOT NULL,
    "condicaoFisica" TEXT,
    "acessorios" TEXT,
    "status" "StatusOS" NOT NULL DEFAULT 'AGUARDANDO_ORCAMENTO',
    "ehRetornoGarantia" BOOLEAN NOT NULL DEFAULT false,
    "osOrigemGarantiaId" TEXT,
    "retornoGarantiaId" TEXT,
    "observacoes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "excluidaEm" TIMESTAMP(3),
    "excluidaPorId" TEXT,
    "motivoExclusao" TEXT,
    "statusAnterior" "StatusOS",
    "prazoGarantiaDias" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermoGarantiaOS" (
    "id" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "prazoGarantiaDias" INTEGER NOT NULL DEFAULT 90,
    "dataInicioGarantia" TIMESTAMP(3) NOT NULL,
    "dataFimGarantia" TIMESTAMP(3) NOT NULL,
    "textoGarantia" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermoGarantiaOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetornoGarantiaOS" (
    "id" TEXT NOT NULL,
    "termoGarantiaId" TEXT NOT NULL,
    "osOrigemId" TEXT,
    "osRetornoId" TEXT,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "analiseTecnica" TEXT,
    "resultado" "ResultadoRetornoGarantia" NOT NULL DEFAULT 'EM_ANALISE',
    "descricaoServico" TEXT,
    "pecasAdicionais" TEXT,
    "houveTroca" BOOLEAN NOT NULL DEFAULT false,
    "houveCobranca" BOOLEAN NOT NULL DEFAULT false,
    "valorAdicional" DECIMAL(65,30),
    "observacoesTecnicas" TEXT,
    "finalizadoEm" TIMESTAMP(3),
    "finalizadoPorId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetornoGarantiaOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOS" (
    "id" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipoPeca" "TipoPeca" NOT NULL,
    "custoPeca" DOUBLE PRECISION NOT NULL,
    "valorCobrado" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaReceber" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "valor" DOUBLE PRECISION NOT NULL,
    "observacaoLancamento" TEXT,
    "observacaoPagamento" TEXT,
    "parcelamentoId" TEXT,
    "numeroParcela" INTEGER NOT NULL DEFAULT 1,
    "totalParcelas" INTEGER NOT NULL DEFAULT 1,
    "dataInicio" TIMESTAMP(3),
    "dataFinalizacao" TIMESTAMP(3),
    "clienteId" TEXT,
    "pedidoId" TEXT,
    "ordemServicoId" TEXT,
    "vendaId" TEXT,
    "vendaPagamentoId" TEXT,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataRecebimento" TIMESTAMP(3),
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "formaPagamento" "FormaPagamento",
    "formaRecebimento" "FormaPagamento" NOT NULL,
    "origem" "OrigemReceita" NOT NULL,
    "notaFiscalEmitida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaReceber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "tipo" "TipoDespesa" NOT NULL,
    "qtdParcelas" INTEGER NOT NULL,
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaDespesa" (
    "id" TEXT NOT NULL,
    "despesaId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "status" "StatusParcelaDespesa" NOT NULL DEFAULT 'PENDENTE',
    "valorPago" DOUBLE PRECISION,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelaDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "chaveAcesso" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "status" "StatusNotaFiscal" NOT NULL DEFAULT 'PENDENTE',
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "imagemUrl" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaProduto" NOT NULL,
    "custo" DOUBLE PRECISION NOT NULL,
    "precoVenda" DOUBLE PRECISION NOT NULL,
    "quantidadeEstoque" INTEGER NOT NULL DEFAULT 0,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 3,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conta" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoVenda" (
    "id" TEXT NOT NULL,
    "numeroPedido" SERIAL NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'PENDENTE',
    "clienteId" TEXT,
    "vendaId" TEXT,
    "vendedor" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "origem" "OrigemPedido" NOT NULL DEFAULT 'VENDAS',
    "formaPagamento" "FormaPagamento",
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoVendaItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "descontoPorcentagem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoVendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoVendaParcela" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoVendaParcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessionId" TEXT,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendaPagamento" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valorBruto" DOUBLE PRECISION NOT NULL,
    "percentualTaxa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTaxa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorLiquido" DOUBLE PRECISION NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "diasVencimento" INTEGER,
    "dataVencimento" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendaPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT,
    "descricao" TEXT NOT NULL DEFAULT '',
    "quantidade" INTEGER NOT NULL,
    "custoUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaixaSession" (
    "id" TEXT NOT NULL,
    "status" "CaixaStatus" NOT NULL DEFAULT 'ABERTO',
    "valorAbertura" DOUBLE PRECISION NOT NULL,
    "valorFechamento" DOUBLE PRECISION,
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFechamento" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaixaSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaMeta" NOT NULL,
    "tipoValor" "TipoValorMeta" NOT NULL,
    "origemProgresso" "OrigemProgressoMeta" NOT NULL DEFAULT 'MANUAL',
    "fonteAutomatica" "FonteAutomaticaMeta",
    "metricaAutomatica" "MetricaAutomaticaMeta",
    "configuracaoAutomatica" JSONB,
    "direcao" "DirecaoMeta" NOT NULL DEFAULT 'MAIOR_MELHOR',
    "valorAlvo" DOUBLE PRECISION,
    "valorAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidade" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataPrazo" TIMESTAMP(3),
    "ultimaSincronizacaoEm" TIMESTAMP(3),
    "erroSincronizacao" TEXT,
    "prioridade" "PrioridadeMeta" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusMeta" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "criadoPorId" TEXT,
    "excluidaEm" TIMESTAMP(3),
    "excluidaPorId" TEXT,
    "concluidaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemChecklistMeta" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemChecklistMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoMeta" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "tipo" "TipoHistoricoMeta" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorAnterior" DOUBLE PRECISION,
    "valorNovo" DOUBLE PRECISION,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_empresaId_idx" ON "LogAuditoria"("empresaId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_idx" ON "LogAuditoria"("entidade");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidadeId_idx" ON "LogAuditoria"("entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_acao_idx" ON "LogAuditoria"("acao");

-- CreateIndex
CREATE INDEX "LogAuditoria_criadoEm_idx" ON "LogAuditoria"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_documento_key" ON "Cliente"("documento");

-- CreateIndex
CREATE INDEX "Oportunidade_clienteId_idx" ON "Oportunidade"("clienteId");

-- CreateIndex
CREATE INDEX "Oportunidade_estagio_idx" ON "Oportunidade"("estagio");

-- CreateIndex
CREATE INDEX "PropostaComercial_status_idx" ON "PropostaComercial"("status");

-- CreateIndex
CREATE INDEX "PropostaComercial_dataEmissao_idx" ON "PropostaComercial"("dataEmissao");

-- CreateIndex
CREATE INDEX "PropostaItem_propostaId_idx" ON "PropostaItem"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_numeroOs_key" ON "OrdemServico"("numeroOs");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_retornoGarantiaId_key" ON "OrdemServico"("retornoGarantiaId");

-- CreateIndex
CREATE INDEX "OrdemServico_excluidaEm_idx" ON "OrdemServico"("excluidaEm");

-- CreateIndex
CREATE INDEX "OrdemServico_excluidaPorId_idx" ON "OrdemServico"("excluidaPorId");

-- CreateIndex
CREATE INDEX "OrdemServico_ehRetornoGarantia_idx" ON "OrdemServico"("ehRetornoGarantia");

-- CreateIndex
CREATE INDEX "OrdemServico_osOrigemGarantiaId_idx" ON "OrdemServico"("osOrigemGarantiaId");

-- CreateIndex
CREATE UNIQUE INDEX "TermoGarantiaOS_osId_key" ON "TermoGarantiaOS"("osId");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_dataFimGarantia_idx" ON "TermoGarantiaOS"("dataFimGarantia");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_dataInicioGarantia_idx" ON "TermoGarantiaOS"("dataInicioGarantia");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_criadoEm_idx" ON "TermoGarantiaOS"("criadoEm");

-- CreateIndex
CREATE INDEX "TermoGarantiaOS_canceladaEm_idx" ON "TermoGarantiaOS"("canceladaEm");

-- CreateIndex
CREATE UNIQUE INDEX "RetornoGarantiaOS_osRetornoId_key" ON "RetornoGarantiaOS"("osRetornoId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_termoGarantiaId_idx" ON "RetornoGarantiaOS"("termoGarantiaId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_osOrigemId_idx" ON "RetornoGarantiaOS"("osOrigemId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_osRetornoId_idx" ON "RetornoGarantiaOS"("osRetornoId");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_criadoEm_idx" ON "RetornoGarantiaOS"("criadoEm");

-- CreateIndex
CREATE INDEX "RetornoGarantiaOS_finalizadoEm_idx" ON "RetornoGarantiaOS"("finalizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ContaReceber_vendaPagamentoId_key" ON "ContaReceber"("vendaPagamentoId");

-- CreateIndex
CREATE INDEX "ContaReceber_parcelamentoId_idx" ON "ContaReceber"("parcelamentoId");

-- CreateIndex
CREATE INDEX "ContaReceber_pedidoId_idx" ON "ContaReceber"("pedidoId");

-- CreateIndex
CREATE INDEX "ContaReceber_vendaId_idx" ON "ContaReceber"("vendaId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigoBarras_key" ON "Produto"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoVenda_numeroPedido_key" ON "PedidoVenda"("numeroPedido");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoVenda_vendaId_key" ON "PedidoVenda"("vendaId");

-- CreateIndex
CREATE INDEX "PedidoVenda_clienteId_idx" ON "PedidoVenda"("clienteId");

-- CreateIndex
CREATE INDEX "PedidoVenda_status_idx" ON "PedidoVenda"("status");

-- CreateIndex
CREATE INDEX "PedidoVenda_origem_idx" ON "PedidoVenda"("origem");

-- CreateIndex
CREATE INDEX "PedidoVenda_dataCriacao_idx" ON "PedidoVenda"("dataCriacao");

-- CreateIndex
CREATE INDEX "PedidoVendaItem_pedidoId_idx" ON "PedidoVendaItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoVendaItem_produtoId_idx" ON "PedidoVendaItem"("produtoId");

-- CreateIndex
CREATE INDEX "PedidoVendaParcela_pedidoId_idx" ON "PedidoVendaParcela"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoVendaParcela_dataVencimento_idx" ON "PedidoVendaParcela"("dataVencimento");

-- CreateIndex
CREATE INDEX "VendaPagamento_vendaId_idx" ON "VendaPagamento"("vendaId");

-- CreateIndex
CREATE INDEX "VendaPagamento_formaPagamento_idx" ON "VendaPagamento"("formaPagamento");

-- CreateIndex
CREATE INDEX "VendaPagamento_dataVencimento_idx" ON "VendaPagamento"("dataVencimento");

-- CreateIndex
CREATE INDEX "VendaPagamento_criadoEm_idx" ON "VendaPagamento"("criadoEm");

-- CreateIndex
CREATE INDEX "Meta_status_idx" ON "Meta"("status");

-- CreateIndex
CREATE INDEX "Meta_categoria_idx" ON "Meta"("categoria");

-- CreateIndex
CREATE INDEX "Meta_prioridade_idx" ON "Meta"("prioridade");

-- CreateIndex
CREATE INDEX "Meta_dataPrazo_idx" ON "Meta"("dataPrazo");

-- CreateIndex
CREATE INDEX "Meta_criadoEm_idx" ON "Meta"("criadoEm");

-- CreateIndex
CREATE INDEX "Meta_excluidaEm_idx" ON "Meta"("excluidaEm");

-- CreateIndex
CREATE INDEX "Meta_origemProgresso_idx" ON "Meta"("origemProgresso");

-- CreateIndex
CREATE INDEX "Meta_fonteAutomatica_idx" ON "Meta"("fonteAutomatica");

-- CreateIndex
CREATE INDEX "Meta_metricaAutomatica_idx" ON "Meta"("metricaAutomatica");

-- CreateIndex
CREATE INDEX "Meta_ultimaSincronizacaoEm_idx" ON "Meta"("ultimaSincronizacaoEm");

-- CreateIndex
CREATE INDEX "ItemChecklistMeta_metaId_idx" ON "ItemChecklistMeta"("metaId");

-- CreateIndex
CREATE INDEX "HistoricoMeta_metaId_idx" ON "HistoricoMeta"("metaId");

-- CreateIndex
CREATE INDEX "HistoricoMeta_tipo_idx" ON "HistoricoMeta"("tipo");

-- CreateIndex
CREATE INDEX "HistoricoMeta_criadoEm_idx" ON "HistoricoMeta"("criadoEm");

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaItem" ADD CONSTRAINT "PropostaItem_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_osOrigemGarantiaId_fkey" FOREIGN KEY ("osOrigemGarantiaId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_retornoGarantiaId_fkey" FOREIGN KEY ("retornoGarantiaId") REFERENCES "RetornoGarantiaOS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_excluidaPorId_fkey" FOREIGN KEY ("excluidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoGarantiaOS" ADD CONSTRAINT "TermoGarantiaOS_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoGarantiaOS" ADD CONSTRAINT "TermoGarantiaOS_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetornoGarantiaOS" ADD CONSTRAINT "RetornoGarantiaOS_termoGarantiaId_fkey" FOREIGN KEY ("termoGarantiaId") REFERENCES "TermoGarantiaOS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetornoGarantiaOS" ADD CONSTRAINT "RetornoGarantiaOS_osOrigemId_fkey" FOREIGN KEY ("osOrigemId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetornoGarantiaOS" ADD CONSTRAINT "RetornoGarantiaOS_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOS" ADD CONSTRAINT "ItemOS_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_vendaPagamentoId_fkey" FOREIGN KEY ("vendaPagamentoId") REFERENCES "VendaPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaDespesa" ADD CONSTRAINT "ParcelaDespesa_despesaId_fkey" FOREIGN KEY ("despesaId") REFERENCES "Despesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conta" ADD CONSTRAINT "Conta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoVendaItem" ADD CONSTRAINT "PedidoVendaItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoVendaItem" ADD CONSTRAINT "PedidoVendaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoVendaParcela" ADD CONSTRAINT "PedidoVendaParcela_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_caixaSessionId_fkey" FOREIGN KEY ("caixaSessionId") REFERENCES "CaixaSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaPagamento" ADD CONSTRAINT "VendaPagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemChecklistMeta" ADD CONSTRAINT "ItemChecklistMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoMeta" ADD CONSTRAINT "HistoricoMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
