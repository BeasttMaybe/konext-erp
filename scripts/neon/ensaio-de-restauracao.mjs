// node scripts/neon/ensaio-de-restauracao.mjs --ambiente teste [--horas-atras 1]
//
// ENSAIO DE RESTAURACAO: prova que da para voltar o banco no tempo, em vez de
// so acreditar. Um backup que nunca foi restaurado e uma esperanca.
//
// Para o tenant e para o central do ambiente:
//   1. cria um branch TEMPORARIO a partir do banco de verdade, no instante de
//      N horas atras (historico do Neon — o mesmo mecanismo dos pontos de
//      restauracao que as migrations criam);
//   2. conecta nele SOMENTE-LEITURA e no banco atual, tambem somente-leitura;
//   3. compara: as mesmas tabelas existem, cada uma com quantas linhas, e
//      quantas migrations constam aplicadas;
//   4. APAGA o branch temporario, mesmo se algo falhar no meio.
//
// Nao escreve nada no banco de verdade. Ha diferenca de linhas esperada (o que
// entrou nas ultimas N horas); o que reprova o ensaio e o branch nao abrir,
// faltar tabela, ou uma tabela restaurada vir vazia quando hoje tem dados de
// antes.
import { abrirConexaoSomenteLeitura } from "../lib/conexao-somente-leitura.mjs";
import { ENDPOINTS_NEON, ambienteValido } from "../lib/endpoints-neon.mjs";

const API = "https://console.neon.tech/api/v2";

function erro(mensagem) {
  console.error(`[ensaio] ${mensagem}`);
  process.exit(1);
}

function lerArgumento(nome, padrao = null) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice < 0 ? padrao : (process.argv[indice + 1] ?? padrao);
}

