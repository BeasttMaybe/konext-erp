-- Conexao da loja com o Bling (somente leitura).
--
-- O dono escolheu o desenho: ele continua emitindo a nota no Bling, onde ja
-- esta o motor fiscal e a contabilidade, e a Konext PUXA as notas emitidas
-- para consulta e para alimentar o financeiro. Os escopos pedidos no cadastro
-- do aplicativo sao so de leitura — e isso nao e detalhe, e o que garante que
-- um bug deste lado nao emite, cancela nem da baixa em nada.
--
-- UMA LINHA POR LOJA, como Configuracao. O banco ja e por tenant.
--
-- A TRAVA DA RENOVACAO
--
-- O refresh token do Bling v3 ROTACIONA A CADA USO: ao renovar, ele devolve
-- um novo refresh token e invalida o anterior. Duas renovacoes simultaneas
-- se matam — a segunda chega com um token que a primeira ja invalidou, e a
-- conexao cai de vez, exigindo reconexao manual sem que ninguem entenda o
-- motivo. E dois requests paralelos chegando com o token vencido e o caso
-- NORMAL, nao o raro.
--
-- `renovandoDesde` guarda o INSTANTE, nao um booleano, para a trava poder
-- destravar sozinha: um processo que morresse no meio da renovacao deixaria
-- um booleano preso para sempre.

CREATE TABLE "IntegracaoBling" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "renovandoDesde" TIMESTAMPTZ(3),
    "estadoPendente" TEXT,
    "estadoPendenteEm" TIMESTAMPTZ(3),
    "conectadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conectadoPor" TEXT,
    "ultimaSincronizacaoEm" TIMESTAMPTZ(3),
    "ultimoErro" TEXT,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IntegracaoBling_pkey" PRIMARY KEY ("id")
);
