// npm run db:reparar-os -- --acao <arquivar|entregar|recalcular-garantia> --ids <id,id,...> --motivo "<texto>"
//
// ESCREVE no banco. So roda com AMBIENTE definido, CONFIRMAR=SIM,
// PONTO_RESTAURACAO=<branch Neon criado a partir do banco alvo como ponto de
// restauracao> e recusa "-pooler". Nao faz pg_dump nenhum: quem cria o
// branch e o operador, antes de rodar. Le docs/diagnostico/reparo-os.json
// (gerado por
// scripts/reparo/relatorio-os-inconsistentes.mjs, que precisa ter rodado
// antes) para duas coisas:
//   1. as datas e a elegibilidade JA DECIDIDAS pelo relatorio — este script
//      nunca recalcula nada de novo, so aplica o que o relatorio registrou;
//   2. a checagem otimista: se o "atualizadoEm" atual da OS (ou do termo, em
//      recalcular-garantia) nao bate mais com o que o relatorio registrou, o
//      id e recusado com instrucao para gerar o relatorio de novo.
//
// --ids aceita SOMENTE uma lista explicita de ids separados por virgula.
// "all"/"todos" nunca e aceito.
//
// Cada OS/termo roda na sua PROPRIA transacao. Uma falha num id nao desfaz o
// que ja foi aplicado nos anteriores, e os ids seguintes ainda sao tentados
// (cada um e independente — ao contrario do runner de migrations, aqui nao
// ha uma ordem de dependencia entre as OS).
//
// arquivar/entregar reusam avaliarFinalizacao (lib/dominio/os/regras-finalizacao.ts)
// — a MESMA funcao pura que app/actions/os.ts:finalizarOrdemServico usa —
// indiretamente: a decisao ja foi tomada pelo relatorio com essa funcao, e
// este script so executa o que ela decidiu. Nenhuma regra de negocio e
// reimplementada aqui.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { registrarLogAuditoria } from "../../lib/auditoria.ts";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "../../lib/auditoria-constantes.ts";
import { extrairHostMascarado, mascararConnectionString, recusarPooler } from "../lib/conexao-somente-leitura.mjs";
import { adicionarDias } from "../lib/reparo-os.mjs";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const CAMINHO_RELATORIO_JSON = path.resolve(process.cwd(), "docs", "diagnostico", "reparo-os.json");
const ACOES_VALIDAS = ["arquivar", "entregar", "recalcular-garantia"];
const ORIGEM_AUDITORIA = "scripts/reparo/aplicar-reparo-os.mjs";

function lerArgumentos(argv) {
  const valores = {};
  for (let indice = 0; indice < argv.length; indice += 1) {
    const atual = argv[indice];
    if (atual.startsWith("--")) {
      valores[atual.slice(2)] = argv[indice + 1];
      indice += 1;
    }
  }
  return valores;
}

function imprimirUso() {
  console.log("Uso:");
  console.log(
    '  node scripts/reparo/aplicar-reparo-os.mjs --acao <arquivar|entregar|recalcular-garantia> --ids <id,id,...> --motivo "<texto>"'
  );
  console.log("");
  console.log("Exemplo:");
  console.log(
    '  AMBIENTE=producao CONFIRMAR=SIM PONTO_RESTAURACAO=pre-reparo-os-20260917 npm run db:reparar-os -- --acao arquivar --ids abc,def --motivo "Reparo Fase 1C-1 grupo A"'
  );
  console.log("");
  console.log("Requer docs/diagnostico/reparo-os.json (rode \"npm run db:relatorio-os\" antes).");
}

function linhaResultado(id, resultado, detalhe = "") {
  return { id, resultado, detalhe };
}

function encontrarSnapshot(relatorio, grupo, chave, valor) {
  return (relatorio[grupo] ?? []).find((item) => item[chave] === valor) ?? null;
}

function checarOsInalterada(osAtual, snapshot) {
  const atualIso = osAtual.atualizadoEm.toISOString();
  const snapshotIso = new Date(snapshot.atualizadoEmSnapshot).toISOString();

  if (atualIso !== snapshotIso) {
    return 'REJEITADO: a OS foi alterada desde o relatorio ("atualizadoEm" mudou). Rode "npm run db:relatorio-os" de novo.';
  }
  if (osAtual.excluidaEm) {
    return "REJEITADO: a OS foi excluida logicamente desde o relatorio.";
  }
  return null;
}

