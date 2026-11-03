-- Categorias de produto deixam de ser enum e passam a ser cadastro do dono.
-- E o produto ganha SKU, unidade, compatibilidade e a excecao de venda sem
-- estoque.
--
-- POR QUE: o enum `CategoriaProduto` tinha cinco valores fixos e NENHUMA linha
-- do sistema se comportava diferente por causa deles — serviam so de rotulo na
-- tela e de filtro na lista. Era um cadastro travado em codigo por acidente:
-- criar "Capas" exigia migration e deploy. Conferido antes de escrever esta
-- migration: nao existe nenhum `if (categoria === ...)` no projeto.
--
-- ORDEM DE PUBLICACAO: banco primeiro, codigo depois, como sempre. Esta
-- migration nao quebra o build anterior:
--   * `Produto.categoria` CONTINUA existindo e com todos os valores atuais; so
--     deixa de ser obrigatoria. O build antigo le a coluna e encontra o que
--     sempre esteve la. Linha com `categoria` nula so pode nascer do build
--     NOVO, que por definicao ainda nao esta no ar quando isto roda.
--   * `categoriaId` nasce preenchida em todas as linhas (backfill abaixo) antes
--     de virar NOT NULL, e o build antigo simplesmente ignora a coluna.
--   * `unidade` e `permiteVendaSemEstoque` tem DEFAULT, entao insert do build
--     antigo continua valendo.
--
-- O QUE E DESTRUTIVO AQUI: `ALTER TYPE ... RENAME` e os `UPDATE` de backfill.
-- O rename e transparente pra aplicacao — o Prisma manda o valor do enum como
-- texto e o Postgres resolve pelo tipo da coluna, nao pelo nome do tipo. O
-- rename e necessario porque no Postgres uma TABELA tambem cria um tipo com o
-- proprio nome, entao `CREATE TABLE "CategoriaProduto"` colidiria com o enum
-- de mesmo nome.

-- ── 1. libera o nome "CategoriaProduto" pra tabela ──────────────────────────
ALTER TYPE "CategoriaProduto" RENAME TO "CategoriaProdutoLegado";

-- ── 2. a tabela de categorias ───────────────────────────────────────────────
-- Mesmo formato de MarcaPeca: `nomeNormalizado` e a unicidade real, pra que
-- "Capas", "capas" e "CAPAS " nao coexistam e quebrem o filtro da lista.
CREATE TABLE "CategoriaProduto" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "nomeNormalizado" TEXT NOT NULL,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Sem DEFAULT, igual a MarcaPeca: e `@updatedAt`, o Prisma e quem escreve.
  -- Um DEFAULT aqui apareceria como divergencia no `migrate diff` do CI.
  "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CategoriaProduto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoriaProduto_nomeNormalizado_key"
  ON "CategoriaProduto"("nomeNormalizado");
CREATE INDEX "CategoriaProduto_ativa_idx" ON "CategoriaProduto"("ativa");

-- ── 3. colunas novas do produto ─────────────────────────────────────────────
ALTER TABLE "Produto"
  ADD COLUMN "categoriaId" TEXT,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "unidade" TEXT NOT NULL DEFAULT 'UN',
  ADD COLUMN "compatibilidade" TEXT,
  ADD COLUMN "permiteVendaSemEstoque" BOOLEAN NOT NULL DEFAULT false;

-- `sku` fica NULO no historico de proposito: produto cadastrado antes desta
-- coluna nunca teve SKU, e inventar um aqui criaria codigo que nao esta
-- impresso em etiqueta nenhuma. Quem abrir o produto na tela gera o dele.
CREATE UNIQUE INDEX "Produto_sku_key" ON "Produto"("sku");

-- ── 4. semeia as cinco categorias que existiam no enum ──────────────────────
-- Os rotulos sao os que a tela ja mostrava, e as chaves normalizadas batem com
-- CATEGORIAS_HERDADAS_DO_ENUM em lib/dominio/estoque/categoria.ts.
INSERT INTO "CategoriaProduto" ("id", "nome", "nomeNormalizado", "atualizadoEm") VALUES
  (gen_random_uuid()::text, 'Acessório',           'acessorio',           CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Peça de reparo',      'peca de reparo',      CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Equipamento de rede', 'equipamento de rede', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Serviço',             'servico',             CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Outros',              'outros',              CURRENT_TIMESTAMP);

-- ── 5. liga cada produto a sua categoria ────────────────────────────────────
-- Um UPDATE por valor do enum, em vez de um CASE: assim cada linha diz qual
-- valor antigo virou qual chave nova, e a conferencia e direta.
UPDATE "Produto" SET "categoriaId" = (SELECT "id" FROM "CategoriaProduto" WHERE "nomeNormalizado" = 'acessorio')
  WHERE "categoria" = 'ACESSORIO';
UPDATE "Produto" SET "categoriaId" = (SELECT "id" FROM "CategoriaProduto" WHERE "nomeNormalizado" = 'peca de reparo')
  WHERE "categoria" = 'PECA_REPARO';
UPDATE "Produto" SET "categoriaId" = (SELECT "id" FROM "CategoriaProduto" WHERE "nomeNormalizado" = 'equipamento de rede')
  WHERE "categoria" = 'EQUIPAMENTO_REDE';
UPDATE "Produto" SET "categoriaId" = (SELECT "id" FROM "CategoriaProduto" WHERE "nomeNormalizado" = 'servico')
  WHERE "categoria" = 'SERVICO';
UPDATE "Produto" SET "categoriaId" = (SELECT "id" FROM "CategoriaProduto" WHERE "nomeNormalizado" = 'outros')
  WHERE "categoria" = 'OUTROS';

-- Rede de seguranca: se por qualquer motivo sobrar produto sem categoria, cai
-- em "Outros" em vez de impedir o NOT NULL abaixo. Produto sem categoria
-- nenhuma e pior que produto em "Outros", porque o NOT NULL falhando aborta a
-- migration inteira e deixa o banco na versao antiga.
UPDATE "Produto" SET "categoriaId" = (SELECT "id" FROM "CategoriaProduto" WHERE "nomeNormalizado" = 'outros')
  WHERE "categoriaId" IS NULL;

-- ── 6. agora a categoria e obrigatoria e tem chave estrangeira ──────────────
ALTER TABLE "Produto" ALTER COLUMN "categoriaId" SET NOT NULL;

ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProduto"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Produto_categoriaId_idx" ON "Produto"("categoriaId");

-- ── 7. a coluna do enum antigo deixa de ser obrigatoria ─────────────────────
-- Continua preenchida no historico. O codigo novo nao escreve mais nela, e uma
-- migration de limpeza remove a coluna e o tipo "CategoriaProdutoLegado"
-- depois que o build novo estiver no ar.
ALTER TABLE "Produto" ALTER COLUMN "categoria" DROP NOT NULL;
