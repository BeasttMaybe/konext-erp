// Conexao Postgres travada em somente-leitura, compartilhada pelos scripts de
// backup e de diagnostico da Fase 0.
//
// Regra da fase: NENHUM script pode escrever em banco. A trava e aplicada na
// propria sessao (nao so por disciplina do autor da query) e verificada logo
// depois; se a verificacao falhar, a conexao e fechada e o script aborta.
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

/**
 * Conexoes via pooler nao servem aqui: o pooler multiplexa sessoes, o que torna
 * `SET SESSION CHARACTERISTICS` nao confiavel, e `pg_dump` exige conexao direta.
 */
export function recusarPooler(connectionString, rotulo) {
  if (String(connectionString).includes("-pooler")) {
    throw new Error(
      `${rotulo}: a URL aponta para um endpoint "-pooler". ` +
        "Use a conexao DIRETA (sem -pooler): a sessao somente-leitura e o pg_dump dependem disso."
    );
  }
}

export function mascararConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    return `postgresql://${url.username}:***@${url.hostname}${url.pathname}`;
  } catch {
    return "(connection string invalida)";
  }
}

export function extrairHostMascarado(connectionString) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return "(host desconhecido)";
  }
}

async function exigirSessaoSomenteLeitura(cliente, rotulo) {
  await cliente.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  await cliente.query("SET default_transaction_read_only = on");

  const verificacaoSessao = await cliente.query("SHOW transaction_read_only");
  const verificacaoPadrao = await cliente.query("SHOW default_transaction_read_only");

  const sessaoSomenteLeitura = verificacaoSessao.rows[0]?.transaction_read_only === "on";
  const padraoSomenteLeitura =
    verificacaoPadrao.rows[0]?.default_transaction_read_only === "on";

  if (!sessaoSomenteLeitura || !padraoSomenteLeitura) {
    throw new Error(
      `${rotulo}: nao foi possivel travar a sessao em somente-leitura ` +
        `(transaction_read_only=${verificacaoSessao.rows[0]?.transaction_read_only}, ` +
        `default_transaction_read_only=${verificacaoPadrao.rows[0]?.default_transaction_read_only}). ` +
        "Abortando por seguranca."
    );
  }
}

/**
 * Abre uma conexao ja travada em somente-leitura.
 * Quem chama e responsavel por fechar com `await cliente.end()`.
 */
export async function abrirConexaoSomenteLeitura(connectionString, rotulo) {
  recusarPooler(connectionString, rotulo);

  const cliente = new Client(connectionString);
  await cliente.connect();

  try {
    await exigirSessaoSomenteLeitura(cliente, rotulo);
  } catch (erro) {
    await cliente.end().catch(() => {});
    throw erro;
  }

  return cliente;
}

/**
 * Abre, usa e fecha a conexao somente-leitura.
 */
export async function comConexaoSomenteLeitura(connectionString, rotulo, executar) {
  const cliente = await abrirConexaoSomenteLeitura(connectionString, rotulo);

  try {
    return await executar(cliente);
  } finally {
    await cliente.end().catch(() => {});
  }
}

/**
 * Consulta tolerante: devolve `{ ok: false, erro }` em vez de lancar, para que uma
 * tabela/coluna ausente em um tenant com drift nao derrube todo o diagnostico.
 */
export async function consultarTolerante(cliente, sql, parametros = []) {
  try {
    const resultado = await cliente.query(sql, parametros);
    return { ok: true, linhas: resultado.rows };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}
