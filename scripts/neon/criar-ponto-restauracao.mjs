// node scripts/neon/criar-ponto-restauracao.mjs --prefixo antes-marcas
//
// Cria, via API do Neon, um branch de restauracao para CADA banco que a
// migracao vai tocar (o tenant e o central), e imprime os nomes criados. O
// ultimo valor impresso em PONTO_RESTAURACAO=... e o rotulo que o runner
// repassa ao runner de migracao.
//
// Por que existe: a regra do projeto e que nenhuma escrita acontece sem um
// ponto de restauracao recem-criado. Ate agora esse branch era criado a mao no
// console do Neon antes de cada migracao — o que, na pratica, significava que
// toda migracao dependia de alguem estar disponivel. Este script mantem a
// regra e tira a dependencia: o branch continua existindo antes da escrita,
// so que criado automaticamente e conferido logo em seguida.
//
// Roda SO no runner do GitHub: o ambiente onde o Claude trabalha nao alcanca
// api.neon.tech (403 no proxy), entao nao ha como executar isto de la.

const API = "https://console.neon.tech/api/v2";

function erro(mensagem) {
  console.error(`[ponto-restauracao] ${mensagem}`);
  process.exit(1);
}

function lerArgumento(nome, padrao = null) {
  const indice = process.argv.indexOf(`--${nome}`);
  if (indice < 0) return padrao;
  return process.argv[indice + 1] ?? padrao;
}

async function chamarNeon(caminho, opcoes = {}) {
  const { tolerarErro: _ignorado, ...opcoesDeRede } = opcoes;

  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoesDeRede,
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opcoes.headers ?? {}),
    },
  });

  if (!resposta.ok) {
    // `tolerarErro` serve so pra sondagem (descobrir se a conta tem
    // organizacoes). Qualquer outra falha continua sendo fatal: criar ponto de
    // restauracao "mais ou menos" nao protege nada.
    if (opcoes.tolerarErro) return null;

    const corpo = await resposta.text().catch(() => "");
    // Nunca ecoa a chave; o corpo da Neon nao a contem.
    erro(`API do Neon respondeu ${resposta.status} em ${caminho}: ${corpo.slice(0, 400)}`);
  }

  return resposta.json();
}

/** `ep-purple-field-aq2o0ful.c-8.us-east-1.aws.neon.tech` -> `ep-purple-field-aq2o0ful` */
function extrairIdDoEndpoint(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    const primeiro = host.split(".")[0];
    // Defesa contra conexao agrupada chegando aqui por engano: o branch de
    // restauracao seria criado do endpoint certo, mas a migracao em si
    // recusaria depois — melhor falhar agora, com mensagem clara.
    if (primeiro.endsWith("-pooler")) {
      erro(`connection string usa endpoint agrupado (${primeiro}). Use a conexao direta, sem -pooler.`);
    }
    return primeiro;
  } catch {
    return null;
  }
}

/**
 * Lista os projetos visiveis para a chave.
 *
 * Conta dentro de organizacao: `GET /projects` responde 400 pedindo `org_id`.
 * Conta pessoal: `GET /projects` funciona direto. Aqui tentamos primeiro pelas
 * organizacoes e so caimos no caminho direto quando nao ha nenhuma — assim o
 * script serve aos dois formatos sem configuracao.
 */
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

async function localizarEndpoint(idEndpoint) {
  const projects = await listarProjetos();

  for (const projeto of projects ?? []) {
    const { endpoints } = await chamarNeon(`/projects/${projeto.id}/endpoints`);
    const alvo = (endpoints ?? []).find((endpoint) => endpoint.id === idEndpoint);

    if (alvo) {
      return { projetoId: projeto.id, projetoNome: projeto.name, branchId: alvo.branch_id };
    }
  }

  return null;
}

async function criarBranchDeRestauracao(idEndpoint, prefixo, carimbo) {
  const local = await localizarEndpoint(idEndpoint);

  if (!local) {
    erro(
      `endpoint ${idEndpoint} nao encontrado em nenhum projeto desta chave. ` +
        `Confira se a NEON_API_KEY pertence a conta dona deste banco.`
    );
  }

  const nome = `${prefixo}-${idEndpoint}-${carimbo}`;

  const criado = await chamarNeon(`/projects/${local.projetoId}/branches`, {
    method: "POST",
    body: JSON.stringify({ branch: { parent_id: local.branchId, name: nome } }),
  });

  const branchCriado = criado?.branch;
  if (!branchCriado?.id) {
    erro(`a API aceitou a criacao mas nao devolveu o branch para ${idEndpoint}.`);
  }

  // Confere lendo de volta: "criei" sem conferir e exatamente o tipo de
  // garantia que nao garante nada.
  const confirmacao = await chamarNeon(`/projects/${local.projetoId}/branches/${branchCriado.id}`);
  if (confirmacao?.branch?.id !== branchCriado.id) {
    erro(`branch ${nome} nao pode ser confirmado apos a criacao.`);
  }

  console.log(`[ponto-restauracao] criado e confirmado: ${nome} (projeto ${local.projetoNome})`);
  return nome;
}

async function principal() {
  if (!process.env.NEON_API_KEY) {
    erro("NEON_API_KEY nao definida. Cadastre como secret do repositorio.");
  }

  const prefixo = lerArgumento("prefixo", "antes-migracao");
  const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

  // Cada banco que a migracao toca precisa do seu proprio ponto: o runner
  // escreve no tenant e tambem no central (Tenant.versaoSchema).
  const variaveis = ["DATABASE_URL", "CENTRAL_DATABASE_URL", "TENANT_PRINCIPAL_DATABASE_URL", "TENANT_CUNHADO_DATABASE_URL"];

  const endpoints = new Set();
  for (const variavel of variaveis) {
    const valor = process.env[variavel];
    if (!valor) continue;
    const id = extrairIdDoEndpoint(valor);
    if (id) endpoints.add(id);
  }

  if (endpoints.size === 0) {
    erro("nenhuma connection string valida encontrada no ambiente.");
  }

  const nomes = [];
  for (const idEndpoint of endpoints) {
    nomes.push(await criarBranchDeRestauracao(idEndpoint, prefixo, carimbo));
  }

  // Rotulo unico gravado no relatorio da migracao.
  const rotulo = `${prefixo}-${carimbo}`;
  console.log(`PONTO_RESTAURACAO=${rotulo}`);
  console.log(`[ponto-restauracao] ${nomes.length} branch(es) de restauracao criado(s): ${nomes.join(", ")}`);
}

principal().catch((causa) => erro(causa instanceof Error ? causa.message : String(causa)));
