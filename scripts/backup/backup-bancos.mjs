// npm run db:backup
//
// Gera um dump `pg_dump --format=custom --no-owner` do banco central e de cada
// tenant ATIVO, em backups/<AAAAMMDD-HHmm>/, com manifest.json.
//
// Somente leitura: toda conexao aberta por este script e travada em
// `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` + `default_transaction_read_only = on`,
// e o proprio pg_dump roda com PGOPTIONS forcando o mesmo padrao.
import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  comConexaoSomenteLeitura,
  extrairHostMascarado,
  mascararConnectionString,
  recusarPooler,
} from "../lib/conexao-somente-leitura.mjs";
import {
  avisarTenantsPulados,
  imprimirAusenciaDeAmbiente,
  lerCentralDatabaseUrl,
  listarTenantsAtivos,
} from "../lib/tenants-centrais.mjs";

const RAIZ_BACKUPS = path.resolve(process.cwd(), "backups");

function carimboDeTempoPasta(agora) {
  const doisDigitos = (valor) => String(valor).padStart(2, "0");

  return (
    `${agora.getFullYear()}${doisDigitos(agora.getMonth() + 1)}${doisDigitos(agora.getDate())}` +
    `-${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}`
  );
}

function detectarPgDump() {
  const resultado = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });

  if (resultado.error || resultado.status !== 0) {
    return { disponivel: false };
  }

  const saida = String(resultado.stdout ?? "").trim();
  const versaoEncontrada = saida.match(/(\d+)(?:\.(\d+))?/);

  return {
    disponivel: true,
    versaoTexto: saida,
    versaoMaior: versaoEncontrada ? Number(versaoEncontrada[1]) : 0,
  };
}

function abortarSemPgDump() {
  console.error("");
  console.error("[erro] `pg_dump` nao foi encontrado no PATH.");
  console.error("[erro] Sem ele nao ha backup, e sem backup nada mais desta fase deve rodar.");
  console.error("");
  console.error("[erro] Instale as ferramentas de cliente do PostgreSQL:");
  console.error("[erro]   Windows : https://www.postgresql.org/download/windows/ (instale so 'Command Line Tools')");
  console.error("[erro]             depois adicione algo como C:\\Program Files\\PostgreSQL\\17\\bin ao PATH");
  console.error("[erro]   macOS   : brew install libpq && brew link --force libpq");
  console.error("[erro]   Linux   : sudo apt install postgresql-client-17");
  console.error("");
  console.error("[erro] A versao do pg_dump precisa ser IGUAL OU MAIOR que a do servidor.");
  console.error("");
  process.exit(1);
}

async function lerVersaoServidor(connectionString, rotulo) {
  return comConexaoSomenteLeitura(connectionString, rotulo, async (cliente) => {
    const resultado = await cliente.query(
      "SELECT current_setting('server_version') AS versao, current_setting('server_version_num')::int AS numero"
    );

    const linha = resultado.rows[0];

    return {
      versaoTexto: String(linha?.versao ?? "desconhecida"),
      versaoMaior: Math.floor(Number(linha?.numero ?? 0) / 10000),
    };
  });
}

async function calcularSha256(caminhoArquivo) {
  return new Promise((resolver, rejeitar) => {
    const hash = createHash("sha256");
    const fluxo = createReadStream(caminhoArquivo);

    fluxo.on("error", rejeitar);
    fluxo.on("data", (pedaco) => hash.update(pedaco));
    fluxo.on("end", () => resolver(hash.digest("hex")));
  });
}

