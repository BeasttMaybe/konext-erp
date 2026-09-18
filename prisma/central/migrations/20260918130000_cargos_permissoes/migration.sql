-- AlterTable
ALTER TABLE "UsuarioEmpresa" ADD COLUMN     "cargoId" TEXT;

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "fixo" BOOLEAN NOT NULL DEFAULT false,
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoPermissao" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "permissao" TEXT NOT NULL,

    CONSTRAINT "CargoPermissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "motivo" TEXT,
    "origem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cargo_empresaId_idx" ON "Cargo"("empresaId");

-- CreateIndex
CREATE INDEX "Cargo_arquivadoEm_idx" ON "Cargo"("arquivadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_empresaId_nome_key" ON "Cargo"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "CargoPermissao_cargoId_idx" ON "CargoPermissao"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoPermissao_cargoId_permissao_key" ON "CargoPermissao"("cargoId", "permissao");

-- CreateIndex
CREATE INDEX "LogAuditoria_empresaId_idx" ON "LogAuditoria"("empresaId");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_idx" ON "LogAuditoria"("entidade");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidadeId_idx" ON "LogAuditoria"("entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_acao_idx" ON "LogAuditoria"("acao");

-- CreateIndex
CREATE INDEX "LogAuditoria_criadoEm_idx" ON "LogAuditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "UsuarioEmpresa_cargoId_idx" ON "UsuarioEmpresa"("cargoId");

-- AddForeignKey
ALTER TABLE "UsuarioEmpresa" ADD CONSTRAINT "UsuarioEmpresa_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoPermissao" ADD CONSTRAINT "CargoPermissao_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioCentral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Backfill (Fase 1D-1): cria os 5 cargos padrao em toda empresa existente,
-- concede as permissoes de cada um (mesmo catalogo de lib/auth/permissoes.ts
-- no momento desta migracao) e aponta cada UsuarioEmpresa existente pro
-- cargo equivalente ao RoleEmpresa que ja tinha. Nenhum usuario fica sem
-- cargo. RoleEmpresa NAO e alterado nem removido -- continua em escrita
-- dupla (ver docs/operacao/migrations.md e lib/auth/mapear-cargo-legado.ts).
-- ============================================================================

-- 1. Os 5 cargos padrao, um conjunto por empresa.
INSERT INTO "Cargo" (id, "empresaId", nome, descricao, fixo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid(), e.id, 'Administrador',
       'Acesso total ao sistema. Não pode ser editado, renomeado ou arquivado.',
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Empresa" e;

INSERT INTO "Cargo" (id, "empresaId", nome, descricao, fixo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid(), e.id, 'Gerente',
       'Acesso total ao sistema, exceto as configurações de empresa, sistema e usuários.',
       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Empresa" e;

INSERT INTO "Cargo" (id, "empresaId", nome, descricao, fixo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid(), e.id, 'Técnico',
       'Executa ordens de serviço: cria, edita, finaliza e reabre OS; consulta estoque, CRM e metas.',
       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Empresa" e;

INSERT INTO "Cargo" (id, "empresaId", nome, descricao, fixo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid(), e.id, 'Atendente',
       'Atendimento e frente de caixa: cria e edita OS, vende no PDV, abre e fecha caixa, consulta CRM e estoque.',
       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Empresa" e;

INSERT INTO "Cargo" (id, "empresaId", nome, descricao, fixo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid(), e.id, 'Financeiro',
       'Módulo financeiro completo, com visão de custos de OS e estoque e do dashboard financeiro.',
       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Empresa" e;

-- 2. Permissoes de cada cargo. Administrador tambem recebe as linhas (para
--    qualquer leitura direta da tabela), mas em tempo de execucao um cargo
--    fixo=true sempre resolve pro catalogo INTEIRO, nunca por estas linhas
--    -- ver lib/auth/invariantes-cargos.ts.
INSERT INTO "CargoPermissao" (id, "cargoId", permissao)
SELECT gen_random_uuid(), c.id, p.permissao
FROM "Cargo" c
CROSS JOIN (VALUES
  ('os.criar'), ('os.editar'), ('os.excluir'), ('os.reabrir'), ('os.finalizar'), ('os.ver_custos'), ('os.ver'), ('os.ver_todas'),
  ('pdv.vender'), ('pdv.aplicar_desconto_acima_limite'), ('caixa.abrir'), ('caixa.fechar'), ('caixa.ver_historico'), ('caixa.ver'), ('caixa.ver_todos'),
  ('estoque.ver'), ('estoque.editar'), ('estoque.ver_custos'), ('estoque.excluir'),
  ('crm.ver'), ('crm.editar'), ('crm.excluir'), ('propostas.editar'), ('propostas.excluir'),
  ('financeiro.ver'), ('financeiro.lancar'), ('financeiro.baixar'), ('financeiro.editar'), ('financeiro.excluir'), ('financeiro.ver_todos'),
  ('metas.ver'), ('metas.editar'), ('metas.excluir'),
  ('vendas.criar'), ('vendas.aprovar'), ('vendas.cancelar'),
  ('configuracoes.empresa'), ('configuracoes.sistema'), ('configuracoes.usuarios'),
  ('auditoria.ver'), ('dashboard.financeiro')
) AS p(permissao)
WHERE c.nome = 'Administrador';

INSERT INTO "CargoPermissao" (id, "cargoId", permissao)
SELECT gen_random_uuid(), c.id, p.permissao
FROM "Cargo" c
CROSS JOIN (VALUES
  ('os.criar'), ('os.editar'), ('os.excluir'), ('os.reabrir'), ('os.finalizar'), ('os.ver_custos'), ('os.ver'), ('os.ver_todas'),
  ('pdv.vender'), ('pdv.aplicar_desconto_acima_limite'), ('caixa.abrir'), ('caixa.fechar'), ('caixa.ver_historico'), ('caixa.ver'), ('caixa.ver_todos'),
  ('estoque.ver'), ('estoque.editar'), ('estoque.ver_custos'), ('estoque.excluir'),
  ('crm.ver'), ('crm.editar'), ('crm.excluir'), ('propostas.editar'), ('propostas.excluir'),
  ('financeiro.ver'), ('financeiro.lancar'), ('financeiro.baixar'), ('financeiro.editar'), ('financeiro.excluir'), ('financeiro.ver_todos'),
  ('metas.ver'), ('metas.editar'), ('metas.excluir'),
  ('vendas.criar'), ('vendas.aprovar'), ('vendas.cancelar'),
  ('auditoria.ver'), ('dashboard.financeiro')
) AS p(permissao)
WHERE c.nome = 'Gerente';

INSERT INTO "CargoPermissao" (id, "cargoId", permissao)
SELECT gen_random_uuid(), c.id, p.permissao
FROM "Cargo" c
CROSS JOIN (VALUES
  ('os.criar'), ('os.editar'), ('os.finalizar'), ('os.reabrir'), ('os.ver'),
  ('estoque.ver'), ('crm.ver'), ('metas.ver')
) AS p(permissao)
WHERE c.nome = 'Técnico';

INSERT INTO "CargoPermissao" (id, "cargoId", permissao)
SELECT gen_random_uuid(), c.id, p.permissao
FROM "Cargo" c
CROSS JOIN (VALUES
  ('os.criar'), ('os.editar'), ('os.finalizar'), ('os.ver'), ('os.ver_todas'),
  ('pdv.vender'), ('caixa.abrir'), ('caixa.fechar'), ('caixa.ver'),
  ('estoque.ver'), ('crm.ver'), ('crm.editar'), ('propostas.editar'),
  ('financeiro.ver'),
  ('metas.ver'), ('vendas.criar')
) AS p(permissao)
WHERE c.nome = 'Atendente';

INSERT INTO "CargoPermissao" (id, "cargoId", permissao)
SELECT gen_random_uuid(), c.id, p.permissao
FROM "Cargo" c
CROSS JOIN (VALUES
  ('financeiro.ver'), ('financeiro.lancar'), ('financeiro.baixar'), ('financeiro.editar'), ('financeiro.excluir'), ('financeiro.ver_todos'),
  ('dashboard.financeiro'),
  ('crm.ver'),
  ('estoque.ver'), ('estoque.ver_custos'),
  ('os.ver_custos'), ('os.ver'), ('os.ver_todas'),
  ('caixa.ver'), ('caixa.ver_todos'),
  ('metas.ver'), ('auditoria.ver')
) AS p(permissao)
WHERE c.nome = 'Financeiro';

-- 3. Aponta cada UsuarioEmpresa existente pro cargo equivalente ao seu
--    RoleEmpresa atual. ADMIN -> Administrador, GESTOR -> Gerente,
--    USUARIO -> Atendente. Nenhum usuario fica sem cargo: todo Empresa
--    ganhou os 5 cargos no passo 1, e todo UsuarioEmpresa pertence a uma
--    Empresa (FK obrigatoria).
UPDATE "UsuarioEmpresa" ue
SET "cargoId" = c.id
FROM "Cargo" c
WHERE c."empresaId" = ue."empresaId"
  AND c.nome = (CASE ue.role
    WHEN 'ADMIN' THEN 'Administrador'
    WHEN 'GESTOR' THEN 'Gerente'
    WHEN 'USUARIO' THEN 'Atendente'
  END)
  AND ue."cargoId" IS NULL;

