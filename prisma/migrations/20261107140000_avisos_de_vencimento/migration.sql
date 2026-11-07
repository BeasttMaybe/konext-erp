-- Aviso de vencimento no Telegram: 3, 2, 1 dias antes e no dia.
--
-- Pedido do dono: "fazer integracao com telegram do contas a receber e
-- contas a pagar, para notificar quando tiver 3 dias proximos do vencimento,
-- dai notifica 3 dias, 2 dias, 1 dia e no dia do vencimento".
--
-- O QUE JA EXISTIA, E NUNCA FUNCIONOU
--
-- /api/cron/verificar-vencimentos roda todo dia as 11:00 UTC desde sempre, e
-- consultava o model `Conta` — tabela legada, com `status` e `tipo` como
-- texto solto, em que NADA no sistema escreve. As contas de verdade vivem em
-- ParcelaDespesa e ContaReceber. Ou seja: o cron rodava todos os dias,
-- encontrava zero linhas e nao avisava nada, dentro nem fora do sistema. E
-- nao havia como notar — um cron que nao acha nada e indistinguivel de um
-- cron que nao tem nada pra achar.
--
-- A TABELA DE AVISO ENVIADO
--
-- Serve a uma coisa so: nao avisar duas vezes. Cron roda duas vezes (
-- redeploy, retry da plataforma, alguem abrindo a URL), e o UNIQUE abaixo e o
-- que garante que o aviso de hoje sai uma vez — no banco, nao na memoria de
-- quem executa.
--
-- `contaId` nao e chave estrangeira de proposito: ele aponta pra
-- ParcelaDespesa OU pra ContaReceber conforme o `tipo`, e as duas tabelas tem
-- ids independentes. Uma FK condicional nao existe no Postgres, e criar duas
-- colunas nullable so pra ter FK tornaria o UNIQUE mais fraco.

CREATE TYPE "TipoDeContaAvisada" AS ENUM ('PAGAR', 'RECEBER');

CREATE TABLE "AvisoDeVencimentoEnviado" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDeContaAvisada" NOT NULL,
    "contaId" TEXT NOT NULL,
    "diasDeAntecedencia" INTEGER NOT NULL,
    "enviadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvisoDeVencimentoEnviado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvisoDeVencimentoEnviado_tipo_contaId_diasDeAntecedencia_key"
    ON "AvisoDeVencimentoEnviado"("tipo", "contaId", "diasDeAntecedencia");

CREATE INDEX "AvisoDeVencimentoEnviado_enviadoEm_idx"
    ON "AvisoDeVencimentoEnviado"("enviadoEm");

-- Destino dos avisos, por loja. O token do bot e segredo de ambiente e e um
-- so; o chat id e identificador, nao segredo, e o proprio dono cola na tela.
ALTER TABLE "Configuracao" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "Configuracao" ADD COLUMN "avisarVencimentoNoTelegram" BOOLEAN NOT NULL DEFAULT true;
