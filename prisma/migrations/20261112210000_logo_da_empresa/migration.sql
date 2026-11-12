-- Logo da empresa enviada como arquivo (PNG, JPG ou WEBP).
--
-- Tabela propria, e nao coluna em "Configuracao": a configuracao e lida em
-- quase toda requisicao, e os bytes da logo iriam junto em todas. Aqui eles
-- so sao lidos pela rota que serve a imagem.
--
-- So cria tabela: nenhuma versao em producao le ou escreve nela, entao a
-- migration pode rodar antes ou depois do deploy sem quebrar nada.

-- CreateTable
CREATE TABLE "LogoEmpresa" (
    "id" TEXT NOT NULL DEFAULT 'principal',
    "conteudo" BYTEA NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LogoEmpresa_pkey" PRIMARY KEY ("id")
);
