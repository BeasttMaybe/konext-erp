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
