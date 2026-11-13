import { prismaCentral } from "@/lib/central/prisma-central";
import { abrirConexao, chaveDoCofre, REF_DO_COFRE } from "@/lib/tenant/cofre-de-conexoes";

const PADRAO_CONNECTION_REF_TENANT = /^TENANT_[A-Z0-9_]+_DATABASE_URL$/;

export function validarConnectionRefTenant(connectionRef: string): string {
  const refNormalizada = connectionRef.trim();

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

export function resolverConexaoTenant(connectionRef: string): string {
  const refValidada = validarConnectionRefTenant(connectionRef);
  const connectionString = process.env[refValidada];

  if (!connectionString) {
    throw new Error(`Variavel de conexao do tenant nao configurada: ${refValidada}`);
  }

  return connectionString;
}

/**
 * Endereco do banco de um tenant, para os dois tipos de loja:
 * - connectionRef = TENANT_X_DATABASE_URL: variavel de ambiente (lojas antigas);
 * - connectionRef = "COFRE": ConexaoTenant no banco central, cifrada
 *   (lojas criadas pelo master — lib/tenant/cofre-de-conexoes.ts).
 * Uma leitura do cofre por tenant por processo: o endereco nao muda.
 */
const conexoesDoCofre = new Map<string, string>();

export async function conexaoDoTenant(tenant: { id: string; connectionRef: string | null }): Promise<string> {
  const ref = tenant.connectionRef?.trim() ?? "";
  if (ref !== REF_DO_COFRE) return resolverConexaoTenant(ref);

  const emCache = conexoesDoCofre.get(tenant.id);
  if (emCache) return emCache;
  const guardada = await prismaCentral.conexaoTenant.findUnique({
    where: { tenantId: tenant.id },
    select: { conexaoCifrada: true },
  });
  if (!guardada) throw new Error("Tenant do cofre sem conexao guardada.");
  const conexao = abrirConexao(guardada.conexaoCifrada, tenant.id, chaveDoCofre(process.env.CHAVE_DAS_CONEXOES));
  conexoesDoCofre.set(tenant.id, conexao);
  return conexao;
}
