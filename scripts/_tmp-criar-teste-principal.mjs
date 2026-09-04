import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const NOME = "Conta Teste Principal";
const EMAIL = "teste.principal@konext.test";
const EMPRESA_SLUG = "konext-principal";
const TENANT_SLUG = "principal";
const CONNECTION_REF = "TENANT_PRINCIPAL_DATABASE_URL";

function obterEnvObrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} nao definida.`);
  return valor;
}

function criarPrismaCentral(connectionString) {
  return new PrismaCentral({
    adapter: new PrismaNeon({ connectionString }),
    log: ["error"],
  });
}

async function carregarEmpresaTenant(prismaCentral) {
  const empresa = await prismaCentral.empresa.findUnique({
    where: { slug: EMPRESA_SLUG },
    select: { id: true, slug: true, status: true },
  });

  if (!empresa || empresa.status !== "ATIVA") {
    throw new Error("Empresa konext-principal nao encontrada ou nao esta ATIVA.");
  }

  const tenants = await prismaCentral.tenant.findMany({
    where: { empresaId: empresa.id, slug: TENANT_SLUG, status: "ATIVO" },
    select: { id: true, slug: true, status: true, connectionRef: true, versaoSchema: true },
  });

  if (tenants.length !== 1) {
    throw new Error("Tenant principal ATIVO nao encontrado de forma unica.");
  }

  const tenant = tenants[0];
  if (tenant.connectionRef !== CONNECTION_REF) {
    throw new Error("Tenant principal com connectionRef inesperada.");
  }

  return { empresa, tenant };
}

async function executar() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");
  if (dryRun === confirm) throw new Error("Use exatamente um modo: --dry-run ou --confirm.");

  const centralDatabaseUrl = obterEnvObrigatoria("CENTRAL_DATABASE_URL");
  const senhaTemporaria = obterEnvObrigatoria("TESTE_PRINCIPAL_SENHA_TEMPORARIA");
  if (senhaTemporaria.trim().length < 8) {
    throw new Error("TESTE_PRINCIPAL_SENHA_TEMPORARIA deve ter pelo menos 8 caracteres.");
  }

  const prismaCentral = criarPrismaCentral(centralDatabaseUrl);

  try {
    const { empresa, tenant } = await carregarEmpresaTenant(prismaCentral);

    if (dryRun) {
      const usuarioExistente = await prismaCentral.usuarioCentral.findUnique({
        where: { email: EMAIL },
        select: { id: true, ativo: true },
      });
      console.log(JSON.stringify({
        modo: "dry-run",
        usuario: { nome: NOME, email: EMAIL, existe: Boolean(usuarioExistente) },
        empresa: { slug: empresa.slug, status: empresa.status },
        tenant: { slug: tenant.slug, status: tenant.status, connectionRef: tenant.connectionRef },
        escrita: false,
      }, null, 2));
      return;
    }

    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    const usuario = await prismaCentral.usuarioCentral.upsert({
      where: { email: EMAIL },
      update: { nome: NOME, senha: senhaHash, ativo: true },
      create: { nome: NOME, email: EMAIL, senha: senhaHash, ativo: true },
      select: { id: true, nome: true, email: true, ativo: true },
    });

    const vinculo = await prismaCentral.usuarioEmpresa.upsert({
      where: { usuarioId_empresaId: { usuarioId: usuario.id, empresaId: empresa.id } },
      update: { role: "ADMIN", ativo: true },
      create: { usuarioId: usuario.id, empresaId: empresa.id, role: "ADMIN", ativo: true },
      select: { role: true, ativo: true },
    });

    console.log(JSON.stringify({
      modo: "confirm",
      usuario: { nome: usuario.nome, email: usuario.email, ativo: usuario.ativo },
      empresa: { slug: empresa.slug, status: empresa.status },
      tenant: { slug: tenant.slug, status: tenant.status, connectionRef: tenant.connectionRef },
      vinculo: { role: vinculo.role, ativo: vinculo.ativo },
    }, null, 2));
  } finally {
    await prismaCentral.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao criar conta de teste.");
  process.exit(1);
});
