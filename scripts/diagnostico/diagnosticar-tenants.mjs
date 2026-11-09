// npm run db:diagnostico
//
// Coleta SOMENTE-LEITURA de evidencias para a investigacao do incidente.
// Gera docs/diagnostico/<slug>.json (dados brutos) e <slug>.md (resumo humano)
// para o banco central e para cada tenant ATIVO.
//
// Garantias desta ferramenta:
//   - toda conexao nasce travada em somente-leitura e a trava e conferida;
//   - URLs com "-pooler" sao recusadas;
//   - `prisma migrate diff` e usado apenas na forma read-only documentada pelo
//     proprio CLI ("prisma migrate diff is a read-only command that does not
//     write to your datasource(s)");
//   - a saida nao contem nome, telefone, documento, e-mail em claro nem senha
//     de aparelho. E-mails aparecem so como SHA-256.
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  abrirConexaoSomenteLeitura,
  consultarTolerante,
  extrairHostMascarado,
} from "../lib/conexao-somente-leitura.mjs";
import {
  avisarTenantsPulados,
  imprimirAusenciaDeAmbiente,
  lerCentralDatabaseUrl,
  listarTenantsAtivos,
} from "../lib/tenants-centrais.mjs";

const PASTA_SAIDA = path.resolve(process.cwd(), "docs", "diagnostico");

const TABELAS_FOCO = [
  "OrdemServico",
  "TermoGarantiaOS",
  "RetornoGarantiaOS",
  "ContaReceber",
  "Meta",
  "PropostaComercial",
  "Configuracao",
];

// (tabela, coluna) que guardam id de usuario e podem ter recebido string vazia.
const COLUNAS_ID_USUARIO = [
  ["OrdemServico", "excluidaPorId"],
  ["TermoGarantiaOS", "criadoPorId"],
  ["RetornoGarantiaOS", "criadoPorId"],
  ["RetornoGarantiaOS", "finalizadoPorId"],
  ["Meta", "criadoPorId"],
  ["Meta", "excluidaPorId"],
  ["HistoricoMeta", "criadoPorId"],
];

const LIMITE_LINHAS_SUSPEITAS = 500;

function hashEmail(email) {
  return createHash("sha256")
    .update(String(email ?? "").trim().toLowerCase())
    .digest("hex");
}

// ---------------------------------------------------------------- 1. migrations

async function coletarMigrations(cliente) {
  return consultarTolerante(
    cliente,
    `SELECT migration_name,
            checksum,
            started_at,
            finished_at,
            rolled_back_at,
            applied_steps_count,
            left(coalesce(logs, ''), 500) AS logs_truncados
       FROM "_prisma_migrations"
      ORDER BY started_at`
  );
}

// ------------------------------------------------------------ 2. schema real

async function coletarRealidadeSchema(cliente) {
  const colunas = await consultarTolerante(
    cliente,
    `SELECT table_name,
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position`,
    [TABELAS_FOCO]
  );

  const enums = await consultarTolerante(
    cliente,
    `SELECT t.typname AS enum_nome,
            e.enumlabel AS valor,
            e.enumsortorder AS ordem
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder`
  );

  const chavesEstrangeiras = await consultarTolerante(
    cliente,
    `SELECT rel.relname AS tabela,
            con.conname AS nome,
            pg_get_constraintdef(con.oid) AS definicao
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND con.contype = 'f'
        AND rel.relname = ANY($1)
      ORDER BY rel.relname, con.conname`,
    [TABELAS_FOCO]
  );

  const indices = await consultarTolerante(
    cliente,
    `SELECT tablename AS tabela,
            indexname AS nome,
            indexdef AS definicao
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1)
      ORDER BY tablename, indexname`,
    [TABELAS_FOCO]
  );

  return { colunas, enums, chavesEstrangeiras, indices };
}

// ------------------------------------------------------------------ 3. drift

/**
 * `prisma migrate diff` no Prisma 7 NAO tem `--from-url` nem `--to-schema-datamodel`
 * (conferido em `npx prisma migrate diff --help` na versao 7.8.0 instalada).
 * As flags corretas sao `--from-config-datasource` e `--to-schema`. O alvo e
 * escolhido sobrescrevendo, apenas no processo filho, a variavel de ambiente que
 * o prisma.config.ts correspondente le.
 */