async function chamarNeon(caminho, opcoes = {}) {
  const { tolerarErro, ...rede } = opcoes;
  const resposta = await fetch(`${API}${caminho}`, {
    ...rede,
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  if (!resposta.ok) {
    if (tolerarErro) return null;
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`API do Neon respondeu ${resposta.status} em ${caminho}: ${corpo.slice(0, 300)}`);
  }
  return resposta.status === 204 ? null : resposta.json();
}

async function listarProjetos() {
  const organizacoes = await chamarNeon("/users/me/organizations", { tolerarErro: true });
  const lista = organizacoes?.organizations ?? [];
  if (lista.length === 0) return (await chamarNeon("/projects")).projects ?? [];
  const projetos = [];
  for (const organizacao of lista) {
    projetos.push(...((await chamarNeon(`/projects?org_id=${encodeURIComponent(organizacao.id)}`)).projects ?? []));
  }
  return projetos;
}

async function localizar(idEndpoint) {
  for (const projeto of await listarProjetos()) {
    const { endpoints } = await chamarNeon(`/projects/${projeto.id}/endpoints`);
    const alvo = (endpoints ?? []).find((e) => e.id === idEndpoint);
    if (alvo) return { projetoId: projeto.id, branchId: alvo.branch_id };
  }
  throw new Error(`endpoint ${idEndpoint} nao encontrado nesta conta do Neon.`);
}

async function conexaoDoBranch(projetoId, branchId) {
  const { databases } = await chamarNeon(`/projects/${projetoId}/branches/${branchId}/databases`);
  const banco = (databases ?? [])[0];
  if (!banco) throw new Error(`branch ${branchId} sem banco.`);
  const parametros = new URLSearchParams({ branch_id: branchId, database_name: banco.name, role_name: banco.owner_name, pooled: "false" });
  const { uri } = await chamarNeon(`/projects/${projetoId}/connection_uri?${parametros}`);
  return uri;
}

async function esperarPronto(projetoId, branchId) {
  for (let i = 0; i < 40; i++) {
    const { branch } = await chamarNeon(`/projects/${projetoId}/branches/${branchId}`);
    if (branch?.current_state === "ready") return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("branch temporario nao ficou pronto em 2 minutos.");
}

/**
 * Cota de branches cheia: apaga o ponto de restauracao AUTOMATICO mais antigo
 * (mesmo formato que scripts/neon/criar-ponto-restauracao.mjs cria e ja poda),
 * desde que reste ao menos um. Branch criado a mao nunca e tocado.
 */
const PADRAO_AUTOMATICO = /^antes-(teste|producao)-ep-[a-z0-9-]+-\d{12,14}$/;

async function abrirEspaco(projetoId) {
  const { branches } = await chamarNeon(`/projects/${projetoId}/branches`);
  const automaticos = (branches ?? [])
    .filter((b) => PADRAO_AUTOMATICO.test(b.name) && !b.default && !b.primary)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (automaticos.length < 2) throw new Error("cota de branches cheia e nao ha ponto automatico antigo para liberar.");
  const velho = automaticos[0];
  await chamarNeon(`/projects/${projetoId}/branches/${velho.id}`, { method: "DELETE" });
  console.log(`[ensaio] cota cheia: apagado o ponto automatico mais antigo (${velho.name}); restam ${automaticos.length - 1}.`);
}

async function retratoDoBanco(uri, rotulo) {
  const cliente = await abrirConexaoSomenteLeitura(uri, rotulo);
  try {
    const { rows: tabelas } = await cliente.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const contagens = {};
    for (const { tablename } of tabelas) {
      const { rows } = await cliente.query(`SELECT count(*)::int AS n FROM "${tablename.replace(/"/g, '""')}"`);
      contagens[tablename] = rows[0].n;
    }
    const migracoes = tabelas.some((t) => t.tablename === "_prisma_migrations")
      ? (await cliente.query(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).rows[0].n
      : null;
    return { contagens, migracoes };
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function ensaiar(nome, idEndpoint, horasAtras, carimbo) {
  const local = await localizar(idEndpoint);
  const instante = new Date(Date.now() - horasAtras * 3600 * 1000).toISOString();
  const nomeDoBranch = `ensaio-restauracao-${idEndpoint}-${carimbo}`;
  console.log(`[ensaio] ${nome}: criando ${nomeDoBranch} a partir de ${instante}`);

  const corpo = JSON.stringify({
    branch: { parent_id: local.branchId, parent_timestamp: instante, name: nomeDoBranch },
    endpoints: [{ type: "read_write" }],
  });
  let criado;
  try {
    criado = await chamarNeon(`/projects/${local.projetoId}/branches`, { method: "POST", body: corpo });
  } catch (falha) {
    if (!String(falha?.message).includes("BRANCHES_LIMIT_EXCEEDED")) throw falha;
    await abrirEspaco(local.projetoId);
    criado = await chamarNeon(`/projects/${local.projetoId}/branches`, { method: "POST", body: corpo });
  }
  const branchId = criado?.branch?.id;
  if (!branchId) throw new Error("a API nao devolveu o branch temporario.");

  try {
    await esperarPronto(local.projetoId, branchId);
    const [restaurado, atual] = await Promise.all([
      retratoDoBanco(await conexaoDoBranch(local.projetoId, branchId), `${nome} restaurado`),
      retratoDoBanco(await conexaoDoBranch(local.projetoId, local.branchId), `${nome} atual`),
    ]);

    const problemas = [];
    const tabelasAtuais = Object.keys(atual.contagens);
    for (const tabela of tabelasAtuais) {
      if (!(tabela in restaurado.contagens)) {
        problemas.push(`tabela ${tabela} nao existe no restaurado (pode ter sido criada nas ultimas ${horasAtras}h)`);
      }
    }
    let total = { restaurado: 0, atual: 0 };
    for (const tabela of tabelasAtuais) {
      const a = atual.contagens[tabela];
      const r = restaurado.contagens[tabela] ?? 0;
      total = { restaurado: total.restaurado + r, atual: total.atual + a };
      if (r !== a) console.log(`[ensaio]   ${tabela}: restaurado ${r} · atual ${a}`);
    }
    const tabelasVazias = tabelasAtuais.filter((t) => atual.contagens[t] > 50 && (restaurado.contagens[t] ?? 0) === 0);
    for (const tabela of tabelasVazias) problemas.push(`tabela ${tabela} veio VAZIA no restaurado (hoje tem ${atual.contagens[tabela]})`);

    console.log(
      `[ensaio] ${nome}: ${tabelasAtuais.length} tabelas · ${total.restaurado} linhas restauradas (hoje ${total.atual}) · ` +
        `migrations aplicadas: restaurado ${restaurado.migracoes ?? "-"} · atual ${atual.migracoes ?? "-"}`
    );
    const graves = problemas.filter((p) => p.includes("VAZIA"));
    for (const p of problemas) console.log(`[ensaio]   aviso: ${p}`);
    return graves.length === 0;
  } finally {
    await chamarNeon(`/projects/${local.projetoId}/branches/${branchId}`, { method: "DELETE", tolerarErro: true });
    const sobrou = await chamarNeon(`/projects/${local.projetoId}/branches/${branchId}`, { tolerarErro: true });
    console.log(`[ensaio] ${nome}: branch temporario ${sobrou?.branch && !sobrou.branch.deleted_at ? "AINDA EXISTE — apagar a mao" : "apagado"}`);
  }
}

async function principal() {
  if (!process.env.NEON_API_KEY) erro("NEON_API_KEY nao definida.");
  const ambiente = lerArgumento("ambiente");
  if (!ambienteValido(ambiente)) erro("use --ambiente teste|producao");
  const horas = Number(lerArgumento("horas-atras", "1"));
  if (!Number.isFinite(horas) || horas <= 0 || horas > 6) erro("--horas-atras entre 0 e 6 (o historico do Neon guarda 6h).");

  const carimbo = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const endpoints = ENDPOINTS_NEON[ambiente];
  let aprovado = true;
  for (const [nome, id] of [["tenant", endpoints.tenant], ["central", endpoints.central]]) {
    try {
      aprovado = (await ensaiar(nome, id, horas, carimbo)) && aprovado;
    } catch (falha) {
      aprovado = false;
      console.error(`[ensaio] ${nome}: FALHOU — ${falha instanceof Error ? falha.message : falha}`);
    }
  }
  console.log(`[ensaio] resultado: ${aprovado ? "APROVADO — da para restaurar" : "REPROVADO — ver acima"}`);
  if (!aprovado) process.exit(1);
}

principal();
