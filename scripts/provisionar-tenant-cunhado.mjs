import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Client, neonConfig } from "@neondatabase/serverless";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { CUSTO_HASH_SENHA } from "../lib/auth/senha.ts";
import { executarComandoPrisma, obterUltimaMigracaoTenant } from "./lib/migracoes.mjs";
import { criarCargosPadrao } from "../lib/central/cargos-padrao.ts";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const CONNECTION_REF = "TENANT_CUNHADO_DATABASE_URL";
const EMPRESA_SLUG = "cunhado";
const TENANT_SLUG = "cunhado";

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

function validarBancoCunhadoDistinto(databaseUrl, centralDatabaseUrl, tenantPrincipalDatabaseUrl, tenantCunhadoDatabaseUrl) {
  if (mesmaIdentidadeBanco(databaseUrl, centralDatabaseUrl)) {
    throw new Error("DATABASE_URL e CENTRAL_DATABASE_URL apontam para o mesmo banco. Abortado.");
  }

  const comparacoes = [
    { nome: "DATABASE_URL", valor: databaseUrl },
    { nome: "CENTRAL_DATABASE_URL", valor: centralDatabaseUrl },
    { nome: "TENANT_PRINCIPAL_DATABASE_URL", valor: tenantPrincipalDatabaseUrl },
  ];

  for (const comparacao of comparacoes) {
    if (mesmaIdentidadeBanco(tenantCunhadoDatabaseUrl, comparacao.valor)) {
      throw new Error(`${CONNECTION_REF} e ${comparacao.nome} apontam para o mesmo banco. Abortado.`);
    }
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

async function listarObjetosPublicos(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const tabelas = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const enums = await client.query(`
      SELECT typname
      FROM pg_type
      JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
      WHERE pg_namespace.nspname = 'public'
        AND pg_type.typtype = 'e'
      ORDER BY typname
    `);

    return {
      tabelas: tabelas.rows.map((row) => String(row.tablename)),
      enums: enums.rows.map((row) => String(row.typname)),
    };
  } finally {
    await client.end();
  }
}

function validarBancoVazio(objetos) {
  const tabelasOperacionais = objetos.tabelas.filter((nome) => nome !== "_prisma_migrations");

  if (tabelasOperacionais.length > 0 || objetos.enums.length > 0) {
    throw new Error("Banco do tenant cunhado nao esta vazio. Abortado sem apagar nada.");
  }
}

/**
 * Aplica a migration 0_baseline (gerada de `prisma/schema.prisma`, ver
 * docs/operacao/migrations.md) via `prisma migrate deploy` — nao le SQL bruto
 * na mao. Isso faz o Prisma gravar a linha correspondente em
 * "_prisma_migrations" no banco do tenant novo, entao ele nasce com o
 * historico de migrations em dia (nunca precisa de `migrate resolve
 * --applied`, que e so para bancos ja existentes antes da baseline).
 */
function aplicarBaseline(connectionString) {
  const resultado = executarComandoPrisma("migrate deploy", connectionString);

  if (!resultado.ok) {
    throw new Error(
      `\`prisma migrate deploy\` falhou ao aplicar a baseline no tenant cunhado:\n${resultado.stdout}\n${resultado.stderr}`
    );
  }
}

async function criarConfiguracaoInicial(prismaTenant) {
  const existente = await prismaTenant.configuracao.findFirst({
    select: { id: true },
    orderBy: { criadoEm: "asc" },
  });

  if (existente) {
    return { criada: false, idPresente: true };
  }

  const configuracao = await prismaTenant.configuracao.create({
    data: {},
    select: { id: true },
  });

  return { criada: true, idPresente: Boolean(configuracao.id) };
}

async function validarSchemaTenant(connectionString) {
  const prismaTenant = criarPrismaOperacional(connectionString);

  try {
    const [usuarios, configuracoes] = await Promise.all([
      prismaTenant.usuario.count(),
      prismaTenant.configuracao.count(),
    ]);

    return { usuarios, configuracoes };
  } finally {
    await prismaTenant.$disconnect();
  }
}

/**
 * Cargos padrao da empresa: cria os 5 (Fase 1D-1) se a empresa ainda nao
 * tiver nenhum, ou devolve o mapa dos ja existentes (upsert de empresa e
 * idempotente — reexecutar este script nao pode duplicar cargo). Sempre
 * dentro da MESMA transacao que cria/atualiza Empresa e Tenant.
 */
async function obterOuCriarCargosPadrao(tx, empresaId) {
  const existentes = await tx.cargo.findMany({
    where: { empresaId },
    select: { id: true, nome: true },
  });

  if (existentes.length > 0) {
    const mapa = {};
    for (const cargo of existentes) {
      mapa[cargo.nome] = cargo.id;
    }
    return mapa;
  }

  return criarCargosPadrao(empresaId, tx);
}

async function criarOuAtualizarUsuarioCentral(prismaCentral, empresaId, cargoAdministradorId) {
  const nome = process.env.CUNHADO_USUARIO_NOME?.trim();
  const email = process.env.CUNHADO_USUARIO_EMAIL?.trim().toLowerCase();

  if (!nome || !email) {
    return {
      tratado: false,
      motivo: "CUNHADO_USUARIO_NOME e CUNHADO_USUARIO_EMAIL nao definidos.",
    };
  }

  if (!cargoAdministradorId) {
    console.error(
      `[provisionar-tenant] ALERTA: cargo Administrador nao encontrado pra empresa ${empresaId} — usuario criado so com o RoleEmpresa legado (sem cargoId).`
    );
  }

  const senhaAleatoria = crypto.randomBytes(48).toString("hex");
  const senhaHash = await bcrypt.hash(senhaAleatoria, CUSTO_HASH_SENHA);

  const usuario = await prismaCentral.usuarioCentral.upsert({
    where: { email },
    update: {
      nome,
      ativo: false,
    },
    create: {
      nome,
      email,
      senha: senhaHash,
      ativo: false,
    },
    select: { id: true, ativo: true },
  });

  await prismaCentral.usuarioEmpresa.upsert({
    where: {
      usuarioId_empresaId: {
        usuarioId: usuario.id,
        empresaId,
      },
    },
    update: {
      role: "ADMIN",
      cargoId: cargoAdministradorId ?? null,
      ativo: true,
    },
    create: {
      usuarioId: usuario.id,
      empresaId,
      role: "ADMIN",
      cargoId: cargoAdministradorId ?? null,
      ativo: true,
    },
  });

  return {
    tratado: true,
    ativo: usuario.ativo,
    senhaConhecida: false,
    cargoAtribuido: Boolean(cargoAdministradorId),
  };
}

async function executar() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");

  if (dryRun === confirm) {
    throw new Error("Use exatamente um modo: --dry-run ou --confirm.");
  }

  const databaseUrl = obterEnvObrigatoria("DATABASE_URL");
  const centralDatabaseUrl = obterEnvObrigatoria("CENTRAL_DATABASE_URL");
  const tenantPrincipalDatabaseUrl = obterEnvObrigatoria("TENANT_PRINCIPAL_DATABASE_URL");
  const tenantCunhadoDatabaseUrl = obterEnvObrigatoria(CONNECTION_REF);

  validarBancoCunhadoDistinto(
    databaseUrl,
    centralDatabaseUrl,
    tenantPrincipalDatabaseUrl,
    tenantCunhadoDatabaseUrl
  );

  const versaoSchema = await obterUltimaMigracaoTenant();
  const objetosAntes = await listarObjetosPublicos(tenantCunhadoDatabaseUrl);
  validarBancoVazio(objetosAntes);

  if (dryRun) {
    console.log(JSON.stringify({
      modo: "dry-run",
      baseline: versaoSchema,
      connectionRef: CONNECTION_REF,
      bancosDistintos: true,
      bancoAlvoVazio: true,
      plano: [
        "criar ou atualizar Empresa central slug cunhado",
        "criar ou atualizar Tenant central slug cunhado em PROVISIONANDO",
        "criar os 5 cargos padrao (Fase 1D-1), se a empresa ainda nao tiver nenhum",
        "aplicar baseline operacional no banco vazio",
        "validar schema via Prisma operacional tenant",
        "criar Configuracao inicial com defaults do sistema",
        "ativar tenant com versaoSchema da baseline",
        "atribuir o cargo Administrador ao usuario central inicial",
      ],
      usuarioCentral: {
        seraCriado: Boolean(process.env.CUNHADO_USUARIO_NOME && process.env.CUNHADO_USUARIO_EMAIL),
        requerNomeEmailEnv: true,
        senhaConhecida: false,
        ativoNoLogin: false,
      },
      escrita: false,
    }, null, 2));
    return;
  }

  const prismaCentral = criarPrismaCentral(centralDatabaseUrl);
  let tenantId = null;

  try {
    // Empresa + Tenant + os 5 cargos padrao (Fase 1D-1) nascem juntos, na
    // mesma transacao central — nenhuma empresa fica sem cargo, nem por um
    // instante.
    const { empresa, tenant, mapaCargos } = await prismaCentral.$transaction(async (tx) => {
      const empresaCriada = await tx.empresa.upsert({
        where: { slug: EMPRESA_SLUG },
        update: {
          nome: process.env.CUNHADO_EMPRESA_NOME?.trim() || "Cliente Cunhado",
          status: "ATIVA",
        },
        create: {
          nome: process.env.CUNHADO_EMPRESA_NOME?.trim() || "Cliente Cunhado",
          slug: EMPRESA_SLUG,
          status: "ATIVA",
        },
        select: { id: true, slug: true, status: true },
      });

      const tenantCriado = await tx.tenant.upsert({
        where: { slug: TENANT_SLUG },
        update: {
          empresaId: empresaCriada.id,
          status: "PROVISIONANDO",
          versaoSchema: "provisionando",
          connectionRef: CONNECTION_REF,
        },
        create: {
          empresaId: empresaCriada.id,
          slug: TENANT_SLUG,
          status: "PROVISIONANDO",
          versaoSchema: "provisionando",
          connectionRef: CONNECTION_REF,
        },
        select: { id: true, slug: true },
      });

      const mapa = await obterOuCriarCargosPadrao(tx, empresaCriada.id);

      return { empresa: empresaCriada, tenant: tenantCriado, mapaCargos: mapa };
    });

    tenantId = tenant.id;

    aplicarBaseline(tenantCunhadoDatabaseUrl);

    const prismaTenant = criarPrismaOperacional(tenantCunhadoDatabaseUrl);
    let configuracaoInicial;

    try {
      configuracaoInicial = await criarConfiguracaoInicial(prismaTenant);
    } finally {
      await prismaTenant.$disconnect();
    }

    const schemaValidado = await validarSchemaTenant(tenantCunhadoDatabaseUrl);
    const usuarioCentral = await criarOuAtualizarUsuarioCentral(prismaCentral, empresa.id, mapaCargos.Administrador);

    const tenantAtivo = await prismaCentral.tenant.update({
      where: { id: tenant.id },
      data: {
        status: "ATIVO",
        versaoSchema,
        connectionRef: CONNECTION_REF,
      },
      select: {
        slug: true,
        status: true,
        versaoSchema: true,
        connectionRef: true,
      },
    });

    const objetosDepois = await listarObjetosPublicos(tenantCunhadoDatabaseUrl);

    console.log(JSON.stringify({
      modo: "confirm",
      baseline: versaoSchema,
      bancosDistintos: true,
      empresa: {
        slug: empresa.slug,
        status: empresa.status,
      },
      tenant: tenantAtivo,
      schemaTenant: {
        tabelas: objetosDepois.tabelas.length,
        enums: objetosDepois.enums.length,
        usuarios: schemaValidado.usuarios,
        configuracoes: schemaValidado.configuracoes,
      },
      configuracaoInicial,
      usuarioCentral,
    }, null, 2));
  } catch (erro) {
    if (tenantId) {
      await prismaCentral.tenant.update({
        where: { id: tenantId },
        data: { status: "ERRO" },
      }).catch(() => undefined);
    }

    throw erro;
  } finally {
    await prismaCentral.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao provisionar tenant cunhado.");
  process.exit(1);
});
