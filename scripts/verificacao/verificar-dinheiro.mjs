// npm run db:verificar-dinheiro -- --antes
// npm run db:verificar-dinheiro -- --depois
//
// Fase 2A-2: prova de que a migracao "dinheiro vira Decimal(12,2)/(7,4)"
// (prisma/migrations/20260922120000_dinheiro_vira_decimal) preserva a SOMA
// em centavos (ou em "0,0001 ponto percentual" para colunas PERCENTUAL) de
// cada coluna — o ARREDONDAMENTO que a migracao aplica (USING round(col::numeric, N))
// so deveria tocar linhas cujo valor de origem ja tinha ruido de ponto
// flutuante alem da Nesima casa decimal.
//
// Modo --antes: roda ANTES de `npm run db:migrar -- --aplicar`, contra o
// schema ainda em Float/double precision (dinheiro) ou Decimal(5,2)
// (percentual). Para cada (tabela, coluna) desta fase, salva em
// docs/diagnostico/verificacao-dinheiro-antes.json:
//   - total: contagem de linhas
//   - somaCentavos: SUM(round(coluna::numeric, N)) escalado pra inteiro
//     (multiplicado por 10^N) — ou seja, a soma que a coluna TERA depois da
//     migracao, calculada agora, sem esperar a migracao rodar.
//   - linhasQueMudam: id + valor antigo (texto) + valor novo previsto
//     (texto) de toda linha cujo valor de origem difere do valor
//     arredondado (round(coluna::numeric, N) <> coluna) — exatamente as
//     linhas que "USING round(...)" vai alterar.
//
// Modo --depois: roda DEPOIS da migracao aplicada (schema ja em Decimal).
// Recalcula o mesmo somaCentavos (agora round() e um no-op, a coluna ja
// esta arredondada) e compara contra o salvo por --antes:
//   1. total tem que bater exatamente.
//   2. somaCentavos tem que bater EXATAMENTE (a migracao literalmente
//      aplica o mesmo round() que --antes ja previu, entao a soma pos-
//      migracao tem que ser IDENTICA a soma prevista — zero tolerancia
//      aqui, ao contrario do item 3).
//   3. Para cada linha que --antes ja tinha listado em linhasQueMudam,
//      busca o valor atual (pos-migracao) por id e confere que a diferenca
//      contra o valor antigo e MENOR que meio centavo (ou meia unidade da
//      Nesima casa, pra colunas PERCENTUAL) — prova que o arredondamento
//      foi so isso, arredondamento, nunca um deslocamento de valor.
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
const ARQUIVO_SNAPSHOT = path.join(PASTA_SAIDA, "verificacao-dinheiro-antes.json");

// Mesma lista de (tabela, coluna, casas decimais) da migracao desta fase —
// mantida em sincronia manualmente (poucas linhas, revisadas junto no PR).
// `casas: 2` = coluna DINHEIRO (Decimal(12,2)); `casas: 4` = coluna
// PERCENTUAL (Decimal(7,4)). Meta.valorAlvo/valorAtual e
// HistoricoMeta.valorAnterior/valorNovo ficam de fora de proposito — sao
// polimorficos (ver relatorio da Fase 2A-2, Parte 1), continuam Float.
const COLUNAS_TENANT = [
  ["CaixaSession", "valorAbertura", 2],
  ["CaixaSession", "valorFechamento", 2],
  ["Configuracao", "descontoMaximoPDVPercentual", 4],
  ["Configuracao", "taxaCartaoDebitoPercentual", 4],
  ["Configuracao", "taxaCartaoCredito1xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito2xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito3xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito4xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito5xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito6xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito7xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito8xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito9xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito10xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito11xPercentual", 4],
  ["Configuracao", "taxaCartaoCredito12xPercentual", 4],
  ["Conta", "valor", 2],
  ["ContaReceber", "valor", 2],
  ["Despesa", "valorTotal", 2],
  ["ItemOS", "custoPeca", 2],
  ["ItemOS", "valorCobrado", 2],
  ["ItemVenda", "custoUnitario", 2],
  ["ItemVenda", "precoUnitario", 2],
  ["ItemVenda", "subtotal", 2],
  ["NotaFiscal", "valorTotal", 2],
  ["Oportunidade", "valor", 2],
  ["ParcelaDespesa", "valor", 2],
  ["ParcelaDespesa", "valorPago", 2],
  ["PedidoVenda", "total", 2],
  ["PedidoVendaItem", "precoUnitario", 2],
  ["PedidoVendaItem", "descontoPorcentagem", 4],
  ["PedidoVendaItem", "subtotal", 2],
  ["PedidoVendaParcela", "valor", 2],
  ["Produto", "custo", 2],
  ["Produto", "precoVenda", 2],
  ["PropostaComercial", "subtotalBruto", 2],
  ["PropostaComercial", "descontoTotal", 2],
  ["PropostaComercial", "valorTotal", 2],
  ["PropostaItem", "precoUnitario", 2],
  ["PropostaItem", "descontoPercentual", 4],
  ["PropostaItem", "subtotal", 2],
  ["RetornoGarantiaOS", "valorAdicional", 2],
  ["TecnicoOS", "participacaoPercentual", 4],
  ["Venda", "valorTotal", 2],
  ["Venda", "desconto", 2],
  ["VendaPagamento", "valorBruto", 2],
  ["VendaPagamento", "percentualTaxa", 4],
  ["VendaPagamento", "valorTaxa", 2],
  ["VendaPagamento", "valorLiquido", 2],
];