function coletarDrift({ connectionString, arquivoConfig, arquivoSchema, variavelAmbiente }) {
  const argumentos = [
    "prisma",
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    arquivoSchema,
    "--script",
  ];

  if (arquivoConfig) {
    argumentos.splice(1, 0, "--config", arquivoConfig);
  }

  const resultado = spawnSync("npx", argumentos, {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      [variavelAmbiente]: connectionString,
      PGOPTIONS: "-c default_transaction_read_only=on",
    },
    maxBuffer: 32 * 1024 * 1024,
  });

  if (resultado.error) {
    return { ok: false, erro: resultado.error.message };
  }

  const saida = String(resultado.stdout ?? "").trim();
  const erroPadrao = String(resultado.stderr ?? "").trim();

  if (resultado.status !== 0) {
    return { ok: false, erro: erroPadrao || `prisma migrate diff saiu com codigo ${resultado.status}` };
  }

  const semDiferenca = /no difference detected/i.test(saida) || saida.length === 0;

  return {
    ok: true,
    comando: `npx ${argumentos.join(" ")}`,
    semDiferenca,
    script: saida,
  };
}

// ------------------------------------------------------- 4. censo de status OS

async function coletarCensoOrdensServico(cliente) {
  return consultarTolerante(
    cliente,
    `SELECT status::text AS status,
            ("archivedAt" IS NULL) AS archived_at_nulo,
            ("excluidaEm" IS NULL) AS excluida_em_nulo,
            count(*)::int AS total
       FROM "OrdemServico"
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3`
  );
}

// -------------------------------------------------------- 5. OS suspeitas

const CAMPOS_SUSPEITA = `os.id, os.status::text AS status, os."archivedAt", os."atualizadoEm"`;

async function coletarOrdensSuspeitas(cliente) {
  // Todos os recortes excluem OS logicamente excluidas: `excluirOrdemServico`
  // grava archivedAt = now() sem mexer no status, o que geraria falso positivo
  // em massa no recorte (d).
  const entregueSemArquivar = await consultarTolerante(
    cliente,
    `SELECT ${CAMPOS_SUSPEITA}
       FROM "OrdemServico" os
      WHERE os.status = 'ENTREGUE'
        AND os."archivedAt" IS NULL
        AND os."excluidaEm" IS NULL
      ORDER BY os."atualizadoEm" DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );

  const comGarantiaSemEntrega = await consultarTolerante(
    cliente,
    `SELECT ${CAMPOS_SUSPEITA}
       FROM "OrdemServico" os
       JOIN "TermoGarantiaOS" tg ON tg."osId" = os.id
      WHERE os.status <> 'ENTREGUE'
        AND os."excluidaEm" IS NULL
      ORDER BY os."atualizadoEm" DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );

  const pagaSemEntrega = await consultarTolerante(
    cliente,
    `SELECT DISTINCT ${CAMPOS_SUSPEITA}
       FROM "OrdemServico" os
       JOIN "ContaReceber" cr ON cr."ordemServicoId" = os.id
      WHERE cr.status IN ('PAGO', 'RECEBIDO')
        AND os.status <> 'ENTREGUE'
        AND os."excluidaEm" IS NULL
      ORDER BY os."atualizadoEm" DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );

  const arquivadaSemEntrega = await consultarTolerante(
    cliente,
    `SELECT ${CAMPOS_SUSPEITA}
       FROM "OrdemServico" os
      WHERE os."archivedAt" IS NOT NULL
        AND os.status <> 'ENTREGUE'
        AND os."excluidaEm" IS NULL
      ORDER BY os."atualizadoEm" DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );

  return {
    a_entregue_sem_archivedAt: entregueSemArquivar,
    b_com_termo_garantia_sem_entrega: comGarantiaSemEntrega,
    c_com_recebimento_confirmado_sem_entrega: pagaSemEntrega,
    d_arquivada_sem_entrega: arquivadaSemEntrega,
  };
}

// ------------------------------------------- 6. reconstrucao pela auditoria

/**
 * Conteudo gravado num campo que nao e do tipo dele.
 *
 * Nasceu de um caso real: tres OS de producao com um ENDERECO DE E-MAIL no
 * campo de IMEI. A OS nao tem campo de e-mail, entao alguem digitou onde deu.
 * Nada no banco impede -- `imei` e texto livre --, e nenhuma tela reclama.
 *
 * Este recorte e SO RELATORIO. Apagar e decisao de quem olha, e por isso o
 * relatorio mostra o valor: para apagar um dado e preciso ver o dado.
 */
