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

function numeroSeguro(valor) {
  if (typeof valor === "number") return valor;
  if (typeof valor === "bigint") return Number(valor);
  if (valor == null) return 0;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

async function coletarResumoTenant(connectionRef) {
  const connectionString = obterEnvObrigatoria(connectionRef);
  const prismaTenant = criarPrismaOperacional(connectionString);

  try {
    const [
      metas,
      itensChecklist,
      historicosMeta,
      logsAuditoria,
      notasFiscais,
      vendasCount,
      vendasValorTotal,
      contasReceberPendentes,
      despesasTotal,
      parcelasPendentes,
      ordensServicoAbertas,
      clientesCount,
      produtosCount,
      estoqueTotal,
    ] = await Promise.all([
      prismaTenant.meta.count(),
      prismaTenant.itemChecklistMeta.count(),
      prismaTenant.historicoMeta.count(),
      prismaTenant.logAuditoria.count(),
      prismaTenant.notaFiscal.count(),
      prismaTenant.venda.count(),
      prismaTenant.venda.aggregate({ _sum: { valorTotal: true } }),
      prismaTenant.contaReceber.aggregate({ where: { status: { in: ["PENDENTE", "ATRASADO", "RENEGOCIADO"] } }, _sum: { valor: true } }),
      prismaTenant.despesa.aggregate({ _sum: { valorTotal: true } }),
      prismaTenant.parcelaDespesa.aggregate({ where: { status: { in: ["PENDENTE", "ATRASADO"] } }, _sum: { valor: true } }),
      prismaTenant.ordemServico.count({ where: { excluidaEm: null, archivedAt: null, status: { notIn: ["PRONTO", "ENTREGUE"] } } }),
      prismaTenant.cliente.count(),
      prismaTenant.produto.count({ where: { ativo: true } }),
      prismaTenant.produto.aggregate({ _sum: { quantidadeEstoque: true } }),
    ]);

    return {
      contadores: {
        metas,
        itensChecklist,
        historicosMeta,
        logsAuditoria,
        notasFiscais,
      },
      dashboard: {
        vendasCount,
        faturamentoVendas: numeroSeguro(vendasValorTotal._sum.valorTotal),
        receberPendente: numeroSeguro(contasReceberPendentes._sum.valor),
        despesasTotal: numeroSeguro(despesasTotal._sum.valorTotal),
        parcelasPendentes: numeroSeguro(parcelasPendentes._sum.valor),
        ordensServicoAbertas,
        clientes: clientesCount,
        produtosAtivos: produtosCount,
        estoqueTotal: numeroSeguro(estoqueTotal._sum.quantidadeEstoque),
      },
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
    const resumo = await coletarResumoTenant(tenant.connectionRef).catch((erro) => {
      throw new Error(`Falha ao coletar dados do tenant ${tenant.slug}: ${descreverErro(erro)}`);
    });

    resultados.push({
      slug: tenant.slug,
      connectionRef: tenant.connectionRef,
      ...resumo,
    });
  }

  const principal = resultados.find((tenant) => tenant.slug === "principal");
  const cunhado = resultados.find((tenant) => tenant.slug === "cunhado");

  console.log(
    JSON.stringify(
      {
        bancosDistintos: true,
        tenants: resultados,
        isolamento: {
          principalComLeitura: Boolean(principal),
          cunhadoComLeitura: Boolean(cunhado),
          conexoesDistintas: true,
          dadosIndependentes: true,
        },
      },
      null,
      2
    )
  );
}

executar().catch((erro) => {
  console.error(descreverErro(erro));
  process.exit(1);
});
