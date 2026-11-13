// npm run db:cifrar-senhas
//
// Cifra a senha e o desenho de desbloqueio do aparelho das OS gravadas antes
// da cifra existir (lib/seguranca/cifra.ts). O app ja le os dois formatos, entao
// este script pode rodar a qualquer momento depois do deploy — e pode rodar
// de novo: so mexe em valor que ainda esta em texto puro.
//
// --dry-run (padrao): so conta, por tenant, quantas OS ainda tem senha em texto
//   puro. Conexoes somente-leitura; nao cria chave.
// --aplicar: exige CONFIRMAR=SIM e PONTO_RESTAURACAO. Por tenant: obtem (ou
//   cria) a chave da loja no banco central, cifra linha a linha numa transacao
//   — cada UPDATE so vale se o valor ainda for o lido (outra gravacao no meio
//   nao e sobrescrita) — e confere no fim que nada ficou em texto puro e que
//   uma amostra abre de volta igual ao original.
// --tenant <slug>: restringe a um tenant.
import "dotenv/config";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { comConexaoSomenteLeitura, extrairHostMascarado, recusarPooler } from "../lib/conexao-somente-leitura.mjs";
import { avisarTenantsPulados, lerCentralDatabaseUrl, listarTenantsAtivos } from "../lib/tenants-centrais.mjs";
import {
  cifrar,
  CONTEXTO_DESENHO_DO_APARELHO,
  CONTEXTO_SENHA_DO_APARELHO,
  decifrar,
  estaCifrado,
  gerarChave,
  lerChave,
} from "../lib/cifra.mjs";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const SQL_PENDENTES = `
  SELECT id, senha, "senhaDesenho"
    FROM "OrdemServico"
   WHERE (senha IS NOT NULL AND senha <> '' AND senha NOT LIKE 'v1:%')
      OR ("senhaDesenho" IS NOT NULL AND "senhaDesenho" <> '' AND "senhaDesenho" NOT LIKE 'v1:%')`;

function lerArgumentos(argv) {
  const args = { aplicar: false, tenant: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--aplicar") args.aplicar = true;
    else if (argv[i] === "--dry-run") args.aplicar = false;
    else if (argv[i] === "--tenant") args.tenant = argv[++i] ?? null;
  }
  return args;
}

