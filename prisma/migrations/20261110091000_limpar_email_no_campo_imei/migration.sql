-- Limpa o endereco de e-mail gravado no campo de IMEI.
--
-- O QUE ACONTECEU
--
-- A OS nao tem campo de e-mail. Alguem precisou guardar o e-mail de um
-- cliente e digitou onde deu: no IMEI, que e texto livre. Nada no banco
-- impede e nenhuma tela reclama, entao ficou la.
--
-- O dono autorizou apagar o conteudo ("pode apagar tambem o conteudo. Nao
-- tem hoje a parte do e-mail").
--
-- POR QUE O PADRAO E ANCORADO (^...$)
--
-- So apaga quando o campo INTEIRO e um e-mail. Um campo como
-- "cliente joao@provedor.com" tem conteudo alem do e-mail, e apagar o campo
-- levaria junto o que nao foi pedido -- entao esse caso nao e tocado aqui;
-- ele aparece no relatorio de diagnostico (secao 5b) para decisao humana.
--
-- `btrim` porque espaco antes ou depois nao muda o que o valor e.
--
-- IDEMPOTENTE: rodar de novo nao encontra nada e nao faz nada.

UPDATE "OrdemServico"
   SET imei = NULL
 WHERE imei IS NOT NULL
   AND btrim(imei) ~ '^[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}$';
