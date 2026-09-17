// Descoberta de tenants ativos a partir do banco central, somente-leitura.
// Compartilhado por `db:backup` e `db:diagnostico`.
import { comConexaoSomenteLeitura, mascararConnectionString } from "./conexao-somente-leitura.mjs";

// Mesmas regras de lib/tenant/resolver-conexao-tenant.ts. Duplicado aqui de
// proposito: os scripts sao .mjs e nao passam pelo bundler/paths do Next.
const PADRAO_CONNECTION_REF_TENANT = /^TENANT_[A-Z0-9_]+_DATABASE_URL$/;

export function validarConnectionRefTenant(connectionRef) {
  const refNormalizada = String(connectionRef ?? "").trim();

  if (!refNormalizada) {
    throw new Error("Tenant sem connectionRef configurada.");
  }

  if (!PADRAO_CONNECTION_REF_TENANT.test(refNormalizada)) {
    throw new Error(`connectionRef de tenant invalida: ${refNormalizada}`);
  }

  if (refNormalizada.startsWith("NEXT_PUBLIC_") || refNormalizada.includes("CENTRAL")) {
    throw new Error(`connectionRef de tenant bloqueada por seguranca: ${refNormalizada}`);
  }

  return refNormalizada;
}

/**
 * Slug seguro para nome de arquivo. Nunca confiar direto no valor do banco.
 */
export function normalizarSlugParaArquivo(slug) {
  const normalizado = String(slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizado || "tenant-sem-slug";
}

export function lerCentralDatabaseUrl() {
  const centralDatabaseUrl = process.env.CENTRAL_DATABASE_URL;

  if (!centralDatabaseUrl || !centralDatabaseUrl.trim()) {
    return null;
  }

  return centralDatabaseUrl.trim();
}

/**
 * Lista os tenants ATIVOS de empresas ATIVAS e resolve a URL de cada um.
 *
 * Tenant sem connectionRef, com ref invalida ou com a variavel de ambiente
 * ausente e PULADO com aviso — nunca derruba a execucao inteira.
 */
export async function listarTenantsAtivos(centralDatabaseUrl) {
  const tenants = await comConexaoSomenteLeitura(
    centralDatabaseUrl,
    "banco central",
    async (cliente) => {
      const resultado = await cliente.query(
        `SELECT t.id,
                t.slug,
                t.status,
                t."versaoSchema",
                t."connectionRef",
                e.id   AS "empresaId",
                e.slug AS "empresaSlug",
                e.status AS "empresaStatus"
           FROM "Tenant" t
           JOIN "Empresa" e ON e.id = t."empresaId"
          WHERE t.status = 'ATIVO'
            AND e.status = 'ATIVA'
          ORDER BY e.slug, t.slug`
      );

      return resultado.rows;
    }
  );

  const resolvidos = [];
  const pulados = [];

  for (const tenant of tenants) {
    let connectionRef;

    try {
      connectionRef = validarConnectionRefTenant(tenant.connectionRef);
    } catch (erro) {
      pulados.push({
        slug: tenant.slug,
        motivo: erro instanceof Error ? erro.message : String(erro),
      });
      continue;
    }

    const connectionString = process.env[connectionRef];

    if (!connectionString || !connectionString.trim()) {
      pulados.push({
        slug: tenant.slug,
        motivo: `variavel de ambiente ${connectionRef} nao definida neste ambiente`,
      });
      continue;
    }

    resolvidos.push({
      ...tenant,
      connectionRef,
      connectionString: connectionString.trim(),
      connectionStringMascarada: mascararConnectionString(connectionString.trim()),
      slugArquivo: normalizarSlugParaArquivo(tenant.slug),
    });
  }

  return { resolvidos, pulados };
}

export function avisarTenantsPulados(pulados) {
  if (pulados.length === 0) {
    return;
  }

  console.warn("");
  console.warn(`[aviso] ${pulados.length} tenant(s) ativo(s) foram PULADOS:`);

  for (const pulado of pulados) {
    console.warn(`[aviso]   - ${pulado.slug}: ${pulado.motivo}`);
  }

  console.warn("[aviso] Defina as variaveis faltantes e rode de novo para cobrir todos os tenants.");
  console.warn("");
}

export function imprimirAusenciaDeAmbiente() {
  console.error("");
  console.error("[erro] CENTRAL_DATABASE_URL nao esta definida neste ambiente.");
  console.error("[erro] Este script precisa do banco central para descobrir os tenants ativos.");
  console.error("");
  console.error("[erro] Defina as variaveis antes de rodar (veja .env.example):");
  console.error("[erro]   CENTRAL_DATABASE_URL           conexao DIRETA do banco central");
  console.error("[erro]   TENANT_<NOME>_DATABASE_URL     uma por tenant ativo");
  console.error("");
  console.error("[erro] Use sempre a URL direta (sem '-pooler').");
  console.error("");
}