async function coletarCamposComTipoErrado(cliente) {
  return consultarTolerante(
    cliente,
    `SELECT os.id,
            os."numeroOs",
            os.imei AS valor,
            os."atualizadoEm"
       FROM "OrdemServico" os
      WHERE os.imei IS NOT NULL
        AND os.imei ~ '[[:alnum:]._%%+-]+@[[:alnum:].-]+\\.[[:alpha:]]{2,}'
      ORDER BY os."atualizadoEm" DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );
}

async function coletarReconstrucaoAuditoria(cliente) {
  const divergencias = await consultarTolerante(
    cliente,
    `WITH eventos AS (
        SELECT la."entidadeId"                        AS os_id,
               la."criadoEm"                          AS auditado_em,
               la."dadosDepois" ->> 'status'          AS status_auditado,
               la."dadosDepois" ->> 'archivedAt'      AS archived_at_auditado
          FROM "LogAuditoria" la
         WHERE la.entidade = 'ORDEM_SERVICO'
           AND la."entidadeId" IS NOT NULL
           AND la."dadosDepois" IS NOT NULL
           AND jsonb_typeof(la."dadosDepois") = 'object'
     ),
     ultimo_evento AS (
        SELECT DISTINCT ON (os_id)
               os_id, auditado_em, status_auditado, archived_at_auditado
          FROM eventos
         WHERE status_auditado IS NOT NULL
         ORDER BY os_id, auditado_em DESC
     )
     SELECT ue.os_id                        AS "osId",
            ue.status_auditado              AS "statusAuditado",
            ue.archived_at_auditado         AS "archivedAtAuditado",
            ue.auditado_em                  AS "auditadoEm",
            os.status::text                 AS "statusAtual",
            os."archivedAt"                 AS "archivedAtAtual",
            os."atualizadoEm"               AS "atualizadoEm"
       FROM ultimo_evento ue
       JOIN "OrdemServico" os ON os.id = ue.os_id
      WHERE ue.status_auditado IS DISTINCT FROM os.status::text
         OR (ue.archived_at_auditado IS NULL) IS DISTINCT FROM (os."archivedAt" IS NULL)
      ORDER BY ue.auditado_em DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );

  const cobertura = await consultarTolerante(
    cliente,
    `SELECT min("criadoEm") AS "primeiroEvento",
            max("criadoEm") AS "ultimoEvento",
            count(*)::int   AS "totalEventosOrdemServico",
            count(DISTINCT "entidadeId")::int AS "ordensComAuditoria"
       FROM "LogAuditoria"
      WHERE entidade = 'ORDEM_SERVICO'`
  );

  const semAuditoria = await consultarTolerante(
    cliente,
    `SELECT count(*)::int AS "ordensSemNenhumEvento"
       FROM "OrdemServico" os
      WHERE NOT EXISTS (
            SELECT 1 FROM "LogAuditoria" la
             WHERE la.entidade = 'ORDEM_SERVICO'
               AND la."entidadeId" = os.id
      )`
  );

  // Sinal direto do item (b) do checklist manual: registro mexido depois do
  // ultimo evento de auditoria = escrita sem trilha.
  const atualizadoDepoisDaAuditoria = await consultarTolerante(
    cliente,
    `SELECT os.id,
            os.status::text AS status,
            os."archivedAt",
            os."atualizadoEm",
            ultimo."ultimoEventoEm"
       FROM "OrdemServico" os
       JOIN LATERAL (
            SELECT max(la."criadoEm") AS "ultimoEventoEm"
              FROM "LogAuditoria" la
             WHERE la.entidade = 'ORDEM_SERVICO'
               AND la."entidadeId" = os.id
       ) ultimo ON TRUE
      WHERE ultimo."ultimoEventoEm" IS NOT NULL
        AND os."atualizadoEm" > ultimo."ultimoEventoEm" + interval '2 seconds'
      ORDER BY os."atualizadoEm" DESC
      LIMIT ${LIMITE_LINHAS_SUSPEITAS}`
  );

  return { divergencias, cobertura, semAuditoria, atualizadoDepoisDaAuditoria };
}

// ------------------------------------------------- 7. mapeamento de usuarios

