-- Fotos do aparelho na OS, e o link temporario de envio pelo celular.
--
-- Migration ADITIVA: um enum e duas tabelas novas, nenhuma coluna existente
-- alterada. O build anterior nao conhece nada disto e nao e afetado — vale a
-- ordem normal, banco primeiro e codigo depois.
--
-- POR QUE AGORA: o painel "Fotos do aparelho" existia no detalhe da OS desde a
-- Fase 3-2B com os botoes DESABILITADOS e o texto "chega numa fase futura",
-- porque nao havia onde guardar arquivo. O bucket do R2 foi configurado e o
-- diagnostico de Configuracoes passou nas tres etapas (gravar, ler, apagar),
-- entao agora ha.
--
-- O ARQUIVO NAO FICA NO BANCO. Fica no bucket, e `chaveArmazenamento` guarda o
-- caminho dele. Imagem em coluna de banco encarece backup, deixa consulta lenta
-- e nao traz vantagem nenhuma.

-- CreateEnum
-- Entrada e saida nao sao a mesma prova: a de entrada protege a loja do "voces
-- quebraram minha tela", a de saida registra como o aparelho foi devolvido.
CREATE TYPE "MomentoFotoOS" AS ENUM ('ENTRADA', 'DURANTE', 'SAIDA');

-- CreateTable
CREATE TABLE "FotoOS" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "chaveArmazenamento" TEXT NOT NULL,
    "momento" "MomentoFotoOS" NOT NULL DEFAULT 'ENTRADA',
    "descricao" TEXT,
    "tipoConteudo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "largura" INTEGER,
    "altura" INTEGER,
    "enviadaPorId" TEXT,
    "enviadaPeloCelular" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoOS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Linha no banco, e nao token assinado: da pra revogar antes do prazo e o uso
-- fica rastreavel. O proprio id e o segredo do link.
CREATE TABLE "TokenFotoOS" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "revogadoEm" TIMESTAMPTZ(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenFotoOS_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- A chave e a UNICA ligacao entre a linha e o arquivo no bucket; duas linhas
-- apontando pro mesmo objeto fariam apagar uma delas quebrar a outra.
CREATE UNIQUE INDEX "FotoOS_chaveArmazenamento_key" ON "FotoOS"("chaveArmazenamento");

-- A galeria carrega as fotos de uma OS separadas por momento.
CREATE INDEX "FotoOS_ordemServicoId_momento_idx" ON "FotoOS"("ordemServicoId", "momento");

CREATE INDEX "TokenFotoOS_ordemServicoId_idx" ON "TokenFotoOS"("ordemServicoId");
CREATE INDEX "TokenFotoOS_expiraEm_idx" ON "TokenFotoOS"("expiraEm");

-- AddForeignKey
-- Cascade na OS apaga a LINHA, nunca o objeto no R2. Exclusao de OS aqui e
-- logica (`excluidaEm`), entao isto nao dispara na pratica; quem apaga foto de
-- verdade e a action, que remove o objeto primeiro e a linha depois.
ALTER TABLE "FotoOS" ADD CONSTRAINT "FotoOS_ordemServicoId_fkey"
  FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem enviou e anulavel de proposito: foto que chega pelo link do celular vem
-- sem login.
ALTER TABLE "FotoOS" ADD CONSTRAINT "FotoOS_enviadaPorId_fkey"
  FOREIGN KEY ("enviadaPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TokenFotoOS" ADD CONSTRAINT "TokenFotoOS_ordemServicoId_fkey"
  FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TokenFotoOS" ADD CONSTRAINT "TokenFotoOS_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