function textoGarantiaRetroativo({ numeroOs, cliente, prazoGarantiaDias, dataInicioGarantia, dataFimGarantia, motivo }) {
  return [
    `TERMO DE GARANTIA GERADO RETROATIVAMENTE por ${ORIGEM_AUDITORIA}.`,
    `OS #${numeroOs}${cliente ? ` — cliente: ${cliente}` : ""}.`,
    `Prazo de garantia: ${prazoGarantiaDias} dias, de ${dataInicioGarantia.toISOString()} a ${dataFimGarantia.toISOString()}.`,
    `Motivo do reparo: ${motivo}`,
    "",
    "Este termo foi gerado por um reparo de dados (Fase 1C-1) porque a OS estava",
    "ENTREGUE (ou passou a ENTREGUE neste reparo) sem termo de garantia associado.",
    "Ver docs/diagnostico/reparo-os.md para o contexto completo.",
  ].join("\n");
}

async function aplicarFinalizacao(prisma, { snapshot, osId, motivo, novoStatus, dataDecidida, fonteData }) {
  const osAtual = await prisma.ordemServico.findUnique({
    where: { id: osId },
    select: {
      id: true,
      numeroOs: true,
      status: true,
      archivedAt: true,
      atualizadoEm: true,
      excluidaEm: true,
      cliente: { select: { nomeRazaoSocial: true } },
      termoGarantia: { select: { id: true } },
    },
  });

  if (!osAtual) {
    return linhaResultado(osId, "REJEITADO", "OS nao encontrada mais no banco.");
  }

  const erroEstado = checarOsInalterada(osAtual, snapshot);
  if (erroEstado) {
    return linhaResultado(osId, "REJEITADO", erroEstado);
  }

  const deveGerarTermo = snapshot.avaliacao.deveGerarTermo;
  const prazoGarantiaEfetivo = snapshot.avaliacao.prazoGarantiaEfetivo;

  const termoGarantiaId = await prisma.$transaction(async (tx) => {
    let termoId = osAtual.termoGarantia?.id ?? null;

    if (deveGerarTermo) {
      const dataFim = adicionarDias(dataDecidida, prazoGarantiaEfetivo);
      const termo = await tx.termoGarantiaOS.create({
        data: {
          osId,
          prazoGarantiaDias: prazoGarantiaEfetivo,
          dataInicioGarantia: dataDecidida,
          dataFimGarantia: dataFim,
          textoGarantia: textoGarantiaRetroativo({
            numeroOs: osAtual.numeroOs,
            cliente: osAtual.cliente?.nomeRazaoSocial ?? "",
            prazoGarantiaDias: prazoGarantiaEfetivo,
            dataInicioGarantia: dataDecidida,
            dataFimGarantia: dataFim,
            motivo,
          }),
        },
        select: { id: true },
      });

      termoId = termo.id;

      await registrarLogAuditoria(
        tx,
        { origem: ORIGEM_AUDITORIA },
        {
          acao: ACOES_AUDITORIA.GERAR_TERMO_GARANTIA,
          entidade: ENTIDADES_AUDITORIA.TERMO_GARANTIA_OS,
          entidadeId: termo.id,
          dadosDepois: {
            osId,
            prazoGarantiaDias: prazoGarantiaEfetivo,
            dataInicioGarantia: dataDecidida.toISOString(),
            dataFimGarantia: dataFim.toISOString(),
            geradoPeloReparo: true,
          },
          motivo,
        }
      );
    }

    await tx.ordemServico.update({
      where: { id: osId },
      data: {
        status: novoStatus,
        archivedAt: dataDecidida,
        ...(deveGerarTermo ? { prazoGarantiaDias: prazoGarantiaEfetivo } : {}),
      },
    });

    await registrarLogAuditoria(
      tx,
      { origem: ORIGEM_AUDITORIA },
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: osId,
        dadosAntes: {
          status: osAtual.status,
          archivedAt: osAtual.archivedAt ? osAtual.archivedAt.toISOString() : null,
          possuiTermoGarantia: osAtual.termoGarantia !== null,
        },
        dadosDepois: {
          status: novoStatus,
          archivedAt: dataDecidida.toISOString(),
          termoGarantiaId: termoId,
          fonteData,
          reparo: true,
        },
        motivo,
      }
    );

    return termoId;
  });

  return linhaResultado(
    osId,
    "OK",
    `status=${novoStatus} archivedAt=${dataDecidida.toISOString()}${deveGerarTermo ? ` termoGerado=${termoGarantiaId}` : ""}`
  );
}

