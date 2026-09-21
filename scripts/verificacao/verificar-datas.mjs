// npm run db:verificar-datas -- --antes
// npm run db:verificar-datas -- --depois
//
// Fase 2A-1: prova de que a migracao "colunas instante viram timestamptz"
// (prisma/migrations/20260921134054_colunas_instante_viram_timestamptz e
// prisma/central/migrations/20260921134500_colunas_instante_viram_timestamptz)
// preserva o instante exato ja gravado em cada coluna — nao desloca nenhum
// valor existente, so anota o fuso que ja estava implicito (USING "coluna"
// AT TIME ZONE 'UTC', ver o cabecalho dos dois arquivos de migracao).
//
// Modo --antes: roda ANTES de `npm run db:migrar -- --aplicar`, contra o
// schema ainda em `timestamp without time zone`. Salva um snapshot em
// docs/diagnostico/verificacao-datas-antes.json: pra cada (tabela, coluna)
// convertida nesta fase, a contagem de linhas e um checksum determinista de
// todo valor, em milissegundos desde a epoch UTC.
//
// Modo --depois: roda DEPOIS da migracao aplicada (schema em `timestamptz`).
// Recalcula o mesmo snapshot e compara contra o salvo por --antes. Sai com
// codigo != 0 (e imprime a primeira divergencia) se qualquer (tabela,
// coluna) tiver contagem ou checksum diferente — deploy bem-sucedido nao
// deveria mudar NENHUM dos dois, exatamente como o `migrate diff` vazio do
// passo 6 de `scripts/migracao/migrar-tenants.mjs` (docs/operacao/migrations.md
// secao 5) prova pro schema inteiro.
//
// Checksum: `md5(string_agg(coalesce((extract(epoch from "coluna") * 1000)::text, 'NULL'), ',' ORDER BY id))`
// — cada valor vira "ms desde a epoch UTC" (ou o literal "NULL"), concatenado
// em ordem estavel (por `id`, PK de toda tabela aqui) e resumido em md5. Um
// `timestamp without time zone` e lido pelo Postgres exatamente como o
// Prisma sempre leu (sem conversao de fuso) — `extract(epoch from ...)`
// nesse tipo e o mesmo `extract(epoch from ...)` no `timestamptz`
// resultante, porque a migracao usa `USING "coluna" AT TIME ZONE 'UTC'`
// (o inverso exato da leitura "assume UTC" que gerou o valor). Se o
// checksum mudar, a migracao deslocou algum instante — é exatamente o que
// este script existe para pegar antes que aconteça de verdade.
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  abrirConexaoSomenteLeitura,
  consultarTolerante,
  extrairHostMascarado,
} from "../lib/conexao-somente-leitura.mjs";
import {
  avisarTenantsPulados,
  imprimirAusenciaDeAmbiente,
  lerCentralDatabaseUrl,
  listarTenantsAtivos,
} from "../lib/tenants-centrais.mjs";

const PASTA_SAIDA = path.resolve(process.cwd(), "docs", "diagnostico");
const ARQUIVO_SNAPSHOT = path.join(PASTA_SAIDA, "verificacao-datas-antes.json");

// Mesma lista de (tabela, colunas) das duas migracoes desta fase — mantida
// em sincronia manualmente (poucas linhas, revisadas junto no PR). Cada
// coluna aqui e a que a Parte 1 classificou como INSTANTE.
const TABELAS_TENANT = {
  Usuario: ["criadoEm", "atualizadoEm"],
  LogAuditoria: ["criadoEm"],
  Configuracao: ["criadoEm", "atualizadoEm"],
  Cliente: ["criadoEm", "atualizadoEm"],
  Oportunidade: ["criadoEm", "atualizadoEm"],
  PropostaComercial: ["criadoEm", "atualizadoEm"],
  PropostaItem: ["criadoEm", "atualizadoEm"],
  OrdemServico: ["archivedAt", "excluidaEm", "criadoEm", "atualizadoEm"],
  TecnicoOS: ["criadoEm"],
  TermoGarantiaOS: ["dataInicioGarantia", "dataFimGarantia", "canceladaEm", "criadoEm", "atualizadoEm"],
  RetornoGarantiaOS: ["finalizadoEm", "criadoEm", "atualizadoEm"],
  ItemOS: ["criadoEm"],
  ContaReceber: ["dataRecebimento", "dataFinalizacao", "criadoEm", "atualizadoEm"],
  Despesa: ["criadoEm", "atualizadoEm"],
  ParcelaDespesa: ["dataPagamento", "criadoEm"],
  NotaFiscal: ["criadoEm"],
  Produto: ["criadoEm", "atualizadoEm"],
  Conta: ["criadoEm", "atualizadoEm"],
  PedidoVenda: ["dataCriacao"],
  PedidoVendaItem: ["criadoEm", "atualizadoEm"],
  PedidoVendaParcela: ["criadoEm", "atualizadoEm"],
  Venda: ["criadoEm"],
  VendaPagamento: ["criadoEm", "atualizadoEm"],
  CaixaSession: ["dataAbertura", "dataFechamento", "criadoEm", "atualizadoEm"],
  Notificacao: ["criadoEm"],
  Meta: ["ultimaSincronizacaoEm", "excluidaEm", "concluidaEm", "canceladaEm", "criadoEm", "atualizadoEm"],
  ItemChecklistMeta: ["concluidoEm", "criadoEm", "atualizadoEm"],
  HistoricoMeta: ["criadoEm"],
};