async function coletarMapeamentoUsuarios(cliente, usuariosCentraisDaEmpresa) {
  const usuariosTenant = await consultarTolerante(
    cliente,
    `SELECT id, email, role::text AS role FROM "Usuario"`
  );

  const idsVazios = [];

  for (const [tabela, coluna] of COLUNAS_ID_USUARIO) {
    const contagem = await consultarTolerante(
      cliente,
      `SELECT count(*)::int AS total FROM "${tabela}" WHERE "${coluna}" = ''`
    );

    idsVazios.push({
      tabela,
      coluna,
      ...(contagem.ok
        ? { total: contagem.linhas[0]?.total ?? 0 }
        : { indisponivel: contagem.erro }),
    });
  }

  if (!usuariosTenant.ok) {
    return { usuariosTenant, idsVazios };
  }

  const hashesTenant = new Map();

  for (const usuario of usuariosTenant.linhas) {
    hashesTenant.set(hashEmail(usuario.email), { id: usuario.id, role: usuario.role });
  }

  const hashesCentrais = new Map(
    usuariosCentraisDaEmpresa.map((usuario) => [usuario.emailSha256, usuario])
  );

  const centraisSemUsuarioOperacional = [];

  for (const [hash, usuario] of hashesCentrais) {
    if (!hashesTenant.has(hash)) {
      centraisSemUsuarioOperacional.push({ emailSha256: hash, role: usuario.role });
    }
  }

  const operacionaisSemUsuarioCentral = [];

  for (const [hash, usuario] of hashesTenant) {
    if (!hashesCentrais.has(hash)) {
      operacionaisSemUsuarioCentral.push({ emailSha256: hash, role: usuario.role });
    }
  }

  return {
    totalUsuariosCentraisAtivos: hashesCentrais.size,
    totalUsuariosOperacionais: hashesTenant.size,
    centraisSemUsuarioOperacional,
    operacionaisSemUsuarioCentral,
    idsVazios,
  };
}

// ----------------------------------------------------------- 8. Configuracao

async function coletarConfiguracao(cliente) {
  const total = await consultarTolerante(
    cliente,
    `SELECT count(*)::int AS total FROM "Configuracao"`
  );

  const regras = await consultarTolerante(
    cliente,
    `SELECT id,
            "criadoEm",
            "prazoGarantiaPadraoDias",
            "prazoMinimoGarantiaDias",
            "prazoMaximoGarantiaDias",
            "exigirGarantiaAntesEntrega",
            "exigirItemParaGarantia",
            "exigirItemParaEnviarPDV",
            "exigirDiagnosticoParaFinalizar",
            "permitirFinalizarSemPagamento",
            "permitirGarantiaPersonalizada",
            "permitirVendaSemEstoque",
            "modeloImpressaoOSPadrao"::text AS "modeloImpressaoOSPadrao"
       FROM "Configuracao"
      ORDER BY "criadoEm" ASC`
  );

  return { total, regras };
}

// ------------------------------------------------------------------ 9. metas

async function coletarMetas(cliente) {
  return consultarTolerante(
    cliente,
    `SELECT id,
            "tipoValor"::text            AS "tipoValor",
            categoria::text              AS categoria,
            status::text                 AS status,
            "origemProgresso"::text      AS "origemProgresso",
            "fonteAutomatica"::text      AS "fonteAutomatica",
            "metricaAutomatica"::text    AS "metricaAutomatica",
            "valorAlvo",
            "valorAtual",
            "ultimaSincronizacaoEm",
            left(coalesce("erroSincronizacao", ''), 300) AS "erroSincronizacao",
            ("excluidaEm" IS NOT NULL)   AS excluida
       FROM "Meta"
      ORDER BY "criadoEm"`
  );
}

// ------------------------------------------------ 10. contagem de linhas

async function coletarContagemLinhas(cliente) {
  const tabelas = await consultarTolerante(
    cliente,
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );

  if (!tabelas.ok) {
    return tabelas;
  }

  const contagens = [];

  for (const { table_name: tabela } of tabelas.linhas) {
    const contagem = await consultarTolerante(
      cliente,
      `SELECT count(*)::bigint AS total FROM "${tabela.replace(/"/g, '""')}"`
    );

    contagens.push({
      tabela,
      ...(contagem.ok
        ? { total: Number(contagem.linhas[0]?.total ?? 0) }
        : { indisponivel: contagem.erro }),
    });
  }

  return { ok: true, linhas: contagens };
}

