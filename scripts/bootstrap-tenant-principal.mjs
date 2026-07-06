import "dotenv/config";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const EMPRESA_SLUG = "konext-principal";
const TENANT_SLUG = "principal";
const TENANT_CONNECTION_REF = "TENANT_PRINCIPAL_DATABASE_URL";
const TENANT_SCHEMA_VERSION = "operacional-atual-20260706";

const modoDryRun = process.argv.includes("--dry-run");
const confirmado = process.argv.includes("--confirm");

if (!modoDryRun && !confirmado) {
  console.error("Bootstrap real exige confirmacao explicita: use --confirm.");
  process.exit(1);
}

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

function descreverBancoSeguro(connectionString) {
  const banco = identidadeBanco(connectionString);
  const hostMascarado = banco.host.replace(/^([^-]+)-(.{3}).*?([^.]+)\./, "$1-$2***$3.");

  return `${hostMascarado}/${banco.database}`;
}

function mascararEmail(email) {
  const [usuario, dominio] = email.split("@");

  if (!usuario || !dominio) {
    return "***";
  }

  const inicio = usuario.slice(0, 2);
  const fim = usuario.length > 4 ? usuario.slice(-1) : "";

  return `${inicio}***${fim}@${dominio}`;
}

async function selecionarNomeEmpresa(prismaOperacional) {
  const configuracoes = await prismaOperacional.configuracao.findMany({
    select: {
      nomeFantasia: true,
      razaoSocial: true,
    },
  });

  const nomes = configuracoes
    .map((configuracao) => {
      const nomeFantasia = configuracao.nomeFantasia?.trim();
      const razaoSocial = configuracao.razaoSocial?.trim();
      return nomeFantasia || razaoSocial || "";
    })
    .filter(Boolean);

  const nomesUnicos = [...new Set(nomes)];

  if (nomesUnicos.length > 1) {
    throw new Error("Mais de uma Configuracao operacional possui nomes de empresa diferentes.");
  }

  return nomesUnicos[0] ?? "Konext Principal";
}

async function selecionarUsuarioOperacional(prismaOperacional) {
  const usuarios = await prismaOperacional.usuario.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      senha: true,
      role: true,
    },
    orderBy: {
      criadoEm: "asc",
    },
  });

  if (usuarios.length === 0) {
    throw new Error("Nenhum Usuario operacional encontrado para bootstrap.");
  }

  const administradores = usuarios.filter((usuario) => usuario.role === "ADMIN");

  if (administradores.length === 1) {
    return {
      usuario: administradores[0],
      criterio: "usuario administrativo unico",
    };
  }

  if (administradores.length > 1) {
    throw new Error("Bootstrap ambiguo: existe mais de um Usuario operacional ADMIN.");
  }

  if (usuarios.length === 1) {
    return {
      usuario: usuarios[0],
      criterio: "usuario unico existente",
    };
  }

  throw new Error("Bootstrap ambiguo: nenhum ADMIN e multiplos usuarios operacionais encontrados.");
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

