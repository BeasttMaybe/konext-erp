// npm run db:migrar
//
// Roda o pipeline de migration tenant a tenant, na ordem devolvida pelo banco
// central, um de cada vez: backup -> checa se a baseline ja foi resolvida ->
// migrate status -> migrate diff (bloqueia SQL destrutivo sem autorizacao) ->
// migrate deploy -> atualiza Tenant.versaoSchema no central -> migrate diff de
// novo (tem que dar vazio). Procedimento completo, incluindo o que fazer
// quando um tenant falha, em docs/operacao/migrations.md.
//
// --dry-run (padrao, tambem pode ser passado explicito): so mostra o plano de
//   cada tenant selecionado. Nao faz backup, nao aplica nada, nao escreve no
//   central. Sempre avalia TODOS os tenants selecionados (nunca para no meio),
//   porque o objetivo do dry-run e mostrar o plano inteiro de uma vez.
// --aplicar: sai do modo dry-run. Exige tambem CONFIRMAR=SIM no ambiente.
//   Nesse modo, para no PRIMEIRO tenant que falhar e nao segue para o proximo.
// --tenant <slug>: restringe a um unico tenant ATIVO (por slug).
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import {
  comConexaoSomenteLeitura,
  extrairHostMascarado,
  mascararConnectionString,
  recusarPooler,
} from "../lib/conexao-somente-leitura.mjs";
import {
  avisarTenantsPulados,
  imprimirAusenciaDeAmbiente,
  lerCentralDatabaseUrl,
  listarTenantsAtivos,
} from "../lib/tenants-centrais.mjs";
import { executarComandoPrisma, obterUltimaMigracaoTenant } from "../lib/migracoes.mjs";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const DIFF_SCHEMA = "migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script";

// Cada regra roda linha a linha contra o SQL de `migrate diff`, pulando
// comentarios (`-- ...`) e linhas em branco. "printing the offending
// statement" na Fase 1C-1 quer a linha de SQL real, nao so a anotacao.
const REGRAS_DESTRUTIVAS = [
  { nome: "DROP TABLE", teste: (linha) => /^DROP\s+TABLE\b/i.test(linha) },
  { nome: "DROP COLUMN", teste: (linha) => /ALTER\s+TABLE[\s\S]*DROP\s+COLUMN\b/i.test(linha) },
  { nome: "ALTER COLUMN ... TYPE", teste: (linha) => /ALTER\s+COLUMN[\s\S]*\bTYPE\b/i.test(linha) },
  { nome: "DROP CONSTRAINT", teste: (linha) => /DROP\s+CONSTRAINT\b/i.test(linha) },
  { nome: "TRUNCATE", teste: (linha) => /^TRUNCATE\b/i.test(linha) },
  { nome: "DELETE", teste: (linha) => /^DELETE\s+FROM\b/i.test(linha) },
  { nome: "UPDATE", teste: (linha) => /^UPDATE\b/i.test(linha) },
  {
    nome: "SET DEFAULT em coluna de status/arquivamento",
    teste: (linha) => {
      const alvo = linha.match(/ALTER\s+COLUMN\s+"?([A-Za-z0-9_]+)"?\s+SET\s+DEFAULT/i);
      return Boolean(alvo && /status|archiv/i.test(alvo[1]));
    },
  },
  { nome: "ALTER TYPE em enum", teste: (linha) => /^ALTER\s+TYPE\b/i.test(linha) },
];

function encontrarOperacoesDestrutivas(sqlScript) {
  const ocorrencias = [];

  for (const linhaBruta of sqlScript.split("\n")) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith("--")) continue;

    for (const regra of REGRAS_DESTRUTIVAS) {
      if (regra.teste(linha)) {
        ocorrencias.push({ regra: regra.nome, linha });
      }
    }
  }

  return ocorrencias;
}

function diffEstaVazio(sqlScript) {
  return !sqlScript
    .split("\n")
    .map((linha) => linha.trim())
    .some((linha) => linha.length > 0 && !linha.startsWith("--"));
}

function lerArgumentos(argv) {
  const indiceTenant = argv.indexOf("--tenant");
  let tenantFiltro = null;

  if (indiceTenant !== -1) {
    const valor = argv[indiceTenant + 1];
    if (!valor || valor.startsWith("--")) {
      throw new Error("--tenant exige um slug logo em seguida, ex.: --tenant principal");
    }
    tenantFiltro = valor;
  }

  return {
    dryRun: !argv.includes("--aplicar"),
    tenantFiltro,
  };
}

