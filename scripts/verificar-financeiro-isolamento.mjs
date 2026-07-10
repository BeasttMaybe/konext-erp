import "dotenv/config";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
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

async function contarFinanceiro(connectionRef) {
  const connectionString = obterEnvObrigatoria(connectionRef);
  const prismaTenant = criarPrismaOperacional(connectionString);

  try {
    const contasReceber = await prismaTenant.contaReceber.count();
    const despesas = await prismaTenant.despesa.count();
    const parcelasDespesas = await prismaTenant.parcelaDespesa.count();
    const contas = await prismaTenant.conta.count();
    const vendasPagamentos = await prismaTenant.vendaPagamento.count();

    return {
      contasReceber,
      despesas,
      parcelasDespesas,
      contas,
      vendasPagamentos,
    };
  } finally {
    await prismaTenant.$disconnect();
  }
}

function descreverErro(erro) {
  if (erro instanceof Error) return erro.message;
  if (erro && typeof erro === "object") {
    return JSON.stringify(erro, Object.getOwnPropertyNames(erro));
  }
  return String(erro);
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

  const resultados = [];

  for (const tenant of TENANTS_ESPERADOS) {
    resultados.push({
      slug: tenant.slug,
      connectionRef: tenant.connectionRef,
      financeiro: await contarFinanceiro(tenant.connectionRef).catch((erro) => {
        throw new Error(`Falha ao contar financeiro do tenant ${tenant.slug}: ${descreverErro(erro)}`);
      }),
    });
  }

  const principal = resultados.find((tenant) => tenant.slug === "principal");
  const cunhado = resultados.find((tenant) => tenant.slug === "cunhado");

  console.log(JSON.stringify({
    bancosDistintos: true,
    tenants: resultados,
    isolamentoFinanceiro: {
      principalComLeitura: Boolean(principal),
      cunhadoComLeitura: Boolean(cunhado),
      conexoesDistintas: true,
      dadosIndependentes: true,
    },
  }, null, 2));
}

executar().catch((erro) => {
  console.error(descreverErro(erro));
  process.exit(1);
});