// --------------------------------------------------------- usuarios centrais

async function coletarUsuariosCentraisPorEmpresa(cliente) {
  const resultado = await consultarTolerante(
    cliente,
    `SELECT ue."empresaId",
            ue.role::text AS role,
            uc.email
       FROM "UsuarioEmpresa" ue
       JOIN "UsuarioCentral" uc ON uc.id = ue."usuarioId"
      WHERE ue.ativo = TRUE
        AND uc.ativo = TRUE`
  );

  const porEmpresa = new Map();

  if (!resultado.ok) {
    return { porEmpresa, erro: resultado.erro };
  }

  for (const linha of resultado.linhas) {
    const lista = porEmpresa.get(linha.empresaId) ?? [];
    lista.push({ emailSha256: hashEmail(linha.email), role: linha.role });
    porEmpresa.set(linha.empresaId, lista);
  }

  return { porEmpresa };
}

// ------------------------------------------------------------- relatorio md

function formatarBloco(titulo, conteudo) {
  return `## ${titulo}\n\n${conteudo}\n`;
}

function formatarResultado(resultado, formatarLinhas) {
  if (!resultado) {
    return "_Nao coletado._";
  }

  if (resultado.ok === false) {
    return `> **Indisponivel neste banco:** \`${resultado.erro}\``;
  }

  const linhas = resultado.linhas ?? [];

  if (linhas.length === 0) {
    return "_Nenhuma linha._";
  }

  return formatarLinhas(linhas);
}

function tabelaMarkdown(linhas, colunas) {
  const cabecalho = `| ${colunas.join(" | ")} |`;
  const separador = `| ${colunas.map(() => "---").join(" | ")} |`;
  const corpo = linhas
    .map(
      (linha) =>
        `| ${colunas
          .map((coluna) => {
            const valor = linha[coluna];
            if (valor === null || valor === undefined) return "";
            return String(valor).replace(/\|/g, "\\|").replace(/\n/g, " ");
          })
          .join(" | ")} |`
    )
    .join("\n");

  return `${cabecalho}\n${separador}\n${corpo}`;
}

