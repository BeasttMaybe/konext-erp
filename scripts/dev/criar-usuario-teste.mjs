// Cria (ou atualiza) um usuario de teste local: um UsuarioCentral + vinculo
// UsuarioEmpresa no banco central, e a linha correspondente em Usuario no
// banco do tenant da empresa informada — com o MESMO id nos dois bancos,
// para que a autoria (LogAuditoria.usuarioId) funcione sem gambiarra.
//
// So roda com AMBIENTE="teste" no .env, e so escreve se CONFIRMAR=SIM.
// Ferramenta de desenvolvimento local — nunca rode isto apontando para
// producao (Fase 1B-UI, Parte 2).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { CUSTO_HASH_SENHA } from "../../lib/auth/senha.ts";
import { mascararConnectionString, extrairHostMascarado } from "../lib/conexao-somente-leitura.mjs";
import { validarConnectionRefTenant } from "../lib/tenants-centrais.mjs";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

/**
 * Diferente do motivo em conexao-somente-leitura.mjs (sessao read-only e
 * pg_dump precisam de conexao direta): aqui o ponto e so consistencia com o
 * resto do ferramental — um endpoint "-pooler" nao tem por que ser usado
 * para as poucas escritas pontuais deste script.
 */
function recusarPooler(connectionString, rotulo) {
  if (String(connectionString).includes("-pooler")) {
    throw new Error(
      `${rotulo}: a URL aponta para um endpoint "-pooler". Use a conexao DIRETA (sem -pooler).`
    );
  }
}

const PAPEIS_VALIDOS = ["ADMIN", "GESTOR", "USUARIO"];

// Usuario.role do tenant (ADMIN/OPERADOR/TECNICO) nunca autoriza nada — e so
// um campo cosmetico legado. O mapeamento abaixo e so para nao deixar em
// branco; ver o comentario em types/tenant.ts sobre por que os dois
// vocabularios de papel nunca devem ser confundidos.
const MAPA_ROLE_TENANT = {
  ADMIN: "ADMIN",
  GESTOR: "OPERADOR",
  USUARIO: "TECNICO",
};

function lerArgumentos(argv) {
  const valores = {};
  for (let indice = 0; indice < argv.length; indice += 1) {
    const atual = argv[indice];
    if (atual.startsWith("--")) {
      const chave = atual.slice(2);
      valores[chave] = argv[indice + 1];
      indice += 1;
    }
  }
  return valores;
}

function validarSenha(senha) {
  if (senha.length < 8) {
    throw new Error("A senha (--senha) deve ter no minimo 8 caracteres.");
  }
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    throw new Error("A senha (--senha) deve conter letras e numeros.");
  }
}

function exigirAmbienteTeste() {
  if (process.env.AMBIENTE === "teste") {
    return;
  }

  console.error("");
  console.error('[erro] Este script so roda com AMBIENTE="teste" definido no seu .env.');
  console.error(`[erro] AMBIENTE atual: ${JSON.stringify(process.env.AMBIENTE ?? null)}`);
  console.error("[erro] Isso existe para nunca criar um usuario de teste sem querer em producao.");
  console.error("");
  process.exit(1);
}

function imprimirUso() {
  console.log("Uso:");
  console.log(
    '  node scripts/dev/criar-usuario-teste.mjs --email <email> --senha "<senha>" --papel <ADMIN|GESTOR|USUARIO> --empresa <slug>'
  );
  console.log("");
  console.log("Exemplo:");
  console.log(
    '  CONFIRMAR=SIM node scripts/dev/criar-usuario-teste.mjs --email usuario.teste@konext.local --senha "Teste1234" --papel USUARIO --empresa konext-principal'
  );
}

