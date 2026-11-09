-- Remove as contas a receber criadas a partir das PARCELAS DA NOTA.
--
-- O dono reportou: "as NF estao todas em atraso no contas a receber, porem no
-- bling ja estao baixadas e pagas". Estava certo, e o erro foi de fonte.
--
-- A importacao criava a conta a partir das `parcelas` da nota fiscal. As
-- parcelas sao o PLANO de pagamento — "R$ 250 em 01/12" — e plano nao tem
-- estado: nao existe ali campo nenhum dizendo se foi pago. Entao tudo nascia
-- PENDENTE, e notas de janeiro ja quitadas apareceram como divida atrasada
-- numa tela que o dono usa para saber quanto tem a receber. Isso tambem
-- inflava "A receber" e "em atraso" no painel.
--
-- Quem sabe o que foi baixado e `/contas/receber`, onde cada conta tem
-- `situacao` (1 em aberto, 2 recebido, 3 parcial, 4 devolvido, 5 cancelado).
-- O dado sempre esteve la — a primeira amostra lida ja vinha com
-- `situacao: 2`, "Recebido".
--
-- O QUE EXATAMENTE E APAGADO
--
-- So as linhas da importacao velha. Elas sao reconheciveis sem ambiguidade:
-- `blingParcelaRef` no formato "<idDaNota>:<indice>". As da fonte nova usam
-- o prefixo "conta:", e justamente por isso o prefixo existe.
--
-- Nenhuma conta lancada a mao e tocada (essas tem `blingParcelaRef` nulo), e
-- nenhuma conta de venda do proprio Konext e tocada.
--
-- Apagar, e nao corrigir: nao da para deduzir a situacao real a partir da
-- parcela, que e justamente o que faltava. A proxima sincronizacao recria
-- tudo da fonte certa, com a situacao que a conta tem no Bling.

DELETE FROM "ContaReceber"
 WHERE "blingParcelaRef" IS NOT NULL
   AND "blingParcelaRef" NOT LIKE 'conta:%';
