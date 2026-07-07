import "dotenv/config";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const TENANTS_ESPERADOS = [
  { slug: "principal", connectionRef: "TENANT_PRINCIPAL_DATABASE_URL" },
  { slug: "cunhado", connectionRef: "TENANT_CUNHADO_DATABASE_URL" },
];

function obterEnvObrigatoria(nome) {
  const valor = process.env[nome];

  if (!valor) {
    throw new Error(`${nome} nao definida.`);
  }

  return valor;
}

function identidadeBanco(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname.toLowerCase(),
    database: url.pathname.replace(/^\//, "").toLowerCase(),
  };
}

function mesmaIdentidadeBanco(a, b) {
  const bancoA = identidadeBanco(a);
  const bancoB = identidadeBanco(b);

  return bancoA.host === bancoB.host && bancoA.database === bancoB.database;
}

function criarPrismaOperacional(connectionString) {
  return new PrismaOperacional({
    adapter: new PrismaNeon({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function criarPrismaCentral(connectionString) {
  return new PrismaCentral({
    adapter: new PrismaNeon({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

async function contarEstoque(connectionRef) {
  const connectionString = obterEnvObrigatoria(connectionRef);
  const prismaTenant = criarPrismaOperacional(connectionString);

  try {
    const produtos = await prismaTenant.produto.count();

    return {
      produtos,
      movimentacoes: 0,
      modeloMovimentacao: "nao_existe_no_schema_atual",
    };
  } finally {
    await prismaTenant.$disconnect();
  }
}

async function executar() {
  const centralDatabaseUrl = obterEnvObrigatoria("CENTRAL_DATABASE_URL");
  const tenantPrincipalDatabaseUrl = obterEnvObrigatoria("TENANT_PRINCIPAL_DATABASE_URL");
  const tenantCunhadoDatabaseUrl = obterEnvObrigatoria("TENANT_CUNHADO_DATABASE_URL");

  if (mesmaIdentidadeBanco(centralDatabaseUrl, tenantPrincipalDatabaseUrl)) {
    throw new Error("Banco central e tenant principal coincidem. Abortado.");
  }

  if (mesmaIdentidadeBanco(centralDatabaseUrl, tenantCunhadoDatabaseUrl)) {
    throw new Error("Banco central e tenant cunhado coincidem. Abortado.");
  }

  if (mesmaIdentidadeBanco(tenantPrincipalDatabaseUrl, tenantCunhadoDatabaseUrl)) {
    throw new Error("Tenant principal e tenant cunhado apontam para o mesmo banco. Abortado.");
  }

  const prismaCentral = criarPrismaCentral(centralDatabaseUrl);

  try {
    const tenants = await prismaCentral.tenant.findMany({
      where: {
        slug: { in: TENANTS_ESPERADOS.map((tenant) => tenant.slug) },
      },
      select: {
        slug: true,
        status: true,
        versaoSchema: true,
        connectionRef: true,
        empresa: {
          select: {
            slug: true,
            status: true,
          },
        },
      },
      orderBy: { slug: "asc" },
    });

    if (tenants.length !== TENANTS_ESPERADOS.length) {
      throw new Error("Tenants esperados nao foram encontrados no central.");
    }

    const resultados = [];

    for (const esperado of TENANTS_ESPERADOS) {
      const tenant = tenants.find((item) => item.slug === esperado.slug);

      if (!tenant) {
        throw new Error(`Tenant ${esperado.slug} nao encontrado.`);
      }

      if (tenant.connectionRef !== esperado.connectionRef) {
        throw new Error(`Tenant ${esperado.slug} com connectionRef inesperada.`);
      }

      resultados.push({
        slug: tenant.slug,
        status: tenant.status,
        versaoSchema: tenant.versaoSchema,
        connectionRef: tenant.connectionRef,
        empresa: tenant.empresa,
        estoque: await contarEstoque(tenant.connectionRef),
      });
    }

    const principal = resultados.find((tenant) => tenant.slug === "principal");
    const cunhado = resultados.find((tenant) => tenant.slug === "cunhado");

    console.log(JSON.stringify({
      bancosDistintos: true,
      tenants: resultados,
      isolamentoEstoque: {
        principalComProdutos: Boolean(principal && principal.estoque.produtos > 0),
        cunhadoIndependente: Boolean(cunhado),
        conexoesDistintas: true,
      },
    }, null, 2));
  } finally {
    await prismaCentral.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida no diagnostico de estoque.");
  process.exit(1);
});
