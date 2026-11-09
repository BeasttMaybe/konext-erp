-- Remove o funil de vendas: tabela "Oportunidade" e o enum "EstagioFunil".
--
-- O DONO PEDIU, E O CODIGO JA NAO USA
--
-- "CRM reduzido: quero so Clientes e Propostas; Oportunidades e Funil de
-- vendas sao descartaveis". As telas e as actions ja foram removidas antes
-- desta migration -- hoje as duas unicas mencoes a "Oportunidade" no codigo
-- sao COMENTARIOS em prosa. O que sobrou foi a tabela no banco, guardando
-- linhas que nenhuma tela mostra.
--
-- ISTO APAGA DADOS, E NAO TEM VOLTA PELO CODIGO
--
-- A volta e o branch de restauracao do Neon que o workflow cria antes de
-- aplicar em producao (ver docs/operacao/migrations.md). Por isso esta
-- migration exige `autorizar_destrutivo=true` no disparo.
--
-- A ORDEM IMPORTA: a tabela sai primeiro porque a coluna "estagio" depende
-- do enum. Derrubar o enum antes falharia.

DROP TABLE IF EXISTS "Oportunidade";

DROP TYPE IF EXISTS "EstagioFunil";
