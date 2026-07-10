import "dotenv/config";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const PADRAO_CONNECTION_REF = /^TENANT_[A-Z0-9_]+_DATABASE_URL$/;

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

function pareceHashBcrypt(valor) {
  return /^\$2[aby]\$\d{2}\$/.test(String(valor ?? ""));
}

function pareceUrlBanco(valor) {
  return /postgres(ql)?:\/\//i.test(String(valor ?? ""));
}

function mascararEmail(email) {
  const [usuario, dominio] = String(email ?? "").split("@");
  if (!usuario || !dominio) return "invalido";
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

function criarPrismaOperacional(connectionString) {
  return new PrismaOperacional({
    adapter: new PrismaNeon({ connectionString }),
    log: ["error"],
  });
}

async function coletarResumoOperacional(connectionRef) {
  const connectionString = obterEnvObrigatoria(connectionRef);
  const prismaTenant = criarPrismaOperacional(connectionString);

  try {
    const [
      configuracoes,
      clientes,
      produtos,
      ordensServico,
      vendas,
      contasReceber,
      despesas,
      metas,
      logsAuditoria,
      notasFiscais,
      usuariosOperacionais,
    ] = await Promise.all([
      prismaTenant.configuracao.count(),
      prismaTenant.cliente.count(),
      prismaTenant.produto.count(),
      prismaTenant.ordemServico.count(),
      prismaTenant.venda.count(),
      prismaTenant.contaReceber.count(),
      prismaTenant.despesa.count(),
      prismaTenant.meta.count(),
      prismaTenant.logAuditoria.count(),
      prismaTenant.notaFiscal.count(),
      prismaTenant.usuario.count(),
    ]);

    return {
      configuracoes,
      clientes,
      produtos,
      ordensServico,
      vendas,
      contasReceber,
      despesas,
      metas,
      logsAuditoria,
      notasFiscais,
      usuariosOperacionais,
    };
  } finally {
    await prismaTenant.$disconnect();
  }
}

async function verificarHashCentralPrincipal(prismaCentral) {
  const connectionString = obterEnvObrigatoria("TENANT_PRINCIPAL_DATABASE_URL");
  const prismaPrincipal = criarPrismaOperacional(connectionString);

  try {
    const usuariosOperacionais = await prismaPrincipal.usuario.findMany({
      select: { email: true, senha: true },
    });

    const resultados = [];

    for (const usuarioOperacional of usuariosOperacionais) {
      const emailNormalizado = usuarioOperacional.email.trim().toLowerCase();
      const usuarioCentral = await prismaCentral.usuarioCentral.findFirst({
        where: { email: { equals: emailNormalizado, mode: "insensitive" } },
        select: { senha: true, ativo: true },
      });

      resultados.push({
        email: mascararEmail(usuarioOperacional.email),
        existeNoCentral: Boolean(usuarioCentral),
        centralAtivo: Boolean(usuarioCentral?.ativo),
        hashCentralEhBcrypt: pareceHashBcrypt(usuarioCentral?.senha),
        hashOperacionalEhBcrypt: pareceHashBcrypt(usuarioOperacional.senha),
        hashCentralIgualOperacional:
          Boolean(usuarioCentral?.senha) && usuarioCentral.senha === usuarioOperacional.senha,
      });
    }

    return resultados;
  } finally {
    await prismaPrincipal.$disconnect();
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
    throw new Error("Tenant principal e cunhado apontam para o mesmo banco. Abortado.");
  }

  const prismaCentral = new PrismaCentral({
    adapter: new PrismaNeon({ connectionString: centralDatabaseUrl }),
    log: ["error"],
  });

  try {
    const [empresas, tenants, usuariosCentrais, vinculos, sessoes] = await Promise.all([
      prismaCentral.empresa.findMany({ select: { slug: true, status: true } }),
      prismaCentral.tenant.findMany({ select: { slug: true, status: true, connectionRef: true } }),
      prismaCentral.usuarioCentral.findMany({ select: { email: true, ativo: true, senha: true } }),
      prismaCentral.usuarioEmpresa.findMany({
        select: { ativo: true, role: true, empresa: { select: { slug: true } } },
      }),
      prismaCentral.sessaoCentral.findMany({ select: { revogadaEm: true, expiraEm: true } }),
    ]);

    const agora = new Date();
    const sessoesAtivas = sessoes.filter((sessao) => !sessao.revogadaEm && sessao.expiraEm > agora).length;
    const sessoesRevogadasOuExpiradas = sessoes.length - sessoesAtivas;

    const connectionRefsValidas = tenants.every(
      (tenant) => PADRAO_CONNECTION_REF.test(tenant.connectionRef ?? "") && !pareceUrlBanco(tenant.connectionRef)
    );

    const hashesCentrais = usuariosCentrais.map((usuario) => ({
      email: mascararEmail(usuario.email),
      ativo: usuario.ativo,
      hashEhBcrypt: pareceHashBcrypt(usuario.senha),
    }));

    const compatibilidadePrincipal = await verificarHashCentralPrincipal(prismaCentral);

    const resumosTenants = {};
    for (const tenant of TENANTS_ESPERADOS) {
      resumosTenants[tenant.slug] = await coletarResumoOperacional(tenant.connectionRef).catch((erro) => {
        throw new Error(`Falha ao ler tenant ${tenant.slug}: ${descreverErro(erro)}`);
      });
    }

    console.log(
      JSON.stringify(
        {
          central: {
            empresas: empresas.map((empresa) => ({ slug: empresa.slug, status: empresa.status })),
            tenants: tenants.map((tenant) => ({
              slug: tenant.slug,
              status: tenant.status,
              connectionRef: tenant.connectionRef,
            })),
            usuariosCentrais: hashesCentrais,
            vinculos: vinculos.map((vinculo) => ({
              empresa: vinculo.empresa.slug,
              role: vinculo.role,
              ativo: vinculo.ativo,
            })),
            sessoes: {
              ativas: sessoesAtivas,
              revogadasOuExpiradas: sessoesRevogadasOuExpiradas,
            },
            connectionRefsValidas,
            nenhumaUrlNoCentral: connectionRefsValidas,
          },
          compatibilidadeLoginCentralPrincipal: compatibilidadePrincipal,
          tenants: resumosTenants,
          arquitetura: {
            bancosDistintos: true,
            nenhumTenantCompartilhaConexao: true,
            principalAtivo: tenants.some((t) => t.slug === "principal" && t.status === "ATIVO"),
            cunhadoAtivo: tenants.some((t) => t.slug === "cunhado" && t.status === "ATIVO"),
          },
        },
        null,
        2
      )
    );
  } finally {
    await prismaCentral.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(descreverErro(erro));
  process.exit(1);
});