const TABELAS_CENTRAL = {
  Empresa: ["criadoEm", "atualizadoEm"],
  Tenant: ["criadoEm", "atualizadoEm"],
  UsuarioCentral: ["criadoEm", "atualizadoEm"],
  SessaoCentral: ["expiraEm", "revogadaEm", "ultimoUsoEm", "criadoEm", "atualizadoEm"],
  UsuarioEmpresa: ["criadoEm", "atualizadoEm"],
  Cargo: ["arquivadoEm", "criadoEm", "atualizadoEm"],
  LogAuditoria: ["criadoEm"],
};

function normalizarModo(argv) {
  if (argv.includes("--antes")) return "antes";
  if (argv.includes("--depois")) return "depois";
  return null;
}

async function coletarChecksumColuna(cliente, tabela, coluna) {
  const sql = `
    SELECT
      count(*)::int AS total,
      md5(
        coalesce(
          string_agg(
            coalesce((extract(epoch FROM "${coluna}") * 1000)::text, 'NULL'),
            ',' ORDER BY id
          ),
          ''
        )
      ) AS checksum
    FROM "${tabela}"
  `;

  return consultarTolerante(cliente, sql);
}

async function coletarSnapshotBanco(connectionString, rotulo, tabelas) {
  const cliente = await abrirConexaoSomenteLeitura(connectionString, rotulo);
  const colunas = {};

  try {
    for (const [tabela, listaColunas] of Object.entries(tabelas)) {
      for (const coluna of listaColunas) {
        const chave = `${tabela}.${coluna}`;
        const resultado = await coletarChecksumColuna(cliente, tabela, coluna);

        if (!resultado.ok) {
          colunas[chave] = { ok: false, erro: resultado.erro };
          continue;
        }

        const linha = resultado.linhas[0] ?? { total: 0, checksum: null };
        colunas[chave] = {
          ok: true,
          total: Number(linha.total ?? 0),
          checksum: linha.checksum ?? "d41d8cd98f00b204e9800998ecf8427e", // md5('') — tabela vazia
        };
      }
    }
  } finally {
    await cliente.end().catch(() => {});
  }

  return colunas;
}

function imprimirSnapshot(rotulo, colunas) {
  console.log("");
  console.log(`[verificar-datas] ${rotulo}`);
  for (const [chave, valor] of Object.entries(colunas)) {
    if (!valor.ok) {
      console.log(`  ${chave.padEnd(40)} INDISPONIVEL (${valor.erro})`);
      continue;
    }
    console.log(`  ${chave.padEnd(40)} total=${String(valor.total).padStart(8)}  checksum=${valor.checksum}`);
  }
}

function compararSnapshots(antes, depois) {
  const divergencias = [];

  for (const chave of Object.keys(antes)) {
    const a = antes[chave];
    const d = depois[chave];

    if (!d) {
      divergencias.push(`${chave}: ausente no snapshot "depois"`);
      continue;
    }
    if (a.ok !== d.ok) {
      divergencias.push(`${chave}: disponibilidade mudou (antes ok=${a.ok}, depois ok=${d.ok})`);
      continue;
    }
    if (!a.ok) continue; // as duas leituras falharam do mesmo jeito — nada a comparar

    if (a.total !== d.total) {
      divergencias.push(`${chave}: total mudou (antes=${a.total}, depois=${d.total})`);
    }
    if (a.checksum !== d.checksum) {
      divergencias.push(`${chave}: checksum mudou (antes=${a.checksum}, depois=${d.checksum})`);
    }
  }

  return divergencias;
}