// Banco central nao tem nenhuma coluna DINHEIRO/PERCENTUAL (confirmado no
// inventario da Parte 1 da Fase 2A-2) — lista vazia de proposito, mantida
// aqui só pra documentar que a ausência foi checada, não esquecida.
const COLUNAS_CENTRAL = [];

const LIMITE_LINHAS_QUE_MUDAM = 2000; // protecao contra JSON gigante num tenant com drift grande

function normalizarModo(argv) {
  if (argv.includes("--antes")) return "antes";
  if (argv.includes("--depois")) return "depois";
  return null;
}

async function coletarColuna(cliente, tabela, coluna, casas) {
  const fator = 10 ** casas;

  const somaResultado = await consultarTolerante(
    cliente,
    `SELECT
       count(*)::int AS total,
       (coalesce(sum(round("${coluna}"::numeric, ${casas})), 0) * ${fator})::bigint AS soma_escalada
     FROM "${tabela}"`
  );

  if (!somaResultado.ok) {
    return { ok: false, erro: somaResultado.erro };
  }

  const linhaSoma = somaResultado.linhas[0] ?? { total: 0, soma_escalada: "0" };

  const linhasQueMudamResultado = await consultarTolerante(
    cliente,
    `SELECT
       id,
       "${coluna}"::text AS valor_antigo,
       round("${coluna}"::numeric, ${casas})::text AS valor_novo
     FROM "${tabela}"
     WHERE "${coluna}" IS NOT NULL
       AND round("${coluna}"::numeric, ${casas}) <> "${coluna}"::numeric
     ORDER BY id
     LIMIT ${LIMITE_LINHAS_QUE_MUDAM}`
  );

  if (!linhasQueMudamResultado.ok) {
    return { ok: false, erro: linhasQueMudamResultado.erro };
  }

  return {
    ok: true,
    total: Number(linhaSoma.total ?? 0),
    somaEscalada: String(linhaSoma.soma_escalada ?? "0"),
    linhasQueMudam: linhasQueMudamResultado.linhas.map((linha) => ({
      id: linha.id,
      valorAntigo: linha.valor_antigo,
      valorNovo: linha.valor_novo,
    })),
  };
}

async function coletarSnapshotBanco(connectionString, rotulo, colunas) {
  const cliente = await abrirConexaoSomenteLeitura(connectionString, rotulo);
  const resultado = {};

  try {
    for (const [tabela, coluna, casas] of colunas) {
      const chave = `${tabela}.${coluna}`;
      resultado[chave] = { casas, ...(await coletarColuna(cliente, tabela, coluna, casas)) };
    }
  } finally {
    await cliente.end().catch(() => {});
  }

  return resultado;
}

function imprimirSnapshot(rotulo, colunas) {
  console.log("");
  console.log(`[verificar-dinheiro] ${rotulo}`);
  for (const [chave, valor] of Object.entries(colunas)) {
    if (!valor.ok) {
      console.log(`  ${chave.padEnd(45)} INDISPONIVEL (${valor.erro})`);
      continue;
    }
    const mudam = valor.linhasQueMudam.length;
    console.log(
      `  ${chave.padEnd(45)} total=${String(valor.total).padStart(7)}  somaEscalada=${valor.somaEscalada.padStart(12)}  linhasQueMudam=${mudam}`
    );
  }
}