function montarMarkdown(relatorio) {
  const partes = [];

  partes.push(`# Diagnostico — ${relatorio.rotulo}`);
  partes.push("");
  partes.push(`- Gerado em: ${relatorio.geradoEm}`);
  partes.push(`- Host (mascarado): ${relatorio.hostMascarado}`);
  partes.push(`- Papel: ${relatorio.papel}`);
  if (relatorio.tenantId) partes.push(`- Tenant id: ${relatorio.tenantId}`);
  if (relatorio.versaoSchema) partes.push(`- versaoSchema (central): ${relatorio.versaoSchema}`);
  partes.push("");
  partes.push(
    "> Coleta somente-leitura. Sem nomes, telefones, documentos, e-mails em claro ou senhas de aparelho."
  );
  partes.push("");

  partes.push(
    formatarBloco(
      "1. Migrations aplicadas (_prisma_migrations)",
      formatarResultado(relatorio.migrations, (linhas) =>
        tabelaMarkdown(linhas, [
          "migration_name",
          "started_at",
          "finished_at",
          "rolled_back_at",
          "applied_steps_count",
        ])
      )
    )
  );

  const schema = relatorio.schema ?? {};

  partes.push(
    formatarBloco(
      "2. Realidade do schema",
      [
        "### Colunas das tabelas investigadas",
        "",
        formatarResultado(schema.colunas, (linhas) =>
          tabelaMarkdown(linhas, [
            "table_name",
            "column_name",
            "data_type",
            "udt_name",
            "is_nullable",
            "column_default",
          ])
        ),
        "",
        "### Enums",
        "",
        formatarResultado(schema.enums, (linhas) => {
          const agrupado = new Map();
          for (const linha of linhas) {
            const valores = agrupado.get(linha.enum_nome) ?? [];
            valores.push(linha.valor);
            agrupado.set(linha.enum_nome, valores);
          }
          return [...agrupado.entries()]
            .map(([nome, valores]) => `- \`${nome}\`: ${valores.join(", ")}`)
            .join("\n");
        }),
        "",
        "### Chaves estrangeiras",
        "",
        formatarResultado(schema.chavesEstrangeiras, (linhas) =>
          tabelaMarkdown(linhas, ["tabela", "nome", "definicao"])
        ),
        "",
        "### Indices",
        "",
        formatarResultado(schema.indices, (linhas) =>
          tabelaMarkdown(linhas, ["tabela", "nome", "definicao"])
        ),
      ].join("\n")
    )
  );

  const drift = relatorio.drift;
  partes.push(
    formatarBloco(
      "3. Drift entre banco e schema Prisma",
      drift?.ok
        ? drift.semDiferenca
          ? `Comando: \`${drift.comando}\`\n\n**Sem diferenca detectada.**`
          : `Comando: \`${drift.comando}\`\n\nSQL que levaria o BANCO ate o schema (ou seja, o que falta no banco):\n\n\`\`\`sql\n${drift.script}\n\`\`\``
        : `> **Nao foi possivel calcular:** \`${drift?.erro ?? "nao executado"}\``
    )
  );

  partes.push(
    formatarBloco(
      "4. Censo de ordens de servico",
      formatarResultado(relatorio.censoOrdensServico, (linhas) =>
        tabelaMarkdown(linhas, ["status", "archived_at_nulo", "excluida_em_nulo", "total"])
      )
    )
  );

  const suspeitas = relatorio.ordensSuspeitas ?? {};
  const rotulosSuspeitas = {
    a_entregue_sem_archivedAt: "a. status = ENTREGUE e archivedAt IS NULL",
    b_com_termo_garantia_sem_entrega: "b. possui TermoGarantiaOS e status <> ENTREGUE",
    c_com_recebimento_confirmado_sem_entrega:
      "c. possui ContaReceber PAGO/RECEBIDO e status <> ENTREGUE",
    d_arquivada_sem_entrega: "d. archivedAt IS NOT NULL e status <> ENTREGUE",
  };

  partes.push(
    formatarBloco(
      "5. Ordens suspeitas",
      [
        "_Todos os recortes ignoram OS logicamente excluidas (`excluidaEm IS NOT NULL`)._",
        "",
        ...Object.entries(rotulosSuspeitas).map(([chave, rotulo]) =>
          [
            `### ${rotulo}`,
            "",
            formatarResultado(suspeitas[chave], (linhas) =>
              `${linhas.length} linha(s).\n\n${tabelaMarkdown(linhas, [
                "id",
                "status",
                "archivedAt",
                "atualizadoEm",
              ])}`
            ),
            "",
          ].join("\n")
        ),
      ].join("\n")
    )
  );

  partes.push(
    formatarBloco(
      "5b. Campos com conteudo de outro tipo",
      [
        "_E-mail gravado no campo de IMEI. O valor aparece aqui de proposito:",
        "para decidir apagar um dado e preciso ver o dado._",
        "",
        formatarResultado(relatorio.camposComTipoErrado, (linhas) =>
          linhas.length === 0
            ? "Nenhuma linha."
            : `${linhas.length} linha(s).\n\n${tabelaMarkdown(linhas, [
                "numeroOs",
                "valor",
                "id",
                "atualizadoEm",
              ])}`
        ),
      ].join("\n")
    )
  );

  const auditoria = relatorio.auditoria ?? {};

  partes.push(
    formatarBloco(
      "6. Reconstrucao pela trilha de auditoria",
      [
        "### Cobertura",
        "",
        formatarResultado(auditoria.cobertura, (linhas) =>
          tabelaMarkdown(linhas, [
            "primeiroEvento",
            "ultimoEvento",
            "totalEventosOrdemServico",
            "ordensComAuditoria",
          ])
        ),
        "",
        formatarResultado(auditoria.semAuditoria, (linhas) =>
          `OS sem nenhum evento de auditoria: **${linhas[0]?.ordensSemNenhumEvento ?? 0}**`
        ),
        "",
        "### Divergencias entre ultimo estado auditado e estado atual",
        "",
        formatarResultado(auditoria.divergencias, (linhas) =>
          `${linhas.length} divergencia(s).\n\n${tabelaMarkdown(linhas, [
            "osId",
            "statusAuditado",
            "archivedAtAuditado",
            "auditadoEm",
            "statusAtual",
            "archivedAtAtual",
          ])}`
        ),
        "",
        "### OS alteradas DEPOIS do ultimo evento de auditoria (escrita sem trilha)",
        "",
        formatarResultado(auditoria.atualizadoDepoisDaAuditoria, (linhas) =>
          `${linhas.length} linha(s).\n\n${tabelaMarkdown(linhas, [
            "id",
            "status",
            "archivedAt",
            "atualizadoEm",
            "ultimoEventoEm",
          ])}`
        ),
      ].join("\n")
    )
  );

  const usuarios = relatorio.usuarios ?? {};

  partes.push(
    formatarBloco(
      "7. Mapeamento de usuarios (F-10)",
      [
        `- Usuarios centrais ativos da empresa: **${usuarios.totalUsuariosCentraisAtivos ?? "n/d"}**`,
        `- Usuarios operacionais no tenant: **${usuarios.totalUsuariosOperacionais ?? "n/d"}**`,
        "",
        "### Centrais SEM Usuario operacional correspondente",
        "",
        "_Estes usuarios recebem `usuarioOperacional.id = \"\"` e quebram gravacoes com FK._",
        "",
        usuarios.centraisSemUsuarioOperacional?.length
          ? tabelaMarkdown(usuarios.centraisSemUsuarioOperacional, ["emailSha256", "role"])
          : "_Nenhum._",
        "",
        "### Operacionais SEM usuario central correspondente",
        "",
        usuarios.operacionaisSemUsuarioCentral?.length
          ? tabelaMarkdown(usuarios.operacionaisSemUsuarioCentral, ["emailSha256", "role"])
          : "_Nenhum._",
        "",
        "### Colunas de id de usuario com string vazia",
        "",
        usuarios.idsVazios?.length
          ? tabelaMarkdown(usuarios.idsVazios, ["tabela", "coluna", "total", "indisponivel"])
          : "_Nao coletado._",
      ].join("\n")
    )
  );

  const configuracao = relatorio.configuracao ?? {};

  partes.push(
    formatarBloco(
      "8. Configuracao",
      [
        formatarResultado(configuracao.total, (linhas) =>
          `Linhas em \`Configuracao\`: **${linhas[0]?.total ?? 0}** (o codigo sempre le \`findFirst\` por \`criadoEm\` ASC).`
        ),
        "",
        formatarResultado(configuracao.regras, (linhas) =>
          tabelaMarkdown(linhas, [
            "id",
            "prazoGarantiaPadraoDias",
            "prazoMinimoGarantiaDias",
            "prazoMaximoGarantiaDias",
            "exigirGarantiaAntesEntrega",
            "exigirItemParaGarantia",
            "exigirItemParaEnviarPDV",
            "exigirDiagnosticoParaFinalizar",
            "permitirFinalizarSemPagamento",
            "permitirGarantiaPersonalizada",
            "permitirVendaSemEstoque",
          ])
        ),
      ].join("\n")
    )
  );

  partes.push(
    formatarBloco(
      "9. Metas",
      formatarResultado(relatorio.metas, (linhas) =>
        tabelaMarkdown(linhas, [
          "id",
          "tipoValor",
          "status",
          "origemProgresso",
          "fonteAutomatica",
          "metricaAutomatica",
          "valorAlvo",
          "valorAtual",
          "ultimaSincronizacaoEm",
          "erroSincronizacao",
          "excluida",
        ])
      )
    )
  );

  partes.push(
    formatarBloco(
      "10. Contagem de linhas por tabela",
      formatarResultado(relatorio.contagemLinhas, (linhas) =>
        tabelaMarkdown(linhas, ["tabela", "total", "indisponivel"])
      )
    )
  );

  return `${partes.join("\n")}\n`;
}

