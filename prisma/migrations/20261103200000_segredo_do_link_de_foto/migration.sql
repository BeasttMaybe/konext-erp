-- O link de envio de foto pelo celular ganha um SEGREDO de verdade.
--
-- A tabela TokenFotoOS nasceu na migration 20261103140000_fotos_da_os com o
-- `id` (uuid) fazendo as vezes de token. Funcionaria, mas e o desenho errado
-- pra uma credencial portadora — quem tem o link entra, e so isso:
--
-- 1. O id e CHAVE PRIMARIA. Ele aparece em consulta, em log de banco, em
--    relatorio e em qualquer lugar que mostre a linha. Um valor que da acesso
--    nao pode ser o mesmo valor que o sistema usa pra se referir a linha.
-- 2. Guardado em texto puro, qualquer leitura do banco entrega TODOS os links
--    vivos de uma vez, prontos pra usar.
--
-- O desenho certo e o mesmo de senha e de sessao: o segredo e sorteado, vai
-- pro link UMA vez, e o banco guarda so o SHA-256 dele. Perdeu o link, nao se
-- recupera — gera outro. O banco nunca tem como reconstruir nenhum.
--
-- E isto tambem e o "identificador publico seguro" que o comentario de
-- app/rastreio/[id]/page.tsx espera desde que a rota publica existe: um token
-- opaco associado a OS, que permite resolver o tenant sem sessao e sem
-- varredura entre bancos. O rastreio nao muda agora, mas a peca existe.

-- Limpeza antes da coluna obrigatoria.
--
-- A tabela esta vazia em todo tenant, e isso nao e suposicao: nenhuma action
-- jamais criou uma linha aqui — o botao "Enviar pelo celular" ficou
-- DESABILITADO desde que a tela nasceu, com o texto "chega na proxima etapa".
-- Uma linha que existisse seria inutilizavel de qualquer forma, porque nao ha
-- segredo que case com ela.
DELETE FROM "TokenFotoOS";

-- AlterTable
-- SHA-256 em hexadecimal: 64 caracteres, tamanho fixo. O segredo em si tem 32
-- bytes sorteados (256 bits) e nunca e gravado.
ALTER TABLE "TokenFotoOS" ADD COLUMN "tokenHash" TEXT NOT NULL;

-- Quando o link foi usado pela ultima vez. Serve pra tela responder "esse
-- link ja foi aberto?" sem precisar cruzar com as fotos — a pergunta que
-- aparece quando alguem manda o link e o aparelho nao chega.
ALTER TABLE "TokenFotoOS" ADD COLUMN "ultimoUsoEm" TIMESTAMPTZ(3);

-- CreateIndex
-- Unico e a forma de procurar: a rota publica recebe o segredo, calcula o
-- hash e busca por ele. Sem indice, cada abertura de link varreria a tabela.
CREATE UNIQUE INDEX "TokenFotoOS_tokenHash_key" ON "TokenFotoOS"("tokenHash");
