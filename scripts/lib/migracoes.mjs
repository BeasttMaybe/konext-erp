// Helpers compartilhados por scripts que rodam o Prisma CLI (schema do
// tenant operacional) contra uma connection string especifica de um tenant.
import { execSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const RAIZ_MIGRACOES_TENANT = path.resolve(process.cwd(), "prisma", "migrations");

/**
 * Nome da migration mais recente em prisma/migrations, em ordem lexica.
 * "0_baseline" sempre fica antes de qualquer pasta com prefixo de timestamp
 * (ex.: "20261001120000_..."), entao a ultima entrada ordenada e sempre a
 * migration mais recente de fato.
 */
export async function obterUltimaMigracaoTenant() {
  const entradas = await readdir(RAIZ_MIGRACOES_TENANT, { withFileTypes: true });
  const pastas = entradas
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();

  if (pastas.length === 0) {
    throw new Error(`Nenhuma pasta de migration encontrada em ${RAIZ_MIGRACOES_TENANT}.`);
  }

  return pastas[pastas.length - 1];
}

/**
 * Roda um subcomando do Prisma CLI (schema do tenant operacional, via
 * prisma.config.ts) contra a connection string informada. A credencial e
 * passada por DATABASE_URL no ambiente do processo filho, nunca por argv —
 * argv apareceria em `ps`/gerenciador de tarefas e em qualquer log de shell.
 *
 * Usa execSync (nao spawnSync) de proposito: no Windows `npx` e um shim
 * .cmd, e spawnSync sem `shell: true` falha com ENOENT nessa plataforma.
 * Mesmo padrao ja usado em scripts/migrate-deploy-com-retry.mjs.
 */
export function executarComandoPrisma(subcomando, connectionString) {
  try {
    const stdout = execSync(`npx prisma ${subcomando}`, {
      env: { ...process.env, DATABASE_URL: connectionString },
      encoding: "utf8",
      stdio: "pipe",
    });

    return { ok: true, codigo: 0, stdout, stderr: "" };
  } catch (erro) {
    return {
      ok: false,
      codigo: Number(erro?.status ?? 1),
      stdout: typeof erro?.stdout === "string" ? erro.stdout : "",
      stderr:
        typeof erro?.stderr === "string" && erro.stderr
          ? erro.stderr
          : erro instanceof Error
            ? erro.message
            : String(erro),
    };
  }
}
