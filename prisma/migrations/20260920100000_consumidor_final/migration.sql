-- Dados (Fase 3-2C — consumidor final): cria o cliente "Consumidor Final"
-- automático do sistema em todo tenant existente, pra vendas de balcão no
-- PDV sem cliente selecionado passarem a ser registradas nele em vez de
-- ficarem com clienteId nulo.
--
-- Sem alteração de schema (nenhum ADD COLUMN): não há CREATE TYPE/ALTER
-- TABLE nesta migração de propósito — "é o cliente do sistema?" é resolvido
-- por um id FIXO e legível ('consumidor-final', não um uuid gerado),
-- comparado como string em qualquer lugar do código, em vez de uma coluna
-- de flag nova. `prisma migrate diff` não gera nada aqui porque
-- prisma/schema.prisma não muda — este arquivo foi escrito à mão, mesmo
-- padrão de dado-sem-DDL de 20260918120000_adicionar_etapa_situacao_os
-- (ver docs/operacao/migrations.md secão 7).
--
-- Documento sentinela ('CONSUMIDOR_FINAL', não numérico) em vez de string
-- vazia: Cliente.documento é @unique e obrigatório, e um valor claramente
-- não-CPF/CNPJ nunca colide com o documento de um cliente real.
--
-- ON CONFLICT DO NOTHING: idempotente, seguro de reaplicar (ex.: reexecutar
-- `db:migrar` num tenant que já recebeu esta migração por outro caminho).
-- Mesmos valores de lib/dominio/crm/consumidor-final.ts
-- (DADOS_CLIENTE_CONSUMIDOR_FINAL) — mudar um dos dois sem o outro é bug.
INSERT INTO "Cliente" (
  id,
  "tipoPessoa",
  papel,
  "nomeRazaoSocial",
  documento,
  telefone,
  "isWhatsapp",
  categoria,
  observacoes,
  "criadoEm",
  "atualizadoEm"
)
VALUES (
  'consumidor-final',
  'FISICA',
  'CLIENTE',
  'Consumidor Final',
  'CONSUMIDOR_FINAL',
  '',
  true,
  'CLIENTE_FINAL',
  'Cliente automático do sistema — usado para vendas de balcão no PDV sem cliente identificado. Não pode ser editado, excluído nem vinculado a uma Ordem de Serviço.',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
