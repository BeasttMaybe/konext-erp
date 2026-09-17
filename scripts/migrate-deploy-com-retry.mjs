import "dotenv/config";
import { execSync } from "node:child_process";

function mascararConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    return `postgresql://${url.username}:***@${url.hostname}${url.pathname}`;
  } catch {
    return "(DATABASE_URL ausente ou invalida)";
  }
}

function imprimirAlvoMigracao() {
  const ambiente = String(process.env.AMBIENTE ?? "NAO DECLARADO").toUpperCase();
  const alvo = mascararConnectionString(process.env.DATABASE_URL ?? "");
  console.log(`[migrate] AMBIENTE: ${ambiente}`);
  console.log(`[migrate] Alvo da migracao: ${alvo}`);
}

const MAX_TENTATIVAS = Number(process.env.PRISMA_MIGRATE_RETRY_MAX ?? 5);
const ATRASO_BASE_MS = Number(process.env.PRISMA_MIGRATE_RETRY_DELAY_MS ?? 12000);
const ATRASO_MAX_MS = Number(process.env.PRISMA_MIGRATE_RETRY_MAX_DELAY_MS ?? 60000);

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ehErroDeAdvisoryLock(saida) {
  const texto = saida.toLowerCase();
  return (
    texto.includes("p1002") ||
    texto.includes("timed out trying to acquire a postgres advisory lock") ||
    texto.includes("pg_advisory_lock") ||
    texto.includes("advisory lock")
  );
}

const CONFIRMACAO_EXIGIDA = "SIM";

/**
 * Trava manual. Este script aplica migrations de verdade e NAO faz mais parte do
 * `npm run build` — so pode rodar por decisao explicita de um operador humano.
 */
function exigirConfirmacaoExplicita() {
  const confirmacao = String(process.env.CONFIRMAR_MIGRACAO ?? "").trim().toUpperCase();

  if (confirmacao === CONFIRMACAO_EXIGIDA) {
    console.log("[migrate] Confirmacao recebida (CONFIRMAR_MIGRACAO=SIM).");
    return;
  }

  console.error("");
  console.error("[migrate] ABORTADO: migracao nao confirmada.");
  console.error("[migrate] Este comando aplica migrations no banco acima e nao pode ser desfeito.");
  console.error("[migrate] Confira o AMBIENTE e o host mascarado antes de prosseguir.");
  console.error("[migrate] Faca um backup (`npm run db:backup`) antes de qualquer migracao.");
  console.error("");
  console.error("[migrate] Para executar de verdade, defina CONFIRMAR_MIGRACAO=SIM:");
  console.error('[migrate]   PowerShell : $env:CONFIRMAR_MIGRACAO="SIM"; npm run db:migrate:deploy:manual');
  console.error("[migrate]   bash       : CONFIRMAR_MIGRACAO=SIM npm run db:migrate:deploy:manual");
  console.error("");
  process.exit(1);
}

async function executar() {
  // O alvo e impresso ANTES da trava, para o operador conferir host e AMBIENTE.
  imprimirAlvoMigracao();
  exigirConfirmacaoExplicita();

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    console.log(`[migrate] Tentativa ${tentativa}/${MAX_TENTATIVAS}...`);
    try {
      const saida = execSync("npx prisma migrate deploy", {
        env: process.env,
        encoding: "utf8",
        stdio: "pipe",
      });

      if (saida) process.stdout.write(saida);
      console.log("[migrate] Prisma migrate deploy concluido com sucesso.");
      return;
    } catch (erro) {
      const stdout = typeof erro?.stdout === "string" ? erro.stdout : "";
      const stderr = typeof erro?.stderr === "string" ? erro.stderr : "";
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);

      const codigoSaida = Number(erro?.status ?? 1);
      const saidaCompleta = `${stdout}\n${stderr}\n${erro?.message ?? ""}`;
    const podeTentarNovamente = ehErroDeAdvisoryLock(saidaCompleta) && tentativa < MAX_TENTATIVAS;

    if (!podeTentarNovamente) {
      console.error("[migrate] Falha nao recuperavel ao executar prisma migrate deploy.");
      process.exit(codigoSaida);
    }

    const atrasoMs = Math.min(ATRASO_BASE_MS * tentativa, ATRASO_MAX_MS);
    console.warn(`[migrate] Advisory lock em uso. Nova tentativa em ${atrasoMs}ms.`);
    await dormir(atrasoMs);
    }
  }

  process.exit(1);
}

await executar();
