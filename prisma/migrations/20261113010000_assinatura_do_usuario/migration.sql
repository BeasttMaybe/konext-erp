-- Assinatura de cada usuario, que sai pronta na OS, no termo e na proposta.
--
-- So cria tabela: nenhuma versao em producao le ou escreve nela, entao a
-- migration pode rodar antes ou depois do deploy sem quebrar nada.

-- CreateTable
CREATE TABLE "AssinaturaUsuario" (
    "usuarioId" TEXT NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AssinaturaUsuario_pkey" PRIMARY KEY ("usuarioId")
);

-- AddForeignKey
ALTER TABLE "AssinaturaUsuario" ADD CONSTRAINT "AssinaturaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