async function verificarBaselineResolvida(connectionString) {
  return comConexaoSomenteLeitura(connectionString, "tenant (checagem de baseline)", async (cliente) => {
    try {
      const resultado = await cliente.query(
        `SELECT finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = '0_baseline'`
      );

      if (resultado.rows.length === 0) {
        return { resolvida: false, motivo: "nenhuma linha \"0_baseline\" em _prisma_migrations" };
      }

      const linha = resultado.rows[0];

      if (linha.rolled_back_at) {
        return { resolvida: false, motivo: "\"0_baseline\" esta marcada com rolled_back_at preenchido" };
      }
      if (!linha.finished_at) {
        return { resolvida: false, motivo: "\"0_baseline\" esta sem finished_at (nunca terminou)" };
      }

      return { resolvida: true };
    } catch (erro) {
      return {
        resolvida: false,
        motivo: `nao foi possivel ler _prisma_migrations: ${erro instanceof Error ? erro.message : String(erro)}`,
      };
    }
  });
}

function rodarBackupDoTenant(slug) {
  const resultado = spawnSync("node", ["scripts/backup/backup-bancos.mjs", "--tenant", slug], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });

  const stdout = resultado.stdout ?? "";
  const destino = stdout.match(/\[backup\] Destino: (.+)/)?.[1]?.trim() ?? null;

  return {
    ok: resultado.status === 0,
    stdout,
    stderr: resultado.stderr ?? "",
    pastaDestino: destino,
  };
}

function imprimirBlocoDiff(sqlScript, destrutivas) {
  if (diffEstaVazio(sqlScript)) {
    console.log("  diff: vazio (banco ja bate com prisma/schema.prisma)");
    return;
  }

  console.log("  diff:");
  for (const linha of sqlScript.split("\n")) {
    if (linha.trim()) console.log(`    ${linha}`);
  }

  if (destrutivas.length > 0) {
    console.log("  operacoes potencialmente destrutivas encontradas:");
    for (const ocorrencia of destrutivas) {
      console.log(`    [${ocorrencia.regra}] ${ocorrencia.linha}`);
    }
  }
}