// meioDaUnidade: metade de 10^-casas, na mesma escala do texto decimal
// (ex.: casas=2 -> 0.005; casas=4 -> 0.00005) — usado so pra comparar
// diferenca "antigo vs novo" de cada linha marcada em linhasQueMudam.
function meioDaUnidade(casas) {
  return 0.5 / 10 ** casas;
}

async function buscarValoresAtuais(cliente, tabela, coluna, ids) {
  if (ids.length === 0) return new Map();

  const resultado = await consultarTolerante(
    cliente,
    `SELECT id, "${coluna}"::text AS valor FROM "${tabela}" WHERE id = ANY($1::text[])`,
    [ids]
  );

  if (!resultado.ok) {
    throw new Error(`Falha ao reler ${tabela}.${coluna} pos-migracao: ${resultado.erro}`);
  }

  return new Map(resultado.linhas.map((linha) => [linha.id, linha.valor]));
}

async function compararColuna(cliente, chave, casas, antes, depois) {
  const divergencias = [];
  const [tabela, coluna] = chave.split(".");

  if (!depois.ok) {
    divergencias.push(`${chave}: indisponivel no "depois" (${depois.erro})`);
    return divergencias;
  }
  if (!antes.ok) {
    divergencias.push(`${chave}: indisponivel no "antes" (${antes.erro}), nao ha como comparar`);
    return divergencias;
  }

  if (antes.total !== depois.total) {
    divergencias.push(`${chave}: total de linhas mudou (antes=${antes.total}, depois=${depois.total})`);
  }

  if (antes.somaEscalada !== depois.somaEscalada) {
    divergencias.push(
      `${chave}: soma escalada nao bateu (antes previa depois=${antes.somaEscalada}, depois real=${depois.somaEscalada})`
    );
  }

  if (antes.linhasQueMudam.length === 0) {
    return divergencias;
  }

  const ids = antes.linhasQueMudam.map((linha) => linha.id);
  const valoresAtuais = await buscarValoresAtuais(cliente, tabela, coluna, ids);
  const limite = meioDaUnidade(casas);

  for (const linha of antes.linhasQueMudam) {
    const valorAtual = valoresAtuais.get(linha.id);
    if (valorAtual === undefined) {
      divergencias.push(`${chave}: linha id=${linha.id} (marcada como "muda" no antes) nao existe mais no depois`);
      continue;
    }

    const diferenca = Math.abs(Number(valorAtual) - Number(linha.valorAntigo));
    if (!(diferenca < limite)) {
      divergencias.push(
        `${chave}: linha id=${linha.id} mudou mais que meia unidade de arredondamento ` +
          `(antigo=${linha.valorAntigo}, depois=${valorAtual}, diferenca=${diferenca}, limite=${limite})`
      );
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

  if (COLUNAS_CENTRAL.length > 0) {
    console.log(`[verificar-dinheiro] banco central (${extrairHostMascarado(centralDatabaseUrl)})`);
    const colunasCentral = await coletarSnapshotBanco(centralDatabaseUrl, "banco central", COLUNAS_CENTRAL);
    snapshot.bancos.central = colunasCentral;
    imprimirSnapshot("banco central", colunasCentral);
  } else {
    console.log("[verificar-dinheiro] banco central: nenhuma coluna DINHEIRO/PERCENTUAL nesta fase, pulado.");
  }

  for (const tenant of descoberta.resolvidos) {
    console.log(`[verificar-dinheiro] tenant ${tenant.slug} (${extrairHostMascarado(tenant.connectionString)})`);
    const colunasTenant = await coletarSnapshotBanco(tenant.connectionString, `tenant ${tenant.slug}`, COLUNAS_TENANT);
    snapshot.bancos[tenant.slugArquivo] = colunasTenant;
    imprimirSnapshot(`tenant ${tenant.slug}`, colunasTenant);
  }

  return snapshot;
}

async function compararComoDepois(snapshotAtual) {
  const centralDatabaseUrl = lerCentralDatabaseUrl();

  if (!centralDatabaseUrl) {
    imprimirAusenciaDeAmbiente();
    process.exit(1);
  }

  let snapshotAntes;
  try {
    snapshotAntes = JSON.parse(await readFile(ARQUIVO_SNAPSHOT, "utf8"));
  } catch (erro) {
    console.error("");
    console.error(`[erro] Nao foi possivel ler o snapshot "antes" em ${ARQUIVO_SNAPSHOT}.`);
    console.error(`[erro] Rode "node scripts/verificacao/verificar-dinheiro.mjs --antes" antes de aplicar a migracao.`);
    console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error("");
    process.exit(1);
  }

  const descoberta = await listarTenantsAtivos(centralDatabaseUrl);
  avisarTenantsPulados(descoberta.pulados);

  const todasDivergencias = [];

  const bancosParaChecar = [
    { chaveBanco: "central", rotulo: "banco central", connectionString: centralDatabaseUrl, colunas: COLUNAS_CENTRAL },
    ...descoberta.resolvidos.map((tenant) => ({
      chaveBanco: tenant.slugArquivo,
      rotulo: `tenant ${tenant.slug}`,
      connectionString: tenant.connectionString,
      colunas: COLUNAS_TENANT,
    })),
  ];

  for (const banco of bancosParaChecar) {
    if (banco.colunas.length === 0) continue;

    const colunasAntes = snapshotAntes.bancos?.[banco.chaveBanco];
    if (!colunasAntes) {
      todasDivergencias.push(`${banco.rotulo}: sem snapshot "antes" correspondente`);
      continue;
    }

    const cliente = await abrirConexaoSomenteLeitura(banco.connectionString, banco.rotulo);
    try {
      for (const [tabela, coluna, casas] of banco.colunas) {
        const chave = `${tabela}.${coluna}`;
        const antes = colunasAntes[chave];
        const depois = snapshotAtual.bancos?.[banco.chaveBanco]?.[chave];

        if (!antes) {
          todasDivergencias.push(`${banco.rotulo}: ${chave}: sem snapshot "antes"`);
          continue;
        }

        const divergenciasColuna = await compararColuna(cliente, chave, casas, antes, depois);
        for (const divergencia of divergenciasColuna) {
          todasDivergencias.push(`${banco.rotulo}: ${divergencia}`);
        }
      }
    } finally {
      await cliente.end().catch(() => {});
    }
  }

  return todasDivergencias;
}

async function principal() {
  const modo = normalizarModo(process.argv.slice(2));

  if (!modo) {
    console.error("");
    console.error("[erro] Uso: node scripts/verificacao/verificar-dinheiro.mjs --antes | --depois");
    console.error("[erro]   --antes  : roda ANTES de aplicar a migracao, salva o snapshot.");
    console.error(`[erro]   --depois : roda DEPOIS, compara contra ${ARQUIVO_SNAPSHOT}.`);
    console.error("");
    process.exit(1);
  }

  await mkdir(PASTA_SAIDA, { recursive: true });

  if (modo === "antes") {
    const snapshotAtual = await coletarSnapshotCompleto();
    await writeFile(ARQUIVO_SNAPSHOT, `${JSON.stringify(snapshotAtual, null, 2)}\n`, "utf8");
    console.log("");
    console.log(`[verificar-dinheiro] OK -> snapshot "antes" salvo em ${ARQUIVO_SNAPSHOT}`);
    console.log("[verificar-dinheiro] Nenhuma escrita foi feita em nenhum banco (leitura somente).");
    return;
  }

  // modo === "depois"
  const snapshotAtual = await coletarSnapshotCompleto();
  const todasDivergencias = await compararComoDepois(snapshotAtual);

  console.log("");
  if (todasDivergencias.length === 0) {
    console.log(
      "[verificar-dinheiro] OK -> nenhuma divergencia entre antes e depois. Migracao preservou toda soma em centavos " +
        "(e cada linha arredondada mudou menos que meia unidade)."
    );
    return;
  }

  console.error(`[verificar-dinheiro] FALHA -> ${todasDivergencias.length} divergencia(s):`);
  for (const divergencia of todasDivergencias) {
    console.error(`  - ${divergencia}`);
  }
  console.error("");
  process.exit(1);
}

principal().catch((erro) => {
  console.error("");
  console.error(`[erro] Falha inesperada em verificar-dinheiro: ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