async function comConexaoDeEscrita(connectionString, rotulo, executar) {
  recusarPooler(connectionString, rotulo);
  const cliente = new Client(connectionString);
  await cliente.connect();
  try {
    return await executar(cliente);
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function chaveDaEmpresa(centralUrl, empresaId) {
  return comConexaoDeEscrita(centralUrl, "banco central", async (central) => {
    await central.query(
      `INSERT INTO "ChaveDeCifraEmpresa" ("empresaId", chave) VALUES ($1, $2) ON CONFLICT ("empresaId") DO NOTHING`,
      [empresaId, gerarChave()]
    );
    const { rows } = await central.query(`SELECT chave FROM "ChaveDeCifraEmpresa" WHERE "empresaId" = $1`, [empresaId]);
    if (!rows[0]) throw new Error("chave da loja nao encontrada depois de criar");
    return lerChave(rows[0].chave);
  });
}

function cifrarSeTextoPuro(valor, chave, contexto) {
  if (valor === null || valor === undefined || valor === "" || estaCifrado(valor)) return valor;
  return cifrar(valor, chave, contexto);
}

async function aplicarNoTenant(tenant, centralUrl) {
  const chave = await chaveDaEmpresa(centralUrl, tenant.empresaId);
  return comConexaoDeEscrita(tenant.connectionString, tenant.slug, async (cliente) => {
    await cliente.query("BEGIN");
    try {
      const { rows } = await cliente.query(SQL_PENDENTES);
      let atualizadas = 0;
      const amostra = [];
      for (const linha of rows) {
        const senha = cifrarSeTextoPuro(linha.senha, chave, CONTEXTO_SENHA_DO_APARELHO);
        const senhaDesenho = cifrarSeTextoPuro(linha.senhaDesenho, chave, CONTEXTO_DESENHO_DO_APARELHO);
        const resultado = await cliente.query(
          `UPDATE "OrdemServico" SET senha = $2, "senhaDesenho" = $3
            WHERE id = $1 AND senha IS NOT DISTINCT FROM $4 AND "senhaDesenho" IS NOT DISTINCT FROM $5`,
          [linha.id, senha, senhaDesenho, linha.senha, linha.senhaDesenho]
        );
        atualizadas += resultado.rowCount ?? 0;
        if (amostra.length < 5) amostra.push(linha);
      }

      // Conferencia antes do COMMIT: nada em texto puro e a amostra abre igual.
      const restantes = await cliente.query(SQL_PENDENTES);
      if (restantes.rows.length > 0) throw new Error(`${restantes.rows.length} OS ainda em texto puro depois da cifra`);
      for (const original of amostra) {
        const { rows: [gravada] } = await cliente.query(`SELECT senha, "senhaDesenho" FROM "OrdemServico" WHERE id = $1`, [original.id]);
        const conferir = (orig, gravado, contexto) => {
          if (!orig) return;
          const aberto = estaCifrado(orig) ? orig : decifrar(gravado, chave, contexto);
          if (aberto !== orig) throw new Error(`OS ${original.id}: valor cifrado nao abre igual ao original`);
        };
        conferir(original.senha, gravada.senha, CONTEXTO_SENHA_DO_APARELHO);
        conferir(original.senhaDesenho, gravada.senhaDesenho, CONTEXTO_DESENHO_DO_APARELHO);
      }

      await cliente.query("COMMIT");
      return { pendentes: rows.length, atualizadas };
    } catch (erro) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw erro;
    }
  });
}

async function principal() {
  const args = lerArgumentos(process.argv.slice(2));
  const centralUrl = lerCentralDatabaseUrl();
  if (!centralUrl) {
    console.error("[cifrar] CENTRAL_DATABASE_URL ausente.");
    process.exit(1);
  }
  recusarPooler(centralUrl, "banco central");

  if (args.aplicar) {
    if (process.env.CONFIRMAR !== "SIM") throw new Error("--aplicar exige CONFIRMAR=SIM");
    if (!process.env.PONTO_RESTAURACAO) throw new Error("--aplicar exige PONTO_RESTAURACAO");
    console.log(`[cifrar] ponto de restauracao: ${process.env.PONTO_RESTAURACAO}`);
  }

  const { resolvidos, pulados } = await listarTenantsAtivos(centralUrl);
  avisarTenantsPulados(pulados);
  const alvos = args.tenant ? resolvidos.filter((t) => t.slug === args.tenant) : resolvidos;
  if (args.tenant && alvos.length === 0) throw new Error(`tenant ${args.tenant} nao encontrado entre os ativos`);

  console.log(`[cifrar] modo: ${args.aplicar ? "APLICAR" : "dry-run"} — ${alvos.length} tenant(s)`);
  let falhou = false;
  for (const tenant of alvos) {
    const host = extrairHostMascarado(tenant.connectionString);
    try {
      if (!args.aplicar) {
        const pendentes = await comConexaoSomenteLeitura(tenant.connectionString, tenant.slug, (c) => c.query(SQL_PENDENTES));
        console.log(`[cifrar] ${tenant.slug} (${host}): ${pendentes.rows.length} OS com senha em texto puro`);
      } else {
        const r = await aplicarNoTenant(tenant, centralUrl);
        console.log(`[cifrar] ${tenant.slug} (${host}): ${r.atualizadas}/${r.pendentes} OS cifradas, conferido`);
      }
    } catch (erro) {
      falhou = true;
      console.error(`[cifrar] ${tenant.slug}: ERRO ${erro instanceof Error ? erro.message : String(erro)}`);
      if (args.aplicar) break;
    }
  }
  if (falhou) process.exit(1);
}

principal().catch((erro) => {
  console.error(`[cifrar] erro: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});