// ------------------------------------------------------------------- coleta

async function diagnosticarBanco({
  rotulo,
  papel,
  slugArquivo,
  connectionString,
  arquivoConfig,
  arquivoSchema,
  variavelAmbiente,
  usuariosCentraisDaEmpresa,
  tenantId,
  versaoSchema,
}) {
  console.log("");
  console.log(`[diagnostico] ${rotulo}`);

  const cliente = await abrirConexaoSomenteLeitura(connectionString, rotulo);

  try {
    const relatorio = {
      rotulo,
      papel,
      tenantId,
      versaoSchema,
      geradoEm: new Date().toISOString(),
      hostMascarado: extrairHostMascarado(connectionString),
      migrations: await coletarMigrations(cliente),
      schema: await coletarRealidadeSchema(cliente),
      censoOrdensServico: await coletarCensoOrdensServico(cliente),
      ordensSuspeitas: await coletarOrdensSuspeitas(cliente),
      camposComTipoErrado: await coletarCamposComTipoErrado(cliente),
      auditoria: await coletarReconstrucaoAuditoria(cliente),
      usuarios: await coletarMapeamentoUsuarios(cliente, usuariosCentraisDaEmpresa ?? []),
      configuracao: await coletarConfiguracao(cliente),
      metas: await coletarMetas(cliente),
      contagemLinhas: await coletarContagemLinhas(cliente),
    };

    console.log("[diagnostico]   calculando drift (prisma migrate diff, read-only)...");
    relatorio.drift = coletarDrift({
      connectionString,
      arquivoConfig,
      arquivoSchema,
      variavelAmbiente,
    });

    await writeFile(
      path.join(PASTA_SAIDA, `${slugArquivo}.json`),
      `${JSON.stringify(relatorio, null, 2)}\n`,
      "utf8"
    );

    await writeFile(
      path.join(PASTA_SAIDA, `${slugArquivo}.md`),
      montarMarkdown(relatorio),
      "utf8"
    );

    console.log(`[diagnostico]   OK -> docs/diagnostico/${slugArquivo}.{json,md}`);

    return { ok: true, slug: slugArquivo };
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function principal() {
  const centralDatabaseUrl = lerCentralDatabaseUrl();

  if (!centralDatabaseUrl) {
    imprimirAusenciaDeAmbiente();
    process.exit(1);
  }

  let descoberta;

  try {
    descoberta = await listarTenantsAtivos(centralDatabaseUrl);
  } catch (erro) {
    console.error("");
    console.error(
      `[erro] Nao foi possivel listar os tenants no banco central: ${erro instanceof Error ? erro.message : String(erro)}`
    );
    console.error("[erro] Confira CENTRAL_DATABASE_URL e use a URL DIRETA (sem '-pooler').");
    console.error("");
    process.exit(1);
  }

  avisarTenantsPulados(descoberta.pulados);

  await mkdir(PASTA_SAIDA, { recursive: true });

  const clienteCentral = await abrirConexaoSomenteLeitura(centralDatabaseUrl, "banco central");
  let usuariosCentrais;

  try {
    usuariosCentrais = await coletarUsuariosCentraisPorEmpresa(clienteCentral);
  } finally {
    await clienteCentral.end().catch(() => {});
  }

  const falhas = [];

  try {
    await diagnosticarBanco({
      rotulo: "banco central",
      papel: "central",
      slugArquivo: "central",
      connectionString: centralDatabaseUrl,
      arquivoConfig: "prisma.central.config.ts",
      arquivoSchema: "prisma/central/schema.prisma",
      variavelAmbiente: "CENTRAL_DATABASE_URL",
      usuariosCentraisDaEmpresa: [],
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[diagnostico]   FALHOU: ${mensagem}`);
    falhas.push({ slug: "central", erro: mensagem });
  }

  for (const tenant of descoberta.resolvidos) {
    try {
      await diagnosticarBanco({
        rotulo: `tenant ${tenant.slug} (empresa ${tenant.empresaSlug})`,
        papel: "tenant",
        slugArquivo: tenant.slugArquivo,
        connectionString: tenant.connectionString,
        arquivoConfig: null,
        arquivoSchema: "prisma/schema.prisma",
        variavelAmbiente: "DATABASE_URL",
        usuariosCentraisDaEmpresa: usuariosCentrais.porEmpresa.get(tenant.empresaId) ?? [],
        tenantId: tenant.id,
        versaoSchema: tenant.versaoSchema,
      });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(`[diagnostico]   FALHOU: ${mensagem}`);
      falhas.push({ slug: tenant.slugArquivo, erro: mensagem });
    }
  }

  console.log("");
  console.log(`[diagnostico] Saidas em ${PASTA_SAIDA}`);

  if (falhas.length > 0) {
    console.error(`[diagnostico] FALHAS: ${falhas.length}`);
    for (const falha of falhas) {
      console.error(`[diagnostico]   - ${falha.slug}: ${falha.erro}`);
    }
    process.exit(1);
  }

  console.log("[diagnostico] Concluido. Nenhuma escrita foi feita em nenhum banco.");
}

principal().catch((erro) => {
  console.error("");
  console.error(
    `[erro] Falha inesperada no diagnostico: ${erro instanceof Error ? erro.message : String(erro)}`
  );
  console.error("");
  process.exit(1);
});
