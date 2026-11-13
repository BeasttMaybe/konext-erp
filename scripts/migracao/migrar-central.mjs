// Migrations do banco CENTRAL (empresas, tenants, logins, cargos).
//
// O banco central e um so — diferente dos tenants, que o migrar-tenants.mjs
// percorre um a um. As travas sao as mesmas:
//   --dry-run (padrao): mostra `migrate status` e o SQL que seria aplicado.
//   --aplicar: exige CONFIRMAR=SIM e PONTO_RESTAURACAO (criado pelo workflow
//     banco.yml antes de rodar); SQL destrutivo exige AUTORIZAR_DESTRUTIVO=SIM;
//     URL com -pooler e recusada. Depois do deploy, o diff tem que dar vazio.
//
// Uso: CENTRAL_DATABASE_URL=... node scripts/migracao/migrar-central.mjs [--dry-run|--aplicar]
import "dotenv/config";
import { execSync } from "node:child_process";

import { mascararConnectionString, recusarPooler } from "../lib/conexao-somente-leitura.mjs";
import { lerCentralDatabaseUrl } from "../lib/tenants-centrais.mjs";

const CONFIG = "--config prisma.central.config.ts";
const DIFF = `migrate diff ${CONFIG} --from-config-datasource --to-schema prisma/central/schema.prisma --script`;

const DESTRUTIVAS = [
  /^DROP\s+TABLE\b/i,
  /ALTER\s+TABLE[\s\S]*DROP\s+COLUMN\b/i,
  /ALTER\s+COLUMN[\s\S]*\bTYPE\b/i,
  /DROP\s+CONSTRAINT\b/i,
  /^TRUNCATE\b/i,
  /^DELETE\s+FROM\b/i,
  /^UPDATE\b/i,
];

function prisma(subcomando, url) {
  try {
    const stdout = execSync(`npx prisma ${subcomando}`, {
      env: { ...process.env, CENTRAL_DATABASE_URL: url },
      encoding: "utf8",
      stdio: "pipe",
    });
    return { ok: true, stdout, stderr: "" };
  } catch (erro) {
    return {
      ok: false,
      stdout: typeof erro?.stdout === "string" ? erro.stdout : "",
      stderr: typeof erro?.stderr === "string" && erro.stderr ? erro.stderr : String(erro?.message ?? erro),
    };
  }
}

function destrutivasDo(sql) {
  return sql
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--") && DESTRUTIVAS.some((r) => r.test(l)));
}

function semMudancas(sql) {
  return sql
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--")).length === 0;
}

function recuar(texto) {
  return String(texto)
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
}

async function principal() {
  const aplicar = process.argv.includes("--aplicar");
  const url = lerCentralDatabaseUrl();
  if (!url) {
    console.error("[central] CENTRAL_DATABASE_URL ausente.");
    process.exit(1);
  }
  recusarPooler(url, "CENTRAL_DATABASE_URL");
  console.log(`[central] banco: ${mascararConnectionString(url)}`);
  console.log(`[central] modo: ${aplicar ? "APLICAR" : "dry-run"}`);

  const status = prisma(`migrate status ${CONFIG}`, url);
  console.log("[central] migrate status:");
  console.log(recuar(status.stdout || status.stderr));

  const diff = prisma(DIFF, url);
  if (!diff.ok) {
    console.error(`[central] FALHOU o migrate diff:\n${recuar(diff.stderr)}`);
    process.exit(1);
  }
  const destrutivas = destrutivasDo(diff.stdout);
  console.log("[central] SQL que falta para o banco bater com prisma/central/schema.prisma:");
  console.log(recuar(semMudancas(diff.stdout) ? "(nada)" : diff.stdout));
  if (destrutivas.length) console.log(`[central] operacoes destrutivas:\n${recuar(destrutivas.join("\n"))}`);

  if (!aplicar) {
    console.log(
      `[central] plano: ${
        semMudancas(diff.stdout) && /up to date|atualizado/i.test(status.stdout)
          ? "nada a fazer"
          : "aplicaria as migrations pendentes com migrate deploy"
      }`
    );
    return;
  }

  if (process.env.CONFIRMAR !== "SIM") {
    console.error("[central] BLOQUEADO: --aplicar exige CONFIRMAR=SIM.");
    process.exit(1);
  }
  if (!process.env.PONTO_RESTAURACAO) {
    console.error("[central] BLOQUEADO: --aplicar exige PONTO_RESTAURACAO.");
    process.exit(1);
  }
  if (destrutivas.length && process.env.AUTORIZAR_DESTRUTIVO !== "SIM") {
    console.error("[central] BLOQUEADO: SQL destrutivo sem AUTORIZAR_DESTRUTIVO=SIM.");
    process.exit(1);
  }
  console.log(`[central] ponto de restauracao confirmado: ${process.env.PONTO_RESTAURACAO}`);

  const deploy = prisma(`migrate deploy ${CONFIG}`, url);
  console.log(recuar(deploy.stdout || deploy.stderr));
  if (!deploy.ok) {
    console.error("[central] FALHOU o migrate deploy.");
    process.exit(1);
  }

  const depois = prisma(DIFF, url);
  if (!depois.ok || !semMudancas(depois.stdout)) {
    console.error(`[central] POS_DEPLOY_DIVERGENTE: o banco nao bate com o schema depois do deploy.\n${recuar(depois.stdout || depois.stderr)}`);
    process.exit(1);
  }
  console.log("[central] aplicado; banco central confere com o schema.");
}

principal().catch((erro) => {
  console.error(`[central] erro: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});