async function coletarSnapshotCompleto() {
  const centralDatabaseUrl = lerCentralDatabaseUrl();

  if (!centralDatabaseUrl) {
    imprimirAusenciaDeAmbiente();
    process.exit(1);
  }

  const descoberta = await listarTenantsAtivos(centralDatabaseUrl);
  avisarTenantsPulados(descoberta.pulados);

  const snapshot = { geradoEm: new Date().toISOString(), bancos: {} };

  console.log(`[verificar-datas] banco central (${extrairHostMascarado(centralDatabaseUrl)})`);
  const colunasCentral = await coletarSnapshotBanco(centralDatabaseUrl, "banco central", TABELAS_CENTRAL);
  snapshot.bancos.central = colunasCentral;
  imprimirSnapshot("banco central", colunasCentral);

  for (const tenant of descoberta.resolvidos) {
    console.log(`[verificar-datas] tenant ${tenant.slug} (${extrairHostMascarado(tenant.connectionString)})`);
    const colunasTenant = await coletarSnapshotBanco(
      tenant.connectionString,
      `tenant ${tenant.slug}`,
      TABELAS_TENANT
    );
    snapshot.bancos[tenant.slugArquivo] = colunasTenant;
    imprimirSnapshot(`tenant ${tenant.slug}`, colunasTenant);
  }

  return snapshot;
}

async function principal() {
  const modo = normalizarModo(process.argv.slice(2));

  if (!modo) {
    console.error("");
    console.error("[erro] Uso: node scripts/verificacao/verificar-datas.mjs --antes | --depois");
    console.error("[erro]   --antes  : roda ANTES de aplicar a migracao, salva o snapshot.");
    console.error(`[erro]   --depois : roda DEPOIS, compara contra ${ARQUIVO_SNAPSHOT}.`);
    console.error("");
    process.exit(1);
  }

  await mkdir(PASTA_SAIDA, { recursive: true });

  const snapshotAtual = await coletarSnapshotCompleto();

  if (modo === "antes") {
    await writeFile(ARQUIVO_SNAPSHOT, `${JSON.stringify(snapshotAtual, null, 2)}\n`, "utf8");
    console.log("");
    console.log(`[verificar-datas] OK -> snapshot "antes" salvo em ${ARQUIVO_SNAPSHOT}`);
    console.log("[verificar-datas] Nenhuma escrita foi feita em nenhum banco (leitura somente).");
    return;
  }

  // modo === "depois"
  let snapshotAntes;
  try {
    snapshotAntes = JSON.parse(await readFile(ARQUIVO_SNAPSHOT, "utf8"));
  } catch (erro) {
    console.error("");
    console.error(`[erro] Nao foi possivel ler o snapshot "antes" em ${ARQUIVO_SNAPSHOT}.`);
    console.error(`[erro] Rode "node scripts/verificacao/verificar-datas.mjs --antes" antes de aplicar a migracao.`);
    console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error("");
    process.exit(1);
  }

  const todasDivergencias = [];

  for (const [banco, colunasDepois] of Object.entries(snapshotAtual.bancos)) {
    const colunasAntes = snapshotAntes.bancos?.[banco];
    if (!colunasAntes) {
      todasDivergencias.push(`${banco}: sem snapshot "antes" correspondente`);
      continue;
    }
    for (const divergencia of compararSnapshots(colunasAntes, colunasDepois)) {
      todasDivergencias.push(`${banco}: ${divergencia}`);
    }
  }

  console.log("");
  if (todasDivergencias.length === 0) {
    console.log("[verificar-datas] OK -> nenhuma divergencia entre antes e depois. Migracao preservou todo instante.");
    return;
  }

  console.error(`[verificar-datas] FALHA -> ${todasDivergencias.length} divergencia(s):`);
  for (const divergencia of todasDivergencias) {
    console.error(`  - ${divergencia}`);
  }
  console.error("");
  process.exit(1);
}

principal().catch((erro) => {
  console.error("");
  console.error(`[erro] Falha inesperada em verificar-datas: ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
