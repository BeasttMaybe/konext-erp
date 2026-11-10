-- Remove duas configuracoes que nao faziam nada.
--
-- O dono pediu a auditoria: "liste o que funciona de verdade e o que nao
-- funciona". Estas duas foram o resultado.
--
-- `chavePix`: existia so no banco. Nenhuma tela mostrava, nenhum codigo lia.
-- Zero referencias em todo o repositorio fora do schema.
--
-- `habilitarMargemAutomatica`: tinha interruptor na tela de Configuracoes,
-- com o texto "Sugere valores de cobranca com base no custo e margem
-- configurada". Nenhuma linha de codigo consultava o valor. O dono podia
-- ligar e desligar o dia inteiro sem que um unico preco mudasse.
--
-- ISTO APAGA DADOS, E O DONO AUTORIZOU: "sobre a chave pix, pode eliminar
-- junto, a margem automatica elimina junto tambem".
--
-- A volta e o branch de restauracao do Neon, criado antes de aplicar em
-- producao. Por isso esta migration exige `autorizar_destrutivo=true`.

ALTER TABLE "Configuracao" DROP COLUMN IF EXISTS "chavePix";

ALTER TABLE "Configuracao" DROP COLUMN IF EXISTS "habilitarMargemAutomatica";
