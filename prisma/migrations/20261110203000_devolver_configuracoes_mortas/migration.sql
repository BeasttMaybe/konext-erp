-- Devolve as duas colunas que 20261110180000 tirou.
--
-- POR QUE VOLTARAM
--
-- Apliquei o drop em producao as 16:01 e o sistema saiu do ar: Dashboard e
-- Ordens de Servico passaram a cair no error boundary, enquanto o menu
-- lateral continuava renderizando normalmente.
--
-- A explicacao esta em `obterConfiguracoes` (app/actions/configuracoes.ts):
-- ela le a Configuracao com `findFirst` SEM `select`, entao o Prisma monta um
-- SELECT com todas as colunas que AQUELE BUILD conhece. As duas telas que
-- quebraram chamam essa funcao; o layout nao chama -- ele usa
-- `exigirContextoTenant`, que pede `select: { fusoHorario: true }`. Bate
-- exatamente com o que o dono viu.
--
-- Ou seja: o build no ar ainda pedia `chavePix`, e a coluna tinha acabado de
-- sumir debaixo dele.
--
-- A ORDEM CERTA, QUE EU NAO SEGUI
--
-- Derrubar coluna e sempre dois passos: primeiro sobe o codigo que para de
-- referenciar a coluna, CONFIRMA que esse codigo esta no ar, e so depois
-- derruba. Eu assumi que o deploy do #31 ja tinha acontecido em vez de
-- verificar -- e nao tenho acesso aos deploys da Vercel para ter verificado.
--
-- Nada de valor se perdeu: as duas colunas nunca foram lidas por codigo
-- nenhum. `chavePix` so existia no banco, e `habilitarMargemAutomatica` tinha
-- interruptor na tela mas nenhuma linha consultava o valor. Voltam vazias, o
-- que e exatamente o que eram.
--
-- Esta migration e ADITIVA: nao precisa de autorizar_destrutivo.

ALTER TABLE "Configuracao" ADD COLUMN IF NOT EXISTS "chavePix" TEXT;

ALTER TABLE "Configuracao" ADD COLUMN IF NOT EXISTS "habilitarMargemAutomatica" BOOLEAN NOT NULL DEFAULT true;