async function executar() {
  const databaseUrl = obterEnvObrigatoria("DATABASE_URL");
  const centralDatabaseUrl = obterEnvObrigatoria("CENTRAL_DATABASE_URL");
  const tenantPrincipalDatabaseUrl = obterEnvObrigatoria(TENANT_CONNECTION_REF);

  if (mesmaIdentidadeBanco(databaseUrl, centralDatabaseUrl)) {
    throw new Error("CENTRAL_DATABASE_URL aponta para o mesmo banco de DATABASE_URL. Bootstrap abortado.");
  }

  if (!mesmaIdentidadeBanco(databaseUrl, tenantPrincipalDatabaseUrl)) {
    throw new Error(`${TENANT_CONNECTION_REF} nao representa o mesmo banco operacional principal de DATABASE_URL.`);
  }

  if (mesmaIdentidadeBanco(centralDatabaseUrl, tenantPrincipalDatabaseUrl)) {
    throw new Error(`${TENANT_CONNECTION_REF} aponta para o banco central. Bootstrap abortado.`);
  }

  const prismaOperacional = criarPrismaOperacional(databaseUrl);
  const prismaCentral = criarPrismaCentral(centralDatabaseUrl);

  try {
    const nomeEmpresa = await selecionarNomeEmpresa(prismaOperacional);
    const { usuario, criterio } = await selecionarUsuarioOperacional(prismaOperacional);

    const plano = {
      modo: modoDryRun ? "dry-run" : "confirmado",
      operacional: descreverBancoSeguro(databaseUrl),
      central: descreverBancoSeguro(centralDatabaseUrl),
      criterioUsuario: criterio,
      empresa: {
        nome: nomeEmpresa,
        slug: EMPRESA_SLUG,
        status: "ATIVA",
      },
      tenant: {
        slug: TENANT_SLUG,
        status: "ATIVO",
        versaoSchema: TENANT_SCHEMA_VERSION,
        connectionRef: TENANT_CONNECTION_REF,
      },
      usuarioCentral: {
        nome: usuario.nome,
        email: mascararEmail(usuario.email),
        ativo: true,
      },
      vinculo: {
        role: "ADMIN",
        ativo: true,
      },
    };

    console.log(JSON.stringify(plano, null, 2));

    if (modoDryRun) {
      console.log("Dry-run concluido. Nenhuma escrita executada.");
      return;
    }

    const empresa = await prismaCentral.empresa.upsert({
      where: { slug: EMPRESA_SLUG },
      create: {
        nome: nomeEmpresa,
        slug: EMPRESA_SLUG,
        status: "ATIVA",
      },
      update: {
        nome: nomeEmpresa,
        status: "ATIVA",
      },
    });

    const tenant = await prismaCentral.tenant.upsert({
      where: { slug: TENANT_SLUG },
      create: {
        empresaId: empresa.id,
        slug: TENANT_SLUG,
        status: "ATIVO",
        versaoSchema: TENANT_SCHEMA_VERSION,
        connectionRef: TENANT_CONNECTION_REF,
      },
      update: {
        empresaId: empresa.id,
        status: "ATIVO",
        versaoSchema: TENANT_SCHEMA_VERSION,
        connectionRef: TENANT_CONNECTION_REF,
      },
    });

    const usuarioCentral = await prismaCentral.usuarioCentral.upsert({
      where: { email: usuario.email },
      create: {
        nome: usuario.nome,
        email: usuario.email,
        senha: usuario.senha,
        ativo: true,
      },
      update: {
        nome: usuario.nome,
        senha: usuario.senha,
        ativo: true,
      },
    });

    const usuarioEmpresa = await prismaCentral.usuarioEmpresa.upsert({
      where: {
        usuarioId_empresaId: {
          usuarioId: usuarioCentral.id,
          empresaId: empresa.id,
        },
      },
      create: {
        usuarioId: usuarioCentral.id,
        empresaId: empresa.id,
        role: "ADMIN",
        ativo: true,
      },
      update: {
        role: "ADMIN",
        ativo: true,
      },
    });

    console.log(JSON.stringify({
      bootstrap: "concluido",
      empresa: { id: empresa.id, slug: empresa.slug, nome: empresa.nome },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status,
        versaoSchema: tenant.versaoSchema,
        connectionRef: tenant.connectionRef,
      },
      usuarioCentral: {
        id: usuarioCentral.id,
        nome: usuarioCentral.nome,
        email: mascararEmail(usuarioCentral.email),
      },
      usuarioEmpresa: {
        id: usuarioEmpresa.id,
        role: usuarioEmpresa.role,
        ativo: usuarioEmpresa.ativo,
      },
    }, null, 2));
  } finally {
    await prismaOperacional.$disconnect();
    await prismaCentral.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida no bootstrap.");
  process.exit(1);
});