async function aplicarArquivar(prisma, relatorio, osId, motivo) {
  const snapshot = encontrarSnapshot(relatorio, "grupoA", "osId", osId);

  if (!snapshot) {
    return linhaResultado(osId, "REJEITADO", 'id nao encontrado no grupo A do relatorio. Rode "npm run db:relatorio-os" de novo.');
  }
  if (!snapshot.avaliacao.podeAplicar) {
    const motivos = snapshot.avaliacao.pendencias.map((p) => p.mensagem).join(" ");
    return linhaResultado(osId, "REJEITADO", `regras de finalizacao bloqueiam esta OS: ${motivos}`);
  }

  return aplicarFinalizacao(prisma, {
    snapshot,
    osId,
    motivo,
    novoStatus: snapshot.status,
    dataDecidida: new Date(snapshot.arquivarEm.valor),
    fonteData: snapshot.arquivarEm.fonte,
  });
}

async function aplicarEntregar(prisma, relatorio, osId, motivo) {
  const snapshot = encontrarSnapshot(relatorio, "grupoB", "osId", osId);

  if (!snapshot) {
    return linhaResultado(osId, "REJEITADO", 'id nao encontrado no grupo B do relatorio. Rode "npm run db:relatorio-os" de novo.');
  }
  if (!snapshot.avaliacao.podeAplicar) {
    const motivos = snapshot.avaliacao.pendencias.map((p) => p.mensagem).join(" ");
    return linhaResultado(osId, "REJEITADO", `regras de finalizacao bloqueiam esta OS: ${motivos}`);
  }
  if (!snapshot.entregarEm.valor) {
    return linhaResultado(osId, "REJEITADO", "relatorio nao tem data de entrega decidida para esta OS (sem auditoria e sem pagamento com data).");
  }

  return aplicarFinalizacao(prisma, {
    snapshot,
    osId,
    motivo,
    novoStatus: "ENTREGUE",
    dataDecidida: new Date(snapshot.entregarEm.valor),
    fonteData: snapshot.entregarEm.fonte,
  });
}