async function processarTenant(tenant, { dryRun, versaoAlvo, prismaCentral }) {
  console.log("");
  console.log(`[migrar] Tenant: ${tenant.slug} (empresa ${tenant.empresaSlug})`);
  console.log(`[migrar]   host: ${extrairHostMascarado(tenant.connectionString)}`);

  try {
    recusarPooler(tenant.connectionString, tenant.connectionRef);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[migrar]   FALHOU: ${motivo}`);
    return linhaResultado(tenant, { status: "FALHA_POOLER", detalhe: motivo });
  }

  if (dryRun) {
    const baseline = await verificarBaselineResolvida(tenant.connectionString);

    if (!baseline.resolvida) {
      console.log(`[migrar]   0_baseline AINDA NAO resolvida neste tenant (${baseline.motivo}).`);
      console.log(
        "[migrar]   antes de rodar --aplicar neste tenant, um operador precisa rodar UMA VEZ:"
      );
      console.log(`[migrar]     DATABASE_URL="<${tenant.connectionRef}>" npx prisma migrate resolve --applied 0_baseline`);
    }

    const status = executarComandoPrisma("migrate status", tenant.connectionString);
    console.log("  migrate status:");
    console.log(
      (status.stdout || status.stderr)
        .split("\n")
        .map((linha) => `    ${linha}`)
        .join("\n")
    );

    const diff = executarComandoPrisma(DIFF_SCHEMA, tenant.connectionString);

    if (!diff.ok) {
      console.error(`[migrar]   FALHOU ao rodar migrate diff: ${diff.stderr}`);
      return linhaResultado(tenant, { status: "ERRO_DIFF", detalhe: diff.stderr });
    }

    const destrutivas = encontrarOperacoesDestrutivas(diff.stdout);
    imprimirBlocoDiff(diff.stdout, destrutivas);

    let resultado;
    if (!baseline.resolvida) {
      resultado = "BLOQUEARIA: precisa de migrate resolve --applied 0_baseline antes";
    } else if (diffEstaVazio(diff.stdout)) {
      resultado = "sem mudancas pendentes";
    } else if (destrutivas.length > 0) {
      resultado = "BLOQUEARIA: SQL destrutivo sem AUTORIZAR_DESTRUTIVO=SIM";
    } else {
      resultado = `aplicaria migrations pendentes e marcaria versaoSchema=${versaoAlvo}`;
    }

    console.log(`[migrar]   plano: ${resultado}`);

    return linhaResultado(tenant, {
      status: "PLANEJADO",
      backup: "(dry-run: nao gerado)",
      migracoes: "(dry-run: nao aplicado)",
      versaoSchemaNova: `(dry-run: seria ${versaoAlvo})`,
      detalhe: resultado,
    });
  }

  // --aplicar a partir daqui.
  console.log("[migrar]   1/6 backup...");
  const backup = rodarBackupDoTenant(tenant.slug);

  if (!backup.ok) {
    console.error("[migrar]   FALHOU no backup. Abortando o restante da execucao.");
    console.error(backup.stderr || backup.stdout);
    return linhaResultado(tenant, { status: "FALHA_BACKUP", detalhe: backup.stderr || backup.stdout });
  }

  const arquivoBackup = backup.pastaDestino
    ? `${backup.pastaDestino}/${tenant.slugArquivo}.dump`
    : "(gerado, caminho nao identificado no stdout)";
  console.log(`[migrar]   backup OK -> ${arquivoBackup}`);

  console.log("[migrar]   2/6 checando se 0_baseline ja foi resolvida...");
  const baseline = await verificarBaselineResolvida(tenant.connectionString);

  if (!baseline.resolvida) {
    console.error(`[migrar]   BLOQUEADO: ${baseline.motivo}.`);
    console.error("[migrar]   rode uma vez, manualmente, antes de tentar de novo:");
    console.error(`[migrar]     DATABASE_URL="<${tenant.connectionRef}>" npx prisma migrate resolve --applied 0_baseline`);
    return linhaResultado(tenant, { status: "BLOQUEADO_RESOLVE", backup: arquivoBackup, detalhe: baseline.motivo });
  }

  console.log("[migrar]   3/6 migrate status...");
  const status = executarComandoPrisma("migrate status", tenant.connectionString);
  console.log((status.stdout || status.stderr).trim());

  console.log("[migrar]   4/6 migrate diff...");
  const diff = executarComandoPrisma(DIFF_SCHEMA, tenant.connectionString);

  if (!diff.ok) {
    console.error(`[migrar]   FALHOU ao rodar migrate diff: ${diff.stderr}`);
    return linhaResultado(tenant, { status: "ERRO_DIFF", backup: arquivoBackup, detalhe: diff.stderr });
  }

  const destrutivas = encontrarOperacoesDestrutivas(diff.stdout);

  if (destrutivas.length > 0) {
    console.error("[migrar]   SQL potencialmente destrutivo encontrado:");
    for (const ocorrencia of destrutivas) {
      console.error(`[migrar]     [${ocorrencia.regra}] ${ocorrencia.linha}`);
    }

    if (process.env.AUTORIZAR_DESTRUTIVO !== "SIM") {
      console.error("[migrar]   BLOQUEADO. Para prosseguir mesmo assim, defina AUTORIZAR_DESTRUTIVO=SIM e rode de novo.");
      return linhaResultado(tenant, {
        status: "BLOQUEADO_DESTRUTIVO",
        backup: arquivoBackup,
        detalhe: destrutivas.map((d) => d.regra).join(", "),
      });
    }

    console.warn("[migrar]   AUTORIZAR_DESTRUTIVO=SIM definido: prosseguindo mesmo com SQL destrutivo acima.");
  }

  console.log("[migrar]   5/6 migrate deploy...");
  const deploy = executarComandoPrisma("migrate deploy", tenant.connectionString);

  if (!deploy.ok) {
    console.error(`[migrar]   FALHOU no migrate deploy: ${deploy.stderr}`);
    return linhaResultado(tenant, { status: "FALHA_DEPLOY", backup: arquivoBackup, detalhe: deploy.stderr });
  }

  const migracoesAplicadas =
    deploy.stdout
      .split("\n")
      .filter((linha) => /^Applying migration/i.test(linha.trim()))
      .map((linha) => linha.trim())
      .join("; ") || "nenhuma (ja estava em dia)";

  console.log(`[migrar]   deploy OK: ${migracoesAplicadas}`);

  console.log(`[migrar]   6/6 atualizando Tenant.versaoSchema para "${versaoAlvo}" no central...`);
  await prismaCentral.tenant.update({
    where: { id: tenant.id },
    data: { versaoSchema: versaoAlvo },
  });

  const reDiff = executarComandoPrisma(DIFF_SCHEMA, tenant.connectionString);

  if (!reDiff.ok || !diffEstaVazio(reDiff.stdout)) {
    console.error("[migrar]   POS-DEPLOY DIVERGENTE: o banco nao bate mais com prisma/schema.prisma depois do deploy.");
    console.error(reDiff.stdout || reDiff.stderr);
    console.error("[migrar]   Tenant.versaoSchema no central JA FOI atualizado; investigue antes de continuar.");
    return linhaResultado(tenant, {
      status: "POS_DEPLOY_DIVERGENTE",
      backup: arquivoBackup,
      migracoes: migracoesAplicadas,
      versaoSchemaNova: versaoAlvo,
      detalhe: reDiff.stdout || reDiff.stderr,
    });
  }

  console.log(`[migrar]   OK: ${tenant.slug} migrado e confirmado em dia com o schema.`);

  return linhaResultado(tenant, {
    status: "OK",
    backup: arquivoBackup,
    migracoes: migracoesAplicadas,
    versaoSchemaNova: versaoAlvo,
    detalhe: "",
  });
}

function linhaResultado(tenant, { status, backup = "-", migracoes = "-", versaoSchemaNova = "-", detalhe = "" }) {
  return {
    tenant: tenant.slug,
    backup,
    migracoesAplicadas: migracoes,
    novaVersaoSchema: versaoSchemaNova,
    resultado: detalhe ? `${status}: ${detalhe}`.slice(0, 160) : status,
  };
}

async function principal() {
  const centralDatabaseUrl = lerCentralDatabaseUrl();

  if (!centralDatabaseUrl) {
    imprimirAusenciaDeAmbiente();
    process.exit(1);
  }

  recusarPooler(centralDatabaseUrl, "CENTRAL_DATABASE_URL");

  const { dryRun, tenantFiltro } = lerArgumentos(process.argv.slice(2));

  if (!dryRun && process.env.CONFIRMAR !== "SIM") {
    console.error("");
    console.error("[migrar] ABORTADO: --aplicar exige tambem CONFIRMAR=SIM no ambiente.");
    console.error("[migrar] Rode sem --aplicar para ver o plano em modo dry-run.");
    console.error("");
    process.exit(1);
  }

  console.log("");
  console.log("Migracao por tenant");
  console.log(`  Banco central : ${mascararConnectionString(centralDatabaseUrl)}`);
  console.log(`  Modo          : ${dryRun ? "DRY-RUN (nada sera escrito)" : "APLICAR"}`);

  const versaoAlvo = await obterUltimaMigracaoTenant();
  console.log(`  Migration alvo: ${versaoAlvo}`);

  const descoberta = await listarTenantsAtivos(centralDatabaseUrl);
  avisarTenantsPulados(descoberta.pulados);

  let tenants = descoberta.resolvidos;

  if (tenantFiltro) {
    tenants = tenants.filter((tenant) => tenant.slug === tenantFiltro);

    if (tenants.length === 0) {
      console.error("");
      console.error(`[erro] --tenant ${tenantFiltro}: nenhum tenant ATIVO resolvido com esse slug.`);
      console.error(
        `[erro] Tenants ATIVOs resolvidos: ${descoberta.resolvidos.map((tenant) => tenant.slug).join(", ") || "(nenhum)"}`
      );
      console.error("");
      process.exit(1);
    }
  }

  if (tenants.length === 0) {
    console.log("");
    console.log("[migrar] Nenhum tenant ATIVO resolvido para processar.");
    return;
  }

  const prismaCentral = dryRun
    ? null
    : new PrismaCentral({ adapter: new PrismaNeon({ connectionString: centralDatabaseUrl }), log: ["error"] });

  const resultados = [];

  try {
    for (const tenant of tenants) {
      const resultado = await processarTenant(tenant, { dryRun, versaoAlvo, prismaCentral });
      resultados.push(resultado);

      if (!dryRun && !resultado.resultado.startsWith("OK")) {
        console.error("");
        console.error(`[migrar] PARANDO: tenant ${tenant.slug} nao terminou OK. Nenhum tenant seguinte sera processado.`);
        imprimirTabelaFinal(resultados);
        process.exit(1);
      }
    }
  } finally {
    await prismaCentral?.$disconnect();
  }

  imprimirTabelaFinal(resultados);

  if (resultados.some((linha) => !linha.resultado.startsWith("OK") && !linha.resultado.startsWith("PLANEJADO"))) {
    process.exit(1);
  }
}

function imprimirTabelaFinal(resultados) {
  console.log("");
  console.log("Resumo");
  console.table(resultados);
}

principal().catch((erro) => {
  console.error("");
  console.error(`[erro] Falha inesperada em migrar-tenants: ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
