import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";

const VARIAVEIS_CONEXAO = [
  "DATABASE_URL",
  "CENTRAL_DATABASE_URL",
  "TENANT_PRINCIPAL_DATABASE_URL",
  "TENANT_CUNHADO_DATABASE_URL",
];

// Variaveis que compartilham a identidade do tenant "principal" e do CLI Prisma.
// CENTRAL_DATABASE_URL fica de fora de propósito: nunca deve trocar com o ambiente.
const VARIAVEIS_TENANT = [
  "DATABASE_URL",
  "TENANT_PRINCIPAL_DATABASE_URL",
  "TENANT_CUNHADO_DATABASE_URL",
];

function extrairHost(connectionString) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return null;
  }
}

function mascarar(connectionString) {
  try {
    const url = new URL(connectionString);
    return `postgresql://${url.username}:***@${url.hostname}${url.pathname}`;
  } catch {
    return "postgresql://***";
  }
}

function lerHostDeArquivoEnv(caminho, nomeVariavel) {
  if (!existsSync(caminho)) return null;

  try {
    const conteudo = readFileSync(caminho, "utf8");
    const match = conteudo.match(new RegExp(`^${nomeVariavel}\\s*=\\s*"?([^"\\n]+)"?\\s*$`, "m"));
    return match ? extrairHost(match[1]) : null;
  } catch {
    return null;
  }
}

function executar() {
  const ambiente = String(process.env.AMBIENTE ?? "").trim().toLowerCase();

  if (ambiente !== "teste" && ambiente !== "producao") {
    console.error(
      'AMBIENTE nao definida ou invalida no .env ativo. Defina AMBIENTE="teste" ou AMBIENTE="producao".'
    );
    process.exit(1);
  }

  const ambienteLabel = ambiente.toUpperCase();
  const cienteDoMisto = process.env.AMBIENTE_MISTO_CIENTE === "1";

  const valores = {};
  const hosts = {};
  for (const nome of VARIAVEIS_CONEXAO) {
    valores[nome] = process.env[nome] || null;
    hosts[nome] = valores[nome] ? extrairHost(valores[nome]) : null;
  }

  const hostDatabaseUrl = hosts.DATABASE_URL;

  console.log(`AMBIENTE declarado: ${ambienteLabel}\n`);
  console.log("Mapeamento de conexoes (.env ativo):");

  const classificacoes = {};

  for (const nome of VARIAVEIS_CONEXAO) {
    const valor = valores[nome];

    if (!valor) {
      classificacoes[nome] = "AUSENTE";
      console.log(`  ${nome} -> AUSENTE`);
      continue;
    }

    const host = hosts[nome];
    // Mesmo host de DATABASE_URL -> segue o AMBIENTE declarado.
    // Host diferente -> tratado como PRODUCAO fixa (CENTRAL e CUNHADO nunca acompanham o teste).
    const classificacao = host && hostDatabaseUrl && host === hostDatabaseUrl ? ambienteLabel : "PRODUCAO";
    classificacoes[nome] = classificacao;
    console.log(`  ${nome} -> ${host ?? "host invalido"} [${classificacao}] (${mascarar(valor)})`);
  }

  // Checagem critica e NUNCA silenciavel: AMBIENTE=producao mas a conexao ativa bate
  // com o host conhecido do .env.teste. Indica .env de teste copiado por engano.
  if (ambiente === "producao") {
    const hostTesteConhecido = lerHostDeArquivoEnv(".env.teste", "DATABASE_URL");

    if (hostTesteConhecido && hostDatabaseUrl && hostTesteConhecido === hostDatabaseUrl) {
      console.error(
        "\nERRO CRITICO: AMBIENTE esta declarado como PRODUCAO, mas DATABASE_URL aponta para o mesmo " +
        "host registrado em .env.teste. O .env de teste foi copiado por engano. Restaure com " +
        "copy /Y .env.producao .env. Esta checagem NAO pode ser silenciada por AMBIENTE_MISTO_CIENTE."
      );
      process.exit(1);
    }
  }

  const classificacoesTenant = VARIAVEIS_TENANT.map((nome) => classificacoes[nome]);
  const tenantsEmProducao = VARIAVEIS_TENANT.filter((nome) => classificacoes[nome] === "PRODUCAO");
  const misto = new Set(classificacoesTenant.filter((c) => c !== "AUSENTE")).size > 1;

  if (misto) {
    if (!cienteDoMisto) {
      console.error(
        `\nAMBIENTE MISTO: AMBIENTE declarado e ${ambienteLabel}, mas continuam em PRODUCAO: ` +
        `${tenantsEmProducao.join(", ")}. Se isso e intencional, defina AMBIENTE_MISTO_CIENTE=1 no ` +
        ".env para confirmar que voce sabe disso e prosseguir."
      );
      process.exit(1);
    }

    console.warn(
      `\nAVISO: ambiente misto reconhecido (AMBIENTE_MISTO_CIENTE=1). Continuam em PRODUCAO: ` +
      `${tenantsEmProducao.join(", ")}. Nao teste como esses tenants.`
    );
    process.exit(0);
  }

  console.log(`\nAmbiente consistente: tudo em ${ambienteLabel}.`);
  process.exit(0);
}

executar();