function executarPgDump(connectionString, caminhoArquivo) {
  const resultado = spawnSync(
    "pg_dump",
    ["--format=custom", "--no-owner", "--file", caminhoArquivo, connectionString],
    {
      encoding: "utf8",
      // Defesa em profundidade: mesmo que algo no dump tentasse escrever, a
      // sessao do proprio pg_dump ja nasce somente-leitura.
      env: { ...process.env, PGOPTIONS: "-c default_transaction_read_only=on" },
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  if (resultado.error) {
    return { ok: false, erro: resultado.error.message };
  }

  if (resultado.status !== 0) {
    return { ok: false, erro: String(resultado.stderr ?? "").trim() || `pg_dump saiu com codigo ${resultado.status}` };
  }

  return { ok: true };
}

async function gerarDump({ rotulo, slugArquivo, connectionString, pastaDestino, pgDump }) {
  console.log("");
  console.log(`[backup] ${rotulo}`);
  console.log(`[backup]   alvo: ${mascararConnectionString(connectionString)}`);

  try {
    recusarPooler(connectionString, rotulo);
  } catch (erro) {
    console.error(`[backup]   FALHOU: ${erro instanceof Error ? erro.message : String(erro)}`);
    return { ok: false, slug: slugArquivo, erro: erro instanceof Error ? erro.message : String(erro) };
  }

  let servidor;

  try {
    servidor = await lerVersaoServidor(connectionString, rotulo);
  } catch (erro) {
    console.error(`[backup]   FALHOU ao conectar: ${erro instanceof Error ? erro.message : String(erro)}`);
    return { ok: false, slug: slugArquivo, erro: erro instanceof Error ? erro.message : String(erro) };
  }

  console.log(`[backup]   servidor: PostgreSQL ${servidor.versaoTexto} (major ${servidor.versaoMaior})`);

  if (pgDump.versaoMaior < servidor.versaoMaior) {
    console.error("");
    console.error(
      `[erro] pg_dump major ${pgDump.versaoMaior} e MENOR que o servidor major ${servidor.versaoMaior}.`
    );
    console.error("[erro] Um dump gerado por cliente mais antigo pode ficar incompleto ou nao restaurar.");
    console.error(`[erro] Atualize o pg_dump para a versao ${servidor.versaoMaior} ou superior e rode de novo.`);
    console.error("");
    process.exit(1);
  }

  const nomeArquivo = `${slugArquivo}.dump`;
  const caminhoArquivo = path.join(pastaDestino, nomeArquivo);
  const iniciadoEm = new Date();

  const execucao = executarPgDump(connectionString, caminhoArquivo);

  if (!execucao.ok) {
    console.error(`[backup]   FALHOU no pg_dump: ${execucao.erro}`);
    return { ok: false, slug: slugArquivo, erro: execucao.erro };
  }

  const informacoes = await stat(caminhoArquivo);
  const sha256 = await calcularSha256(caminhoArquivo);

  console.log(`[backup]   OK -> ${nomeArquivo} (${(informacoes.size / 1024 / 1024).toFixed(2)} MB)`);

  return {
    ok: true,
    entrada: {
      slug: slugArquivo,
      rotulo,
      arquivo: nomeArquivo,
      hostMascarado: extrairHostMascarado(connectionString),
      tamanhoBytes: informacoes.size,
      sha256,
      versaoPgDump: pgDump.versaoTexto,
      versaoServidor: servidor.versaoTexto,
      iniciadoEm: iniciadoEm.toISOString(),
      concluidoEm: new Date().toISOString(),
    },
  };
}

async function principal() {
  const centralDatabaseUrl = lerCentralDatabaseUrl();

  if (!centralDatabaseUrl) {
    imprimirAusenciaDeAmbiente();
    process.exit(1);
  }

  const pgDump = detectarPgDump();

  if (!pgDump.disponivel) {
    abortarSemPgDump();
  }

  console.log(`[backup] ${pgDump.versaoTexto}`);

  let descoberta;

  try {
    descoberta = await listarTenantsAtivos(centralDatabaseUrl);
  } catch (erro) {
    console.error("");
    console.error(`[erro] Nao foi possivel listar os tenants no banco central: ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error("");
    process.exit(1);
  }

  avisarTenantsPulados(descoberta.pulados);

  const agora = new Date();
  const pastaDestino = path.join(RAIZ_BACKUPS, carimboDeTempoPasta(agora));
  await mkdir(pastaDestino, { recursive: true });

  console.log(`[backup] Destino: ${pastaDestino}`);
  console.log(`[backup] Tenants ativos a copiar: ${descoberta.resolvidos.length}`);

  const entradas = [];
  const falhas = [];

  const resultadoCentral = await gerarDump({
    rotulo: "banco central",
    slugArquivo: "central",
    connectionString: centralDatabaseUrl,
    pastaDestino,
    pgDump,
  });

  if (resultadoCentral.ok) {
    entradas.push(resultadoCentral.entrada);
  } else {
    falhas.push({ slug: "central", erro: resultadoCentral.erro });
  }

  for (const tenant of descoberta.resolvidos) {
    const resultado = await gerarDump({
      rotulo: `tenant ${tenant.slug} (empresa ${tenant.empresaSlug})`,
      slugArquivo: tenant.slugArquivo,
      connectionString: tenant.connectionString,
      pastaDestino,
      pgDump,
    });

    if (resultado.ok) {
      entradas.push({ ...resultado.entrada, tenantId: tenant.id, empresaSlug: tenant.empresaSlug });
    } else {
      falhas.push({ slug: tenant.slugArquivo, erro: resultado.erro });
    }
  }

  const manifesto = {
    geradoEm: agora.toISOString(),
    pasta: path.basename(pastaDestino),
    versaoPgDump: pgDump.versaoTexto,
    formato: "custom (pg_restore)",
    opcoes: ["--format=custom", "--no-owner"],
    totalArquivos: entradas.length,
    arquivos: entradas,
    tenantsPulados: descoberta.pulados,
    falhas,
  };

  await writeFile(
    path.join(pastaDestino, "manifest.json"),
    `${JSON.stringify(manifesto, null, 2)}\n`,
    "utf8"
  );

  console.log("");
  console.log(`[backup] manifest.json gravado em ${pastaDestino}`);
  console.log(`[backup] Arquivos gerados: ${entradas.length}`);

  if (falhas.length > 0) {
    console.error(`[backup] FALHAS: ${falhas.length}`);

    for (const falha of falhas) {
      console.error(`[backup]   - ${falha.slug}: ${falha.erro}`);
    }

    console.error("[backup] Backup INCOMPLETO. Resolva as falhas antes de seguir para o diagnostico.");
    process.exit(1);
  }

  console.log("[backup] Backup concluido com sucesso.");
  console.log("[backup] Restauracao: ver docs/operacao/backup-restore.md");
}

principal().catch((erro) => {
  console.error("");
  console.error(`[erro] Falha inesperada no backup: ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