async function main() {
  exigirAmbienteTeste();

  const args = lerArgumentos(process.argv.slice(2));
  const email = String(args.email ?? "").trim().toLowerCase();
  const senha = String(args.senha ?? "");
  const papel = String(args.papel ?? "").trim().toUpperCase();
  const empresaSlug = String(args.empresa ?? "").trim();

  if (!email || !email.includes("@")) {
    imprimirUso();
    throw new Error("Informe um --email valido.");
  }
  if (!senha) {
    imprimirUso();
    throw new Error("Informe --senha.");
  }
  validarSenha(senha);
  if (!PAPEIS_VALIDOS.includes(papel)) {
    imprimirUso();
    throw new Error(`--papel deve ser um de: ${PAPEIS_VALIDOS.join(", ")}.`);
  }
  if (!empresaSlug) {
    imprimirUso();
    throw new Error("Informe --empresa <slug>.");
  }

  const centralDatabaseUrl = process.env.CENTRAL_DATABASE_URL;
  if (!centralDatabaseUrl || !centralDatabaseUrl.trim()) {
    throw new Error("CENTRAL_DATABASE_URL nao definida no seu .env.");
  }
  recusarPooler(centralDatabaseUrl, "CENTRAL_DATABASE_URL");

  console.log("");
  console.log("Criar usuario de teste");
  console.log(`  Banco central : ${mascararConnectionString(centralDatabaseUrl)}`);
  console.log(`  Host central  : ${extrairHostMascarado(centralDatabaseUrl)}`);
  console.log(`  E-mail        : ${email}`);
  console.log(`  Papel         : ${papel}`);
  console.log(`  Empresa       : ${empresaSlug}`);
  console.log("  Senha         : (nao exibida)");
  console.log("");

  if (process.env.CONFIRMAR !== "SIM") {
    console.log("Nada foi alterado. Para confirmar, rode de novo com CONFIRMAR=SIM.");
    console.log("");
    imprimirUso();
    return;
  }

  const prismaCentral = new PrismaCentral({
    adapter: new PrismaNeon({ connectionString: centralDatabaseUrl }),
    log: ["error"],
  });

  try {
    const empresa = await prismaCentral.empresa.findUnique({
      where: { slug: empresaSlug },
      select: { id: true, slug: true, status: true },
    });

    if (!empresa) {
      throw new Error(`Empresa com slug "${empresaSlug}" nao encontrada no banco central.`);
    }
    if (empresa.status !== "ATIVA") {
      throw new Error(`Empresa "${empresaSlug}" existe, mas nao esta ATIVA (status atual: ${empresa.status}).`);
    }

    const tenant = await prismaCentral.tenant.findFirst({
      where: { empresaId: empresa.id, status: "ATIVO" },
      select: { id: true, slug: true, connectionRef: true },
    });

    if (!tenant) {
      throw new Error(`Nenhum tenant ATIVO encontrado para a empresa "${empresaSlug}".`);
    }

    const connectionRef = validarConnectionRefTenant(tenant.connectionRef);
    const tenantDatabaseUrl = process.env[connectionRef];

    if (!tenantDatabaseUrl || !tenantDatabaseUrl.trim()) {
      throw new Error(`Variavel de ambiente ${connectionRef} nao definida no seu .env.`);
    }
    recusarPooler(tenantDatabaseUrl, connectionRef);

    const senhaHash = await bcrypt.hash(senha, CUSTO_HASH_SENHA);
    const nomeExibicao = `Teste ${papel}`;

    const usuarioCentral = await prismaCentral.usuarioCentral.upsert({
      where: { email },
      update: { senha: senhaHash, ativo: true },
      create: { nome: nomeExibicao, email, senha: senhaHash, ativo: true },
      select: { id: true },
    });

    await prismaCentral.usuarioEmpresa.upsert({
      where: {
        usuarioId_empresaId: {
          usuarioId: usuarioCentral.id,
          empresaId: empresa.id,
        },
      },
      update: { role: papel, ativo: true },
      create: {
        usuarioId: usuarioCentral.id,
        empresaId: empresa.id,
        role: papel,
        ativo: true,
      },
    });

    const prismaTenant = new PrismaOperacional({
      adapter: new PrismaNeon({ connectionString: tenantDatabaseUrl }),
      log: ["error"],
    });

    try {
      // Usuario.email tambem e @unique no tenant: se ja existir uma linha com
      // este e-mail mas outro id (ex.: sobra de uma execucao anterior com um
      // UsuarioCentral diferente), o upsert por id bateria de frente com essa
      // constraint. Detectamos isso antes, com uma mensagem clara.
      const usuarioTenantExistentePorEmail = await prismaTenant.usuario.findUnique({
        where: { email },
        select: { id: true },
      });

      if (usuarioTenantExistentePorEmail && usuarioTenantExistentePorEmail.id !== usuarioCentral.id) {
        throw new Error(
          `Ja existe um Usuario neste tenant com o e-mail "${email}", mas com id diferente do ` +
            `UsuarioCentral (${usuarioTenantExistentePorEmail.id} != ${usuarioCentral.id}). ` +
            "Apague essa linha manualmente (so em banco de teste) e rode de novo."
        );
      }

      await prismaTenant.usuario.upsert({
        where: { id: usuarioCentral.id },
        update: {
          nome: nomeExibicao,
          email,
          senha: senhaHash,
          role: MAPA_ROLE_TENANT[papel],
        },
        create: {
          id: usuarioCentral.id,
          nome: nomeExibicao,
          email,
          senha: senhaHash,
          role: MAPA_ROLE_TENANT[papel],
        },
      });
    } finally {
      await prismaTenant.$disconnect();
    }

    console.log("Usuario de teste criado/atualizado com sucesso.");
    console.log(`  id (central e tenant): ${usuarioCentral.id}`);
    console.log(`  E-mail                : ${email}`);
    console.log(`  Papel (empresa)       : ${papel}`);
    console.log(`  Empresa / tenant      : ${empresaSlug} / ${tenant.slug}`);
    console.log("");
    console.log("Use este e-mail e a senha informada para logar em /login.");
  } finally {
    await prismaCentral.$disconnect();
  }
}

main().catch((erro) => {
  console.error("");
  console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
