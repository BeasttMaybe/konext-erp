-- Normaliza as DATAS DE CALENDARIO que foram gravadas com hora.
--
-- O dono da loja reportou: filtrar Contas a Pagar "do dia 1 ao dia 30" nao
-- mostrava os boletos do dia 30, e so apareciam filtrando "do dia 1 ao dia 1
-- do mes seguinte". O contorno que ele descobriu e a prova do defeito.
--
-- A CAUSA
--
-- Sete telas montavam a data no NAVEGADOR, com
-- `new Date("2026-11-30T12:00:00")`. Sem sufixo de fuso, o JavaScript
-- interpreta esse texto no fuso de quem digitou: em Sao Paulo (UTC-3),
-- meio-dia local e 15:00 UTC. O banco recebia 2026-11-30 15:00:00.
--
-- A convencao deste projeto (lib/datas.ts) e que data de calendario —
-- vencimento, validade, prazo — mora na MEIA-NOITE UTC, porque ela nao tem
-- hora significativa: o vencimento do dia 30 e dia 30 em qualquer fuso. Todo
-- filtro de periodo compara contra meia-noite UTC. Resultado:
--
--   "dataVencimento" <= '2026-11-30 00:00:00'  -->  15:00 fica FORA
--   "dataVencimento" <= '2026-12-01 00:00:00'  -->  15:00 entra
--
-- Provado contra Postgres antes de escrever esta migration. A tela de edicao
-- gravava `T00:00:00` (03:00 UTC em Sao Paulo), que tinha o mesmo destino.
--
-- O lado do codigo ja esta corrigido: a tela manda TEXTO "aaaa-mm-dd" e o
-- servidor converte com `exigirDataDeCalendario`. Esta migration cuida do
-- que ja esta gravado — sem ela, todo boleto antigo continua invisivel no
-- filtro correto.
--
-- POR QUE `date_trunc` ACERTA O DIA
--
-- A loja opera em UTC-3 e o servidor em UTC. Nesse par, a hora UTC gravada
-- por esses dois padroes (03:00 e 15:00) cai sempre no MESMO dia do
-- calendario, tanto em UTC quanto no fuso da loja. Entao truncar pro inicio
-- do dia UTC devolve exatamente o dia que a pessoa digitou.
--
-- A unica janela em que isso nao valeria e a de 00:00 a 03:00 UTC: ali o dia
-- em Sao Paulo ainda e o anterior, e truncar poderia adiantar a data em um
-- dia. Nenhum dos dois padroes produz hora nessa faixa, e o `WHERE` abaixo a
-- exclui explicitamente em vez de confiar nisso — linha nessa faixa fica
-- intocada, para ser olhada a mao se algum dia existir.
--
-- Idempotente: roda de novo e nao acha nada, porque o proprio `WHERE` exige
-- que a hora seja diferente de meia-noite.

-- Parcelas de despesa (Contas a Pagar) — a tela do bug reportado.
UPDATE "ParcelaDespesa"
   SET "dataVencimento" = date_trunc('day', "dataVencimento")
 WHERE "dataVencimento" <> date_trunc('day', "dataVencimento")
   AND "dataVencimento"::time >= TIME '03:00:00';

-- Contas a receber: mesmo defeito, mesmas telas (edicao e nova conta).
UPDATE "ContaReceber"
   SET "dataVencimento" = date_trunc('day', "dataVencimento")
 WHERE "dataVencimento" <> date_trunc('day', "dataVencimento")
   AND "dataVencimento"::time >= TIME '03:00:00';

UPDATE "ContaReceber"
   SET "dataInicio" = date_trunc('day', "dataInicio")
 WHERE "dataInicio" IS NOT NULL
   AND "dataInicio" <> date_trunc('day', "dataInicio")
   AND "dataInicio"::time >= TIME '03:00:00';
