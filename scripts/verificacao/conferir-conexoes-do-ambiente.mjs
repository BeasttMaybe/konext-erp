// node scripts/verificacao/conferir-conexoes-do-ambiente.mjs --ambiente teste|producao
//
// Confere que TODAS as conexoes do ambiente apontam para o ambiente pedido,
// antes de qualquer comando de banco.
//
// Por que existe: o workflow escolhia o segredo com o atalho
// `ambiente == 'producao' && secrets.PROD_X || secrets.TESTE_X`. Em expressao
// do GitHub, string vazia e falsa — entao um segredo PROD_ ausente nao falha:
// cai calado no valor de TESTE. Foi o que aconteceu num dry-run de producao,
// que leu o banco de TESTE e reportou "sem mudancas pendentes" como se fosse
// producao. Num `--aplicar`, o mesmo silencio migraria o banco errado.
//
// `verificar-ambiente.mjs` existe e cobre ambiente misto, mas classifica
// comparando com arquivos .env do disco, que nao existem no runner. Esta
// checagem compara com os endpoints documentados em AGENTS.md — nomes de host,
// nunca credenciais —, entao funciona em qualquer lugar.

import { ENDPOINTS_NEON as ENDPOINTS, ambienteOposto, ambienteValido } from "../lib/endpoints-neon.mjs";

const VARIAVEIS_TENANT = ["DATABASE_URL", "TENANT_PRINCIPAL_DATABASE_URL", "TENANT_CUNHADO_DATABASE_URL"];
const VARIAVEIS_CENTRAL = ["CENTRAL_DATABASE_URL"];

function lerArgumento(nome) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice < 0 ? null : process.argv[indice + 1] ?? null;
}

function extrairEndpoint(connectionString) {
  try {
    return new URL(connectionString).hostname.split(".")[0];
  } catch {
    return null;
  }
}

const problemas = [];
const avisos = [];

function conferir(nomeVariavel, esperado, oposto, obrigatoria) {
  const valor = process.env[nomeVariavel];

  if (!valor) {
    if (obrigatoria) {
      problemas.push(`${nomeVariavel} esta ausente ou vazia.`);
    } else {
      avisos.push(`${nomeVariavel} ausente — o tenant correspondente sera pulado.`);
    }
    return;
  }

  const endpoint = extrairEndpoint(valor);

  if (endpoint === null) {
    problemas.push(`${nomeVariavel} nao e uma connection string valida.`);
    return;
  }

  if (endpoint.endsWith("-pooler")) {
    problemas.push(`${nomeVariavel} usa conexao agrupada (${endpoint}). Use a conexao direta, sem -pooler.`);
    return;
  }

  if (endpoint === oposto) {
    problemas.push(
      `${nomeVariavel} aponta para ${endpoint}, que e o endpoint do OUTRO ambiente. ` +
        `Esperado para este comando: ${esperado}.`
    );
    return;
  }

  if (endpoint !== esperado) {
    // Tenant de cliente tem endpoint proprio, que nao esta na tabela acima.
    // Desconhecido nao e erro; desconhecido sem aviso, sim.
    avisos.push(`${nomeVariavel} usa o endpoint ${endpoint}, que nao e um dos documentados em AGENTS.md.`);
  }
}

const ambiente = lerArgumento("ambiente");

if (!ambiente || !ambienteValido(ambiente)) {
  console.error("[conferir-conexoes] --ambiente precisa ser 'teste' ou 'producao'.");
  process.exit(1);
}

const esperado = ENDPOINTS[ambiente];
const oposto = ENDPOINTS[ambienteOposto(ambiente)];

for (const nome of VARIAVEIS_CENTRAL) {
  conferir(nome, esperado.central, oposto.central, true);
}

for (const nome of VARIAVEIS_TENANT) {
  // DATABASE_URL e o principal sao obrigatorios; o do cunhado e opcional.
  conferir(nome, esperado.tenant, oposto.tenant, nome !== "TENANT_CUNHADO_DATABASE_URL");
}

for (const aviso of avisos) {
  console.log(`[conferir-conexoes] aviso: ${aviso}`);
}

if (problemas.length > 0) {
  console.error(`\n[conferir-conexoes] ${problemas.length} problema(s) no ambiente "${ambiente}":`);
  for (const problema of problemas) console.error(`  - ${problema}`);
  console.error("\nNenhum comando de banco deve rodar com as conexoes nesse estado.");
  process.exit(1);
}

console.log(`[conferir-conexoes] OK: todas as conexoes conferem com o ambiente "${ambiente}".`);
