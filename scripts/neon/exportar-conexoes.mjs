// node scripts/neon/exportar-conexoes.mjs --ambiente teste|producao
//
// Pede a string de conexao ao proprio Neon, pelo branch correspondente ao
// ambiente, e exporta no $GITHUB_ENV. Roda so no runner do GitHub.
//
// Por que existe: as strings estavam sendo copiadas a mao do console do Neon
// para os segredos do repositorio. Isso significa procurar a string certa,
// lembrar de tirar o `-pooler`, e manter mais uma copia de credencial viva num
// lugar a mais. Tudo isso some aqui: o Neon ja sabe qual e a string do branch
// `ep-orange-recipe-aq2e102u`, e a chave de API ja esta cadastrada.
//
// A string NUNCA e impressa. Antes de ir para o $GITHUB_ENV ela e registrada
// com `::add-mask::`, entao mesmo um `echo` acidental em qualquer etapa
// seguinte sai mascarado no log.
//
// Sempre pede a conexao DIRETA (pooled=false): migration em conexao agrupada
// corre risco de travar no meio, e os scripts do projeto recusam `-pooler` de
// qualquer forma.

import { appendFileSync } from "node:fs";
import { ENDPOINTS_NEON, ambienteValido } from "../lib/endpoints-neon.mjs";

const API = "https://console.neon.tech/api/v2";

function erro(mensagem) {
  console.error(`[exportar-conexoes] ${mensagem}`);
  process.exit(1);
}

function lerArgumento(nome) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice < 0 ? null : process.argv[indice + 1] ?? null;
}

async function chamarNeon(caminho, { tolerarErro = false } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!resposta.ok) {
    if (tolerarErro) return null;
    const corpo = await resposta.text().catch(() => "");
    erro(`API do Neon respondeu ${resposta.status} em ${caminho}: ${corpo.slice(0, 300)}`);
  }

  return resposta.json();
}

/** Conta dentro de organizacao exige org_id; conta pessoal, nao. Serve as duas. */
async function listarProjetos() {
  const organizacoes = await chamarNeon("/users/me/organizations", { tolerarErro: true });
  const lista = organizacoes?.organizations ?? [];

  if (lista.length === 0) {
    const { projects } = await chamarNeon("/projects");
    return projects ?? [];
  }

  const projetos = [];
  for (const organizacao of lista) {
    const { projects } = await chamarNeon(`/projects?org_id=${encodeURIComponent(organizacao.id)}`);
    projetos.push(...(projects ?? []));
  }
  return projetos;
}

async function resolverConexao(idEndpoint) {
  for (const projeto of await listarProjetos()) {
    const { endpoints } = await chamarNeon(`/projects/${projeto.id}/endpoints`);
    const alvo = (endpoints ?? []).find((endpoint) => endpoint.id === idEndpoint);
    if (!alvo) continue;

    const { databases } = await chamarNeon(`/projects/${projeto.id}/branches/${alvo.branch_id}/databases`);
    const banco = (databases ?? [])[0];

    if (!banco?.name || !banco?.owner_name) {
      erro(`nenhum banco encontrado no branch do endpoint ${idEndpoint}.`);
    }

    const parametros = new URLSearchParams({
      branch_id: alvo.branch_id,
      database_name: banco.name,
      role_name: banco.owner_name,
      pooled: "false",
    });

    const resultado = await chamarNeon(`/projects/${projeto.id}/connection_uri?${parametros}`);
    const uri = resultado?.uri;

    if (typeof uri !== "string" || uri.length === 0) {
      erro(`a API nao devolveu string de conexao para ${idEndpoint}.`);
    }

    // Defesa final: se por qualquer motivo vier agrupada, nao exporta.
    if (new URL(uri).hostname.split(".")[0].endsWith("-pooler")) {
      erro(`a API devolveu conexao agrupada para ${idEndpoint}, e migration nao roda em -pooler.`);
    }

    return uri;
  }

  erro(
    `endpoint ${idEndpoint} nao encontrado em nenhum projeto desta chave. ` +
      `Confira se a NEON_API_KEY pertence a conta dona deste banco.`
  );
}

function exportar(nomeVariavel, valor) {
  // Registra antes de escrever: a partir daqui qualquer eco sai mascarado.
  console.log(`::add-mask::${valor}`);

  const destino = process.env.GITHUB_ENV;
  if (!destino) erro("GITHUB_ENV nao definido — este script roda dentro do GitHub Actions.");

  appendFileSync(destino, `${nomeVariavel}=${valor}\n`);
  console.log(`[exportar-conexoes] ${nomeVariavel} resolvida pelo Neon (valor mascarado).`);
}

async function principal() {
  if (!process.env.NEON_API_KEY) erro("NEON_API_KEY nao definida.");

  const ambiente = lerArgumento("ambiente");
  if (!ambiente || !ambienteValido(ambiente)) {
    erro("--ambiente precisa ser 'teste' ou 'producao'.");
  }

  const esperado = ENDPOINTS_NEON[ambiente];

  const conexaoTenant = await resolverConexao(esperado.tenant);
  const conexaoCentral = await resolverConexao(esperado.central);

  // DATABASE_URL e a conexao que o CLI do Prisma usa; TENANT_PRINCIPAL_* e a
  // que o runner resolve pelo connectionRef do central. Mesmo banco.
  exportar("DATABASE_URL", conexaoTenant);
  exportar("TENANT_PRINCIPAL_DATABASE_URL", conexaoTenant);
  exportar("CENTRAL_DATABASE_URL", conexaoCentral);

  console.log(`[exportar-conexoes] OK: conexoes do ambiente "${ambiente}" resolvidas pela API do Neon.`);
}

principal().catch((causa) => erro(causa instanceof Error ? causa.message : String(causa)));