async function aplicarRecalcularGarantia(prisma, relatorio, termoId, motivo) {
  const snapshot = encontrarSnapshot(relatorio, "grupoC", "termoId", termoId);

  if (!snapshot) {
    return linhaResultado(termoId, "REJEITADO", 'id nao encontrado no grupo C do relatorio. Rode "npm run db:relatorio-os" de novo.');
  }
  if (!snapshot.podeRecalcular) {
    return linhaResultado(termoId, "REJEITADO", snapshot.motivoSeNaoPode ?? "relatorio marcou este termo como nao recalculavel.");
  }

  const termoAtual = await prisma.termoGarantiaOS.findUnique({
    where: { id: termoId },
    select: { id: true, osId: true, dataInicioGarantia: true, dataFimGarantia: true, atualizadoEm: true, canceladaEm: true },
  });

  if (!termoAtual) {
    return linhaResultado(termoId, "REJEITADO", "termo nao encontrado mais no banco.");
  }
  if (termoAtual.canceladaEm) {
    return linhaResultado(termoId, "REJEITADO", "termo foi cancelado desde o relatorio.");
  }

  const snapshotAtualizadoEm = new Date(snapshot.termoAtualizadoEmSnapshot);
  if (termoAtual.atualizadoEm.toISOString() !== snapshotAtualizadoEm.toISOString()) {
    return linhaResultado(termoId, "REJEITADO", 'o termo foi alterado desde o relatorio ("atualizadoEm" mudou). Rode "npm run db:relatorio-os" de novo.');
  }

  const novaDataInicio = new Date(snapshot.dataInicioGarantiaRecalculada);
  const novaDataFim = new Date(snapshot.dataFimGarantiaRecalculada);

  await prisma.$transaction(async (tx) => {
    await tx.termoGarantiaOS.update({
      where: { id: termoId },
      data: { dataInicioGarantia: novaDataInicio, dataFimGarantia: novaDataFim },
    });

    await registrarLogAuditoria(
      tx,
      { origem: ORIGEM_AUDITORIA },
      {
        acao: ACOES_AUDITORIA.AJUSTAR_TERMO_GARANTIA,
        entidade: ENTIDADES_AUDITORIA.TERMO_GARANTIA_OS,
        entidadeId: termoId,
        dadosAntes: {
          dataInicioGarantia: termoAtual.dataInicioGarantia.toISOString(),
          dataFimGarantia: termoAtual.dataFimGarantia.toISOString(),
        },
        dadosDepois: {
          dataInicioGarantia: novaDataInicio.toISOString(),
          dataFimGarantia: novaDataFim.toISOString(),
          reparo: true,
        },
        motivo,
      }
    );
  });

  return linhaResultado(
    termoId,
    "OK",
    `dataInicioGarantia ${termoAtual.dataInicioGarantia.toISOString()} -> ${novaDataInicio.toISOString()}`
  );
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2));
  const acao = String(args.acao ?? "").trim();
  const idsBrutos = String(args.ids ?? "").trim();
  const motivo = String(args.motivo ?? "").trim();

  if (!ACOES_VALIDAS.includes(acao)) {
    imprimirUso();
    throw new Error(`--acao deve ser um de: ${ACOES_VALIDAS.join(", ")}.`);
  }

  if (!idsBrutos || ["all", "todos", "*"].includes(idsBrutos.toLowerCase())) {
    imprimirUso();
    throw new Error('--ids e obrigatorio e precisa listar ids especificos, separados por virgula. "all"/"todos" nao e aceito.');
  }

  const ids = [...new Set(idsBrutos.split(",").map((id) => id.trim()).filter(Boolean))];

  if (ids.length === 0) {
    imprimirUso();
    throw new Error("--ids nao contem nenhum id valido.");
  }

  if (motivo.length < 10) {
    imprimirUso();
    throw new Error("--motivo e obrigatorio e precisa ter pelo menos 10 caracteres.");
  }

  const ambiente = String(process.env.AMBIENTE ?? "").trim();

  if (!ambiente) {
    throw new Error('AMBIENTE nao definido no seu .env. Defina para o ambiente real (ex.: "producao") antes de rodar este script.');
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || !databaseUrl.trim()) {
    throw new Error("DATABASE_URL nao definida no seu .env.");
  }

  recusarPooler(databaseUrl, "DATABASE_URL");

  const pontoRestauracao = String(process.env.PONTO_RESTAURACAO ?? "").trim();

  console.log("");
  console.log("Reparo de OS");
  console.log(`  Ambiente : ${ambiente}`);
  console.log(`  Banco    : ${mascararConnectionString(databaseUrl)}`);
  console.log(`  Host     : ${extrairHostMascarado(databaseUrl)}`);
  console.log(`  Restauracao : ${pontoRestauracao || "(nao definido)"}`);
  console.log(`  Acao     : ${acao}`);
  console.log(`  Ids      : ${ids.join(", ")}`);
  console.log(`  Motivo   : ${motivo}`);
  console.log("");

  if (process.env.CONFIRMAR !== "SIM") {
    console.log("Nada foi alterado. Para confirmar, rode de novo com CONFIRMAR=SIM.");
    console.log("");
    imprimirUso();
    return;
  }

  if (!pontoRestauracao) {
    console.error("");
    console.error("[erro] ABORTADO: CONFIRMAR=SIM exige tambem PONTO_RESTAURACAO=<nome do branch Neon> no ambiente.");
    console.error(
      "[erro] Crie, no console da Neon, um branch a partir do banco alvo (ponto de restauracao) e passe o nome dele em PONTO_RESTAURACAO antes de rodar."
    );
    console.error("");
    process.exit(1);
  }

  let relatorio;

  try {
    relatorio = JSON.parse(await readFile(CAMINHO_RELATORIO_JSON, "utf8"));
  } catch (erro) {
    throw new Error(
      `Nao foi possivel ler ${CAMINHO_RELATORIO_JSON}. Rode "npm run db:relatorio-os" primeiro. (${erro instanceof Error ? erro.message : String(erro)})`
    );
  }

  const prisma = new PrismaOperacional({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
    log: ["error"],
  });

  const resultados = [];

  try {
    for (const id of ids) {
      const resultado =
        acao === "arquivar"
          ? await aplicarArquivar(prisma, relatorio, id, motivo)
          : acao === "entregar"
            ? await aplicarEntregar(prisma, relatorio, id, motivo)
            : await aplicarRecalcularGarantia(prisma, relatorio, id, motivo);

      resultados.push(resultado);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("Resultado");
  console.table(resultados);

  if (resultados.some((linha) => linha.resultado !== "OK")) {
    process.exit(1);
  }
}

main().catch((erro) => {
  console.error("");
  console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
