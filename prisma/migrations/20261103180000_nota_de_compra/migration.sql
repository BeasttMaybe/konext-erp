-- Entrada de nota de compra: o documento do fornecedor virando estoque.
--
-- Migration quase toda ADITIVA — dois enums e duas tabelas novas, mais uma
-- coluna anulavel em MovimentacaoEstoque. A unica alteracao em algo existente
-- e a renomeacao de um VALOR de enum, que no PostgreSQL nao reescreve linha
-- nenhuma (o valor e guardado por identificador interno, nao pelo texto).
--
-- POR QUE A NOTA FICA GRAVADA, e nao so o efeito dela no estoque:
--
-- 1. IDEMPOTENCIA. `chaveAcesso` e UNICA. Sao os 44 digitos da NF-e, e sao o
--    que impede a mesma nota de entrar duas vezes no estoque — que e o erro
--    mais provavel desta tela, porque o jeito natural de usar um importador e
--    arrastar o arquivo de novo quando nao se tem certeza se ja foi. Sem essa
--    restricao o sistema obedece em silencio e dobra o saldo.
-- 2. PROCEDENCIA DO CUSTO. Quando alguem perguntar daqui a tres meses por que
--    um produto custa o que custa, a resposta e uma linha de uma nota, com
--    data, fornecedor e o frete que foi rateado nela.
--
-- O RASCUNHO NAO FICA GRAVADO. A nota nasce no banco no momento em que e
-- LANCADA, ja conferida. A conferencia inteira acontece na tela, e fechar a
-- aba no meio perde dois minutos de trabalho — o preco de nao ter maquina de
-- estados, status pela metade e nota meio-lancada no banco.

-- CreateEnum
-- Duas portas de entrada, confiabilidades diferentes: o XML e estruturado e
-- assinado, o PDF e desenho interpretado. A tela trata os dois de forma
-- diferente e o historico precisa saber de qual se trata.
CREATE TYPE "OrigemDaNotaDeCompra" AS ENUM ('XML', 'PDF');

-- CreateEnum
-- Transportadora cobra por peso e volume, e a nota nao traz nem um nem outro.
-- Nao existe criterio certo, existe o menos ruim pra carga — e qual foi usado
-- muda o custo de cada item, entao fica gravado junto com o resultado.
CREATE TYPE "CriterioDeRateioDeFrete" AS ENUM ('VALOR', 'QUANTIDADE');

-- CreateTable
CREATE TABLE "NotaDeCompra" (
    "id" TEXT NOT NULL,
    "origem" "OrigemDaNotaDeCompra" NOT NULL,

    -- Os 44 digitos da NF-e. Anulavel porque orcamento e pedido de fornecedor
    -- nao tem chave nenhuma e nunca vao ter — nao existe XML pra eles.
    "chaveAcesso" TEXT,

    "numero" TEXT,
    "serie" TEXT,
    "emitenteNome" TEXT NOT NULL,
    "emitenteCnpj" TEXT,

    -- DATE, nao TIMESTAMP: e a data impressa no documento, nao um instante.
    "emitidaEm" DATE,

    "valorProdutos" DECIMAL(12,2) NOT NULL,
    "valorFrete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorDesconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(12,2) NOT NULL,

    "criterioRateio" "CriterioDeRateioDeFrete" NOT NULL DEFAULT 'VALOR',

    "arquivoNome" TEXT,
    "observacao" TEXT,

    "lancadaPorId" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaDeCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaDeCompraItem" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    -- Como estava escrito no documento, sem tratamento. E por onde a pessoa
    -- acha a linha de volta no papel.
    "descricao" TEXT NOT NULL,
    "codigoFornecedor" TEXT,
    "ean" TEXT,
    "ncm" TEXT,
    "unidade" TEXT,

    -- 4 casas na quantidade e no unitario porque o layout da NF-e usa 4 e 10
    -- respectivamente; o TOTAL da linha e que tem 2 e e a verdade do documento.
    "quantidade" DECIMAL(12,4) NOT NULL,
    "valorUnitario" DECIMAL(12,4) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,

    "rateioFrete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rateioDesconto" DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Linha + frete - desconto, por unidade. E o que foi gravado em
    -- Produto.custo, e fica aqui pra poder conferir depois.
    "custoUnitario" DECIMAL(12,2) NOT NULL,

    -- NULO quando a linha foi IGNORADA na conferencia. A linha ignorada fica
    -- gravada de proposito: "por que isso nao entrou no estoque?" tem que ter
    -- resposta, e a resposta e que foi lida e deixada de fora.
    "produtoId" TEXT,

    -- Se este item foi quem CRIOU o produto, ou so somou saldo a um que ja
    -- existia. Muda a leitura do historico de preco do produto.
    "criouProduto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotaDeCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Unica: e a restricao que impede a mesma nota de entrar duas vezes.
CREATE UNIQUE INDEX "NotaDeCompra_chaveAcesso_key" ON "NotaDeCompra"("chaveAcesso");

-- CreateIndex
CREATE INDEX "NotaDeCompra_criadoEm_idx" ON "NotaDeCompra"("criadoEm");

-- CreateIndex
CREATE INDEX "NotaDeCompra_emitenteNome_idx" ON "NotaDeCompra"("emitenteNome");

-- CreateIndex
CREATE INDEX "NotaDeCompraItem_notaId_idx" ON "NotaDeCompraItem"("notaId");

-- CreateIndex
-- "Quanto eu paguei por este produto nas ultimas compras?" passa por aqui.
CREATE INDEX "NotaDeCompraItem_produtoId_idx" ON "NotaDeCompraItem"("produtoId");

-- AddForeignKey
ALTER TABLE "NotaDeCompraItem" ADD CONSTRAINT "NotaDeCompraItem_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaDeCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, nunca CASCADE: apagar um produto nao pode apagar a linha da nota
-- que comprou ele. A nota e documento, o produto e cadastro.
ALTER TABLE "NotaDeCompraItem" ADD CONSTRAINT "NotaDeCompraItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
-- O valor se chamava COMPRA_XML, de quando o XML era a unica entrada
-- imaginada. Agora o PDF do fornecedor entra pela mesma porta, e uma linha do
-- livro de estoque dizendo "COMPRA_XML" pra uma nota que veio em PDF e
-- simplesmente falsa. RENAME VALUE nao reescreve linha nenhuma: o PostgreSQL
-- guarda o valor do enum por identificador interno, e o texto e so o rotulo.
ALTER TYPE "OrigemMovimentacaoEstoque" RENAME VALUE 'COMPRA_XML' TO 'COMPRA_NOTA';

-- AlterTable
-- Fecha o circuito da auditoria: de uma linha do livro de estoque da pra
-- chegar na nota que a originou, e nao so num texto em `observacao`.
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "notaDeCompraId" TEXT;

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_notaDeCompraId_idx" ON "MovimentacaoEstoque"("notaDeCompraId");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_notaDeCompraId_fkey" FOREIGN KEY ("notaDeCompraId") REFERENCES "NotaDeCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
