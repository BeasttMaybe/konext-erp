import "dotenv/config";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

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

function mascararEmail(email) {
  const [usuario, dominio] = email.split("@");

  if (!usuario || !dominio) {
    return "***";
  }

  return `${usuario.slice(0, 2)}***${usuario.length > 4 ? usuario.slice(-1) : ""}@${dominio}`;
}

function validarConnectionRefTenant(connectionRef) {
  if (!/^TENANT_[A-Z0-9_]+_DATABASE_URL$/.test(connectionRef)) {
    throw new Error(`connectionRef invalida: ${connectionRef}`);
  }

  if (connectionRef.startsWith("NEXT_PUBLIC_") || connectionRef.includes("CENTRAL")) {
    throw new Error(`connectionRef bloqueada por seguranca: ${connectionRef}`);
  }
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

async function selecionarUsuarioAdminOperacional(prismaOperacional) {
  const usuarios = await prismaOperacional.usuario.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      nome: true,
      email: true,
    },
    orderBy: { criadoEm: "asc" },
  });

  if (usuarios.length === 0) {
    throw new Error("Nenhum usuario operacional ADMIN encontrado.");
  }

  if (usuarios.length > 1) {
    throw new Error("Mais de um usuario operacional ADMIN encontrado. Diagnostico abortado.");
  }

  return usuarios[0];
}

async function executar() {
  const databaseUrl = obterEnvObrigatoria("DATABASE_URL");
  const centralDatabaseUrl = obterEnvObrigatoria("CENTRAL_DATABASE_URL");
  const tenantPrincipalDatabaseUrl = obterEnvObrigatoria("TENANT_PRINCIPAL_DATABASE_URL");

  if (mesmaIdentidadeBanco(databaseUrl, centralDatabaseUrl)) {
    throw new Error("CENTRAL_DATABASE_URL aponta para o banco operacional. Diagnostico abortado.");
  }

  if (!mesmaIdentidadeBanco(databaseUrl, tenantPrincipalDatabaseUrl)) {
    throw new Error("TENANT_PRINCIPAL_DATABASE_URL nao aponta para o banco operacional esperado.");
  }

  if (mesmaIdentidadeBanco(centralDatabaseUrl, tenantPrincipalDatabaseUrl)) {
    throw new Error("TENANT_PRINCIPAL_DATABASE_URL aponta para o banco central. Diagnostico abortado.");
  }

  const prismaOperacional = criarPrismaOperacional(databaseUrl);
  const prismaCentral = criarPrismaCentral(centralDatabaseUrl);
  const prismaTenant = criarPrismaOperacional(tenantPrincipalDatabaseUrl);

  try {
    const usuarioOperacional = await selecionarUsuarioAdminOperacional(prismaOperacional);
    const usuariosCentrais = await prismaCentral.usuarioCentral.findMany({
      where: {
        email: {
          equals: usuarioOperacional.email.trim().toLowerCase(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        ativo: true,
      },
    });

    if (usuariosCentrais.length !== 1) {
      throw new Error("UsuarioCentral correspondente nao foi encontrado de forma unica.");
    }

    const usuarioCentral = usuariosCentrais[0];

    if (!usuarioCentral.ativo) {
      throw new Error("UsuarioCentral correspondente esta inativo.");
    }

    const vinculos = await prismaCentral.usuarioEmpresa.findMany({
      where: {
        usuarioId: usuarioCentral.id,
        ativo: true,
      },
      select: {
        empresa: {
          select: {
            id: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (vinculos.length !== 1) {
      throw new Error("Vinculo ativo UsuarioEmpresa nao foi encontrado de forma unica.");
    }

    const empresa = vinculos[0].empresa;

    if (empresa.status !== "ATIVA") {
      throw new Error("Empresa vinculada nao esta ATIVA.");
    }

    const tenants = await prismaCentral.tenant.findMany({
      where: {
        empresaId: empresa.id,
        status: "ATIVO",
      },
      select: {
        slug: true,
        status: true,
        versaoSchema: true,
        connectionRef: true,
      },
    });

    if (tenants.length !== 1) {
      throw new Error("Tenant ativo nao foi encontrado de forma unica.");
    }

    const tenant = tenants[0];

    if (!tenant.connectionRef) {
      throw new Error("Tenant ativo sem connectionRef.");
    }

    validarConnectionRefTenant(tenant.connectionRef);
    const connectionString = obterEnvObrigatoria(tenant.connectionRef);

    if (!mesmaIdentidadeBanco(connectionString, tenantPrincipalDatabaseUrl)) {
      throw new Error("connectionRef resolvida nao aponta para o tenant principal esperado.");
    }

    if (mesmaIdentidadeBanco(connectionString, centralDatabaseUrl)) {
      throw new Error("connectionRef resolvida aponta para o banco central. Diagnostico abortado.");
    }

    const [usuariosTenant, configuracoesTenant] = await Promise.all([
      prismaTenant.usuario.count(),
      prismaTenant.configuracao.count(),
    ]);

    console.log(JSON.stringify({
      usuarioOperacional: {
        encontrado: true,
        email: mascararEmail(usuarioOperacional.email),
      },
      usuarioCentral: {
        encontrado: true,
        ativo: usuarioCentral.ativo,
      },
      empresa: {
        slug: empresa.slug,
        status: empresa.status,
      },
      tenant: {
        slug: tenant.slug,
        status: tenant.status,
        versaoSchema: tenant.versaoSchema,
        connectionRef: tenant.connectionRef,
      },
      conexaoOperacional: {
        validada: true,
        usaBancoCentral: false,
      },
      leituraTenant: {
        usuarios: usuariosTenant,
        configuracoes: configuracoesTenant,
      },
    }, null, 2));
  } finally {
    await prismaOperacional.$disconnect();
    await prismaCentral.$disconnect();
    await prismaTenant.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida no diagnostico de tenant.");
  process.exit(1);
});
