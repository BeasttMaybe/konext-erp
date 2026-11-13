import "server-only";

/**
 * API do Neon para o master criar o banco de cada loja nova.
 *
 * Onde as lojas moram: um projeto do Neon chamado "konext-lojas", criado
 * sozinho na primeira loja (mesma regiao e versao do Postgres dos projetos
 * que ja existem na conta). Cada loja ganha um BANCO e um PAPEL (usuario do
 * Postgres) proprios nesse projeto — a conexao de uma loja so conhece o banco
 * dela. NEON_API_KEY e variavel de ambiente do projeto master na Vercel.
 *
 * O Neon processa mudancas em fila: enquanto uma operacao roda, a proxima
 * responde 423 (travado). chamarNeon espera e tenta de novo.
 */

const API = "https://console.neon.tech/api/v2";
export const NOME_DO_PROJETO_DAS_LOJAS = "konext-lojas";

type Opcoes = { metodo?: string; corpo?: unknown; tolerar404?: boolean };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chamarNeon<T = Record<string, unknown>>(caminho: string, opcoes: Opcoes = {}): Promise<T | null> {
  const chave = process.env.NEON_API_KEY?.trim();
  if (!chave) throw new Error("NEON_API_KEY não configurada no projeto master da Vercel.");
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const resposta = await fetch(`${API}${caminho}`, {
      method: opcoes.metodo ?? "GET",
      headers: { Authorization: `Bearer ${chave}`, Accept: "application/json", "Content-Type": "application/json" },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      cache: "no-store",
    });
    if (resposta.status === 423 || resposta.status === 429 || resposta.status >= 500) {
      await esperar(2000);
      continue;
    }
    if (resposta.status === 404 && opcoes.tolerar404) return null;
    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => "");
      throw new Error(`Neon respondeu ${resposta.status} em ${caminho}: ${texto.slice(0, 300)}`);
    }
    return (await resposta.json()) as T;
  }
  throw new Error(`Neon ficou ocupado demais em ${caminho}. Tente de novo em instantes.`);
}

type Projeto = { id: string; name: string; region_id: string; pg_version: number; org_id?: string };

async function listarProjetos(): Promise<Projeto[]> {
  const orgs = await chamarNeon<{ organizations?: Array<{ id: string }> }>("/users/me/organizations").catch(() => null);
  const lista = orgs?.organizations ?? [];
  if (lista.length === 0) return (await chamarNeon<{ projects: Projeto[] }>("/projects"))?.projects ?? [];
  const todos: Projeto[] = [];
  for (const org of lista) {
    const r = await chamarNeon<{ projects: Projeto[] }>(`/projects?org_id=${encodeURIComponent(org.id)}`);
    todos.push(...(r?.projects ?? []).map((p) => ({ ...p, org_id: p.org_id ?? org.id })));
  }
  return todos;
}

async function esperarOperacoes(projetoId: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const r = await chamarNeon<{ operations?: Array<{ status: string }> }>(`/projects/${projetoId}/operations?limit=20`);
    const rodando = (r?.operations ?? []).some((o) => ["running", "scheduling", "cancelling"].includes(o.status));
    if (!rodando) return;
    await esperar(2000);
  }
  throw new Error("O Neon não terminou de preparar o banco a tempo. Tente continuar em instantes.");
}

async function branchPrincipal(projetoId: string): Promise<string> {
  const r = await chamarNeon<{ branches: Array<{ id: string; default?: boolean; primary?: boolean }> }>(`/projects/${projetoId}/branches`);
  const principal = r?.branches.find((b) => b.default || b.primary) ?? r?.branches[0];
  if (!principal) throw new Error("Projeto das lojas sem branch.");
  return principal.id;
}

export async function garantirProjetoDasLojas(): Promise<{ projetoId: string; branchId: string }> {
  const projetos = await listarProjetos();
  const existente = projetos.find((p) => p.name === NOME_DO_PROJETO_DAS_LOJAS);
  if (existente) return { projetoId: existente.id, branchId: await branchPrincipal(existente.id) };

  const modelo = projetos[0];
  if (!modelo) throw new Error("Nenhum projeto encontrado nesta conta do Neon para copiar região e versão.");
  const criado = await chamarNeon<{ project: { id: string } }>("/projects", {
    metodo: "POST",
    corpo: {
      project: {
        name: NOME_DO_PROJETO_DAS_LOJAS,
        region_id: modelo.region_id,
        pg_version: modelo.pg_version,
        ...(modelo.org_id ? { org_id: modelo.org_id } : {}),
      },
    },
  });
  const projetoId = criado?.project.id;
  if (!projetoId) throw new Error("O Neon não devolveu o projeto das lojas.");
  await esperarOperacoes(projetoId);
  return { projetoId, branchId: await branchPrincipal(projetoId) };
}

/** Cria (se ainda nao existir) o papel e o banco da loja e devolve a conexao direta (sem -pooler). */
export async function garantirBancoDaLoja(
  local: { projetoId: string; branchId: string },
  nome: string
): Promise<string> {
  const base = `/projects/${local.projetoId}/branches/${local.branchId}`;
  const papel = await chamarNeon(`${base}/roles/${nome}`, { tolerar404: true });
  if (!papel) {
    await chamarNeon(`${base}/roles`, { metodo: "POST", corpo: { role: { name: nome } } });
    await esperarOperacoes(local.projetoId);
  }
  const banco = await chamarNeon(`${base}/databases/${nome}`, { tolerar404: true });
  if (!banco) {
    await chamarNeon(`${base}/databases`, { metodo: "POST", corpo: { database: { name: nome, owner_name: nome } } });
    await esperarOperacoes(local.projetoId);
  }
  const parametros = new URLSearchParams({ branch_id: local.branchId, database_name: nome, role_name: nome, pooled: "false" });
  const r = await chamarNeon<{ uri: string }>(`/projects/${local.projetoId}/connection_uri?${parametros}`);
  const uri = r?.uri;
  if (!uri) throw new Error("O Neon não devolveu a conexão do banco da loja.");
  if (new URL(uri).hostname.split(".")[0].endsWith("-pooler")) throw new Error("O Neon devolveu conexão agrupada (-pooler).");
  return uri;
}
