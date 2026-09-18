// npm run db:relatorio-os
//
// SOMENTE LEITURA (conexao trava em transaction read-only, como o resto do
// ferramental de diagnostico). Gera:
//   docs/diagnostico/reparo-os.md    leitura humana
//   docs/diagnostico/reparo-os.json  leitura por scripts/reparo/aplicar-reparo-os.mjs
//     (guarda o snapshot de atualizadoEm de cada OS/termo, usado la para a
//     checagem otimista antes de qualquer escrita)
//
// Tres grupos, decorrentes do diagnostico de producao (docs/diagnostico/principal.md
// secao 5):
//   A. status ENTREGUE e archivedAt NULL              -> sugere "arquivar"
//   B. PRONTO, com pagamento confirmado e termo ativo  -> sugere "entregar"
//   C. termo cujo dataInicioGarantia bate (± alguns segundos) com um evento
//      de auditoria que NAO foi a entrega — o bug historico descrito em
//      app/actions/garantias.ts (corrigido pela Fase 1A: a emissao do termo
//      saiu da previa em PRONTO e passou a acontecer so em finalizarOrdemServico,
//      ancorada na entrega real) -> so relatorio, NUNCA corrige sozinho.
//
// As decisoes de elegibilidade (pode arquivar? pode entregar?) vem de
// avaliarFinalizacao, em lib/dominio/os/regras-finalizacao.ts — a MESMA
// funcao pura que app/actions/os.ts:finalizarOrdemServico usa. Nada da regra
// de negocio e reimplementado aqui.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { avaliarFinalizacao } from "../../lib/dominio/os/regras-finalizacao.ts";
import { obterDefaultsConfiguracaoOsGarantias } from "../../lib/configuracoes-os-garantias.ts";
import {
  abrirConexaoSomenteLeitura,
  extrairHostMascarado,
  mascararConnectionString,
} from "../lib/conexao-somente-leitura.mjs";
import {
  LIMIAR_HORAS_RECALCULO_GARANTIA,
  TOLERANCIA_SEGUNDOS_EVENTO,
  adicionarDias,
  buscarItensParaAvaliacao,
  buscarPagamentoConfirmado,
  buscarTermoAtivo,
  buscarUltimaTransicaoEntregue,
  buscarVendaVinculada,
  configurarParserTimestampUtc,
  formatarDataHora,
  tabelaMarkdown,
} from "../lib/reparo-os.mjs";

const LIMIAR_MS_RECALCULO_GARANTIA = LIMIAR_HORAS_RECALCULO_GARANTIA * 60 * 60 * 1000;

// Ver o comentario de configurarParserTimestampUtc em scripts/lib/reparo-os.mjs:
// sem isto, o snapshot que este script grava em reparo-os.json (lido via
// `pg`) fica 3h deslocado em relacao ao que scripts/reparo/aplicar-reparo-os.mjs
// le da MESMA linha via Prisma, e a checagem otimista rejeitaria tudo.
configurarParserTimestampUtc();

const PASTA_SAIDA = path.resolve(process.cwd(), "docs", "diagnostico");
const CAMINHO_MD = path.join(PASTA_SAIDA, "reparo-os.md");
const CAMINHO_JSON = path.join(PASTA_SAIDA, "reparo-os.json");

async function carregarRegrasFinalizacao(cliente) {
  const defaults = obterDefaultsConfiguracaoOsGarantias();

  const resultado = await cliente.query(
    `SELECT "exigirItemParaGarantia", "prazoGarantiaPadraoDias", "prazoMinimoGarantiaDias",
            "prazoMaximoGarantiaDias", "exigirDiagnosticoParaFinalizar", "permitirFinalizarSemPagamento"
       FROM "Configuracao"
      ORDER BY "criadoEm" ASC
      LIMIT 1`
  );

  const linha = resultado.rows[0] ?? {};

  return {
    exigirItemParaGarantia: linha.exigirItemParaGarantia ?? defaults.exigirItemParaGarantia,
    exigirDiagnosticoParaFinalizar: linha.exigirDiagnosticoParaFinalizar ?? defaults.exigirDiagnosticoParaFinalizar,
    permitirFinalizarSemPagamento: linha.permitirFinalizarSemPagamento ?? defaults.permitirFinalizarSemPagamento,
    prazoGarantiaPadraoDias: linha.prazoGarantiaPadraoDias ?? defaults.prazoGarantiaPadraoDias,
    prazoMinimoGarantiaDias: linha.prazoMinimoGarantiaDias ?? defaults.prazoMinimoGarantiaDias,
    prazoMaximoGarantiaDias: linha.prazoMaximoGarantiaDias ?? defaults.prazoMaximoGarantiaDias,
  };
}

async function buscarCandidatosGrupoA(cliente) {
  const resultado = await cliente.query(
    `SELECT os.id, os."numeroOs", os.status, os."archivedAt", os."criadoEm", os."atualizadoEm",
            os."excluidaEm", os."ehRetornoGarantia", os.observacoes
       FROM "OrdemServico" os
      WHERE os.status = 'ENTREGUE'
        AND os."archivedAt" IS NULL
        AND os."excluidaEm" IS NULL
      ORDER BY os."numeroOs" ASC`
  );
  return resultado.rows;
}

async function buscarCandidatosGrupoB(cliente) {
  const resultado = await cliente.query(
    `SELECT DISTINCT os.id, os."numeroOs", os.status, os."archivedAt", os."criadoEm", os."atualizadoEm",
            os."excluidaEm", os."ehRetornoGarantia", os.observacoes
       FROM "OrdemServico" os
       JOIN "TermoGarantiaOS" tg ON tg."osId" = os.id AND tg."canceladaEm" IS NULL
       JOIN "ContaReceber" cr ON cr."ordemServicoId" = os.id AND cr.status IN ('PAGO', 'RECEBIDO')
      WHERE os.status = 'PRONTO'
        AND os."excluidaEm" IS NULL
      ORDER BY os."numeroOs" ASC`
  );
  return resultado.rows;
}

async function buscarCandidatosGrupoC(cliente) {
  const resultado = await cliente.query(
    `SELECT t.id AS termo_id, t."osId" AS os_id, os."numeroOs" AS numero_os, os.status AS os_status,
            t."dataInicioGarantia" AS data_inicio_atual, t."dataFimGarantia" AS data_fim_atual,
            t."prazoGarantiaDias" AS prazo_dias, t."atualizadoEm" AS termo_atualizado_em,
            evento.id AS evento_id, evento."criadoEm" AS evento_criado_em, evento.status AS evento_status
       FROM "TermoGarantiaOS" t
       JOIN "OrdemServico" os ON os.id = t."osId"
       JOIN LATERAL (
            SELECT la.id, la."criadoEm", la."dadosDepois" ->> 'status' AS status
              FROM "LogAuditoria" la
             WHERE la.entidade = 'ORDEM_SERVICO'
               AND la."entidadeId" = t."osId"
               AND la."dadosDepois" ->> 'status' IS NOT NULL
               AND la."dadosDepois" ->> 'status' <> 'ENTREGUE'
               AND ABS(EXTRACT(EPOCH FROM (la."criadoEm" - t."dataInicioGarantia"))) <= ${TOLERANCIA_SEGUNDOS_EVENTO}
             ORDER BY ABS(EXTRACT(EPOCH FROM (la."criadoEm" - t."dataInicioGarantia"))) ASC
             LIMIT 1
       ) evento ON true
      WHERE t."canceladaEm" IS NULL
        AND os."excluidaEm" IS NULL
      ORDER BY os."numeroOs" ASC`
  );
  return resultado.rows;
}

async function avaliarGrupoA(cliente, os, regras) {
  const termo = await buscarTermoAtivo(cliente, os.id);
  const pagamento = await buscarPagamentoConfirmado(cliente, os.id);
  const itens = await buscarItensParaAvaliacao(cliente, os.id);
  const possuiVendaVinculada = await buscarVendaVinculada(cliente, os.id);
  const ultimaEntrega = await buscarUltimaTransicaoEntregue(cliente, os.id);

  const avaliacao = avaliarFinalizacao({
    status: os.status,
    ehRetornoGarantia: os.ehRetornoGarantia,
    excluidaEm: os.excluidaEm,
    archivedAt: os.archivedAt,
    possuiTermoGarantia: termo !== null,
    itens,
    observacoes: os.observacoes,
    possuiPagamentoConfirmado: pagamento !== null,
    possuiVendaVinculada,
    regras,
  });

  const arquivarEm = ultimaEntrega
    ? { valor: ultimaEntrega.criadoEm, fonte: "AUDITORIA", logId: ultimaEntrega.logId }
    : { valor: os.criadoEm, fonte: "ESTIMADO_CRIADO_EM", logId: null };

  return {
    osId: os.id,
    numeroOs: os.numeroOs,
    status: os.status,
    archivedAt: os.archivedAt,
    criadoEm: os.criadoEm,
    atualizadoEmSnapshot: os.atualizadoEm,
    termo: termo && { id: termo.id, dataInicioGarantia: termo.dataInicioGarantia, dataFimGarantia: termo.dataFimGarantia, atualizadoEmSnapshot: termo.atualizadoEm },
    pagamentoConfirmado: pagamento,
    ultimaTransicaoEntregueAuditada: ultimaEntrega,
    avaliacao: { podeAplicar: avaliacao.podeFinalizar, pendencias: avaliacao.pendencias, deveGerarTermo: avaliacao.deveGerarTermo, prazoGarantiaEfetivo: avaliacao.prazoGarantiaEfetivo },
    acaoSugerida: "arquivar",
    arquivarEm,
  };
}

async function avaliarGrupoB(cliente, os, regras) {
  const termo = await buscarTermoAtivo(cliente, os.id);
  const pagamento = await buscarPagamentoConfirmado(cliente, os.id);
  const itens = await buscarItensParaAvaliacao(cliente, os.id);
  const possuiVendaVinculada = await buscarVendaVinculada(cliente, os.id);
  const ultimaEntrega = await buscarUltimaTransicaoEntregue(cliente, os.id);

  const avaliacao = avaliarFinalizacao({
    status: os.status,
    ehRetornoGarantia: os.ehRetornoGarantia,
    excluidaEm: os.excluidaEm,
    archivedAt: os.archivedAt,
    possuiTermoGarantia: termo !== null,
    itens,
    observacoes: os.observacoes,
    possuiPagamentoConfirmado: pagamento !== null,
    possuiVendaVinculada,
    regras,
  });

  const entregarEm = ultimaEntrega
    ? { valor: ultimaEntrega.criadoEm, fonte: "AUDITORIA", logId: ultimaEntrega.logId }
    : { valor: pagamento?.ultimaData ?? null, fonte: "DATA_PAGAMENTO", logId: null };

  return {
    osId: os.id,
    numeroOs: os.numeroOs,
    status: os.status,
    archivedAt: os.archivedAt,
    criadoEm: os.criadoEm,
    atualizadoEmSnapshot: os.atualizadoEm,
    termo: termo && { id: termo.id, dataInicioGarantia: termo.dataInicioGarantia, dataFimGarantia: termo.dataFimGarantia, atualizadoEmSnapshot: termo.atualizadoEm },
    pagamentoConfirmado: pagamento,
    ultimaTransicaoEntregueAuditada: ultimaEntrega,
    avaliacao: { podeAplicar: avaliacao.podeFinalizar, pendencias: avaliacao.pendencias, deveGerarTermo: avaliacao.deveGerarTermo, prazoGarantiaEfetivo: avaliacao.prazoGarantiaEfetivo },
    acaoSugerida: "entregar",
    entregarEm,
  };
}

function motivoSeNaoPodeRecalcular(ultimaEntrega, diferencaMs, dataInicioAtual) {
  if (ultimaEntrega === null) {
    return "sem transicao ENTREGUE auditada para esta OS";
  }
  if (diferencaMs <= 0) {
    return `a entrega auditada (${formatarDataHora(ultimaEntrega.criadoEm)}) nao e posterior ao inicio de garantia atual (${formatarDataHora(dataInicioAtual)}) — recalcular encurtaria ou nao mudaria a garantia, e isso nunca e permitido`;
  }
  if (diferencaMs <= LIMIAR_MS_RECALCULO_GARANTIA) {
    return `a entrega auditada (${formatarDataHora(ultimaEntrega.criadoEm)}) e so ${(diferencaMs / 3_600_000).toFixed(1)}h posterior ao inicio atual (${formatarDataHora(dataInicioAtual)}) — abaixo do limiar de ${LIMIAR_HORAS_RECALCULO_GARANTIA}h, tratado como ruido e nao como o bug historico`;
  }
  return null;
}

/**
 * So sugere recalculo quando a entrega auditada e mais de
 * LIMIAR_HORAS_RECALCULO_GARANTIA horas POSTERIOR ao dataInicioGarantia atual
 * (ver o comentario da constante em scripts/lib/reparo-os.mjs) — nunca quando
 * e anterior, igual, ou proxima demais pra ser ruido. Como o prazo em dias
 * nao muda, isso tambem garante que dataFimGarantia so pode mover pra frente:
 * a garantia nunca encurta.
 */
async function avaliarGrupoC(cliente, linha) {
  const osId = String(linha.os_id);
  const ultimaEntrega = await buscarUltimaTransicaoEntregue(cliente, osId);
  const prazoDias = Number(linha.prazo_dias);
  const dataInicioAtual = new Date(linha.data_inicio_atual);

  const diferencaMs = ultimaEntrega ? ultimaEntrega.criadoEm.getTime() - dataInicioAtual.getTime() : null;
  const podeRecalcular = ultimaEntrega !== null && diferencaMs > LIMIAR_MS_RECALCULO_GARANTIA;

  const dataInicioRecalculada = podeRecalcular ? ultimaEntrega.criadoEm : null;
  const dataFimRecalculada = podeRecalcular ? adicionarDias(ultimaEntrega.criadoEm, prazoDias) : null;

  return {
    termoId: String(linha.termo_id),
    osId,
    numeroOs: Number(linha.numero_os),
    statusOsAtual: linha.os_status,
    prazoGarantiaDias: prazoDias,
    dataInicioGarantiaAtual: dataInicioAtual,
    dataFimGarantiaAtual: new Date(linha.data_fim_atual),
    termoAtualizadoEmSnapshot: new Date(linha.termo_atualizado_em),
    eventoNaoEntregueDetectado: { logId: String(linha.evento_id), status: linha.evento_status, criadoEm: new Date(linha.evento_criado_em) },
    ultimaTransicaoEntregueAuditada: ultimaEntrega,
    dataInicioGarantiaRecalculada: dataInicioRecalculada,
    dataFimGarantiaRecalculada: dataFimRecalculada,
    podeRecalcular,
    motivoSeNaoPode: motivoSeNaoPodeRecalcular(ultimaEntrega, diferencaMs, dataInicioAtual),
  };
}

function fmtSugestaoAB(item) {
  if (!item.avaliacao.podeAplicar) {
    const motivos = item.avaliacao.pendencias.map((p) => p.codigo).join(", ");
    return `${item.acaoSugerida} — BLOQUEADO pelas regras de finalizacao (${motivos})`;
  }
  return item.acaoSugerida;
}

function montarLinhaAB(item) {
  const dataDecidida = item.acaoSugerida === "arquivar" ? item.arquivarEm : item.entregarEm;
  return {
    numeroOs: item.numeroOs,
    id: item.osId,
    status: item.status,
    archivedAt: item.archivedAt ? formatarDataHora(item.archivedAt) : "",
    criadoEm: formatarDataHora(item.criadoEm),
    atualizadoEm: formatarDataHora(item.atualizadoEmSnapshot),
    termo: item.termo ? `${formatarDataHora(item.termo.dataInicioGarantia)} -> ${formatarDataHora(item.termo.dataFimGarantia)}` : "(sem termo)",
    pagamentoConfirmado: item.pagamentoConfirmado
      ? `R$ ${item.pagamentoConfirmado.valorTotal.toFixed(2)} em ${formatarDataHora(item.pagamentoConfirmado.ultimaData)}`
      : "(nenhum)",
    ultimaEntregaAuditada: item.ultimaTransicaoEntregueAuditada ? formatarDataHora(item.ultimaTransicaoEntregueAuditada.criadoEm) : "(sem evento auditado)",
    acaoSugerida: `${fmtSugestaoAB(item)} [data: ${dataDecidida.valor ? formatarDataHora(dataDecidida.valor) : "?"} / ${dataDecidida.fonte}]`,
  };
}

function montarLinhaC(item) {
  return {
    numeroOs: item.numeroOs,
    termoId: item.termoId,
    osId: item.osId,
    statusOsAtual: item.statusOsAtual,
    dataInicioAtual: formatarDataHora(item.dataInicioGarantiaAtual),
    dataFimAtual: formatarDataHora(item.dataFimGarantiaAtual),
    eventoNaoEntregueDetectado: `${item.eventoNaoEntregueDetectado.status} em ${formatarDataHora(item.eventoNaoEntregueDetectado.criadoEm)}`,
    ultimaEntregaAuditada: item.ultimaTransicaoEntregueAuditada ? formatarDataHora(item.ultimaTransicaoEntregueAuditada.criadoEm) : "(nenhuma)",
    dataInicioRecalculada: item.dataInicioGarantiaRecalculada ? formatarDataHora(item.dataInicioGarantiaRecalculada) : "",
    dataFimRecalculada: item.dataFimGarantiaRecalculada ? formatarDataHora(item.dataFimGarantiaRecalculada) : "",
    podeRecalcular: item.podeRecalcular ? "sim" : `nao (${item.motivoSeNaoPode})`,
  };
}

function montarMarkdown({ geradoEm, host, grupoA, grupoB, grupoC }) {
  const linhasA = grupoA.map(montarLinhaAB);
  const linhasB = grupoB.map(montarLinhaAB);
  const linhasC = grupoC.map(montarLinhaC);

  return `# Relatorio de OS inconsistentes (reparo)

Gerado em: ${geradoEm.toString()}
Banco: ${host}

**Somente leitura. Nenhum dado foi alterado para gerar este relatorio.**

Companheiro de \`reparo-os.json\`, que guarda o snapshot de \`atualizadoEm\` usado
pela checagem otimista de \`scripts/reparo/aplicar-reparo-os.mjs\` — regenere
este relatorio se qualquer uma das OS abaixo for alterada por outro caminho
antes de aplicar o reparo. Ver o cabecalho de cada script para o procedimento
completo.

## Metodologia

- **Grupo A** — \`status = 'ENTREGUE' AND "archivedAt" IS NULL\`. Sugestao:
  \`arquivar\`. Data decidida: a ultima transicao para ENTREGUE registrada em
  \`LogAuditoria\`; sem isso, uma estimativa a partir de \`criadoEm\` da OS,
  marcada como \`ESTIMADO_CRIADO_EM\`.
- **Grupo B** — \`status = 'PRONTO'\`, com um \`TermoGarantiaOS\` ativo e ao
  menos um \`ContaReceber\` com \`status IN ('PAGO','RECEBIDO')\`. Sugestao:
  \`entregar\`. Data decidida: a ultima transicao para ENTREGUE auditada; sem
  isso, a data do pagamento confirmado mais recente, marcada como
  \`DATA_PAGAMENTO\`.
- **Grupo C** — termos de garantia cujo \`dataInicioGarantia\` cai a no maximo
  ${TOLERANCIA_SEGUNDOS_EVENTO} segundo(s) de um evento de auditoria desta OS que
  **nao** foi uma transicao para ENTREGUE — a assinatura do bug historico
  descrito em \`app/actions/garantias.ts\` (a previa do termo, ate a Fase 1A,
  criava o termo ainda em PRONTO, ancorado no ultimo \`atualizadoEm\` da OS, em
  vez da entrega real). Nenhuma correcao e sugerida como certa: o relatorio so
  mostra o que a data **passaria a ser** se recalculada a partir da ultima
  entrega auditada desta OS, quando ela existe. \`podeRecalcular\` so fica
  \`true\` quando essa entrega auditada e mais de ${LIMIAR_HORAS_RECALCULO_GARANTIA}h
  **posterior** ao \`dataInicioGarantia\` atual do termo — nunca quando e
  anterior, igual, ou proxima demais pra ser ruido de relogio. Como o prazo em
  dias do termo nao muda, isso garante ao mesmo tempo que o recalculo nunca
  **encurta** a garantia: se o inicio so pode mover pra frente, o fim tambem
  so move pra frente.
- Elegibilidade (\`podeAplicar\`) para os grupos A e B vem de
  \`avaliarFinalizacao\` (\`lib/dominio/os/regras-finalizacao.ts\`) — a mesma
  funcao pura usada por \`finalizarOrdemServico\` em produção. Uma OS com
  pendencia (ex.: sem diagnostico, prazo de garantia invalido) aparece
  listada mesmo assim, mas marcada como BLOQUEADA — o script de aplicacao
  recusa essas ids.
- Todos os recortes ignoram OS logicamente excluidas (\`excluidaEm IS NOT NULL\`),
  mesmo criterio do diagnostico em \`docs/diagnostico/principal.md\` secao 5.

## Grupo A — ENTREGUE com archivedAt NULL

${linhasA.length} linha(s).

${tabelaMarkdown(linhasA, ["numeroOs", "id", "status", "archivedAt", "criadoEm", "atualizadoEm", "termo", "pagamentoConfirmado", "ultimaEntregaAuditada", "acaoSugerida"])}

## Grupo B — PRONTO com pagamento confirmado e termo de garantia

${linhasB.length} linha(s).

${tabelaMarkdown(linhasB, ["numeroOs", "id", "status", "archivedAt", "criadoEm", "atualizadoEm", "termo", "pagamentoConfirmado", "ultimaEntregaAuditada", "acaoSugerida"])}

## Grupo C — termo com dataInicioGarantia suspeita (possivel bug historico)

${linhasC.length} linha(s).

${tabelaMarkdown(linhasC, ["numeroOs", "termoId", "osId", "statusOsAtual", "dataInicioAtual", "dataFimAtual", "eventoNaoEntregueDetectado", "ultimaEntregaAuditada", "dataInicioRecalculada", "dataFimRecalculada", "podeRecalcular"])}

## Comandos de reparo

Os comandos abaixo usam os ids reais deste relatorio. Regenere o relatorio
(\`npm run db:relatorio-os\`) se a lista acima mudar antes de aplicar.

\`\`\`bash
# Grupo A — arquivar (uma ou mais ids, separadas por virgula)
AMBIENTE=<seu-ambiente> CONFIRMAR=SIM npm run db:reparar-os -- \\
  --acao arquivar --ids ${linhasA.map((l) => l.id).join(",") || "<id,id,...>"} \\
  --motivo "Reparo Fase 1C-1 grupo A: ENTREGUE sem archivedAt"

# Grupo B — entregar
AMBIENTE=<seu-ambiente> CONFIRMAR=SIM npm run db:reparar-os -- \\
  --acao entregar --ids ${linhasB.map((l) => l.id).join(",") || "<id,id,...>"} \\
  --motivo "Reparo Fase 1C-1 grupo B: PRONTO pago com termo"

# Grupo C — recalcular-garantia (ids sao de TermoGarantiaOS, nao de OS)
AMBIENTE=<seu-ambiente> CONFIRMAR=SIM npm run db:reparar-os -- \\
  --acao recalcular-garantia --ids ${linhasC.map((l) => l.termoId).join(",") || "<id,id,...>"} \\
  --motivo "Reparo Fase 1C-1 grupo C: dataInicioGarantia anterior a entrega"
\`\`\`
`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || !databaseUrl.trim()) {
    console.error("");
    console.error("[erro] DATABASE_URL nao definida no seu .env.");
    console.error("");
    process.exit(1);
  }

  console.log("");
  console.log("Relatorio de OS inconsistentes (somente leitura)");
  console.log(`  Banco: ${mascararConnectionString(databaseUrl)}`);
  console.log(`  Host : ${extrairHostMascarado(databaseUrl)}`);
  console.log("");

  const cliente = await abrirConexaoSomenteLeitura(databaseUrl, "DATABASE_URL");

  try {
    const regras = await carregarRegrasFinalizacao(cliente);

    const candidatosA = await buscarCandidatosGrupoA(cliente);
    const candidatosB = await buscarCandidatosGrupoB(cliente);
    const candidatosC = await buscarCandidatosGrupoC(cliente);

    const grupoA = [];
    for (const os of candidatosA) grupoA.push(await avaliarGrupoA(cliente, os, regras));

    const grupoB = [];
    for (const os of candidatosB) grupoB.push(await avaliarGrupoB(cliente, os, regras));

    const grupoC = [];
    for (const linha of candidatosC) grupoC.push(await avaliarGrupoC(cliente, linha));

    const geradoEm = new Date();
    const host = extrairHostMascarado(databaseUrl);

    await mkdir(PASTA_SAIDA, { recursive: true });
    await writeFile(
      CAMINHO_JSON,
      `${JSON.stringify({ geradoEm: geradoEm.toISOString(), bancoMascarado: mascararConnectionString(databaseUrl), grupoA, grupoB, grupoC }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(CAMINHO_MD, montarMarkdown({ geradoEm, host, grupoA, grupoB, grupoC }), "utf8");

    console.log(`Grupo A (ENTREGUE sem arquivar)  : ${grupoA.length}`);
    console.log(`Grupo B (PRONTO pago com termo)  : ${grupoB.length}`);
    console.log(`Grupo C (termo com data suspeita): ${grupoC.length}`);
    console.log("");
    console.log(`Relatorio: ${CAMINHO_MD}`);
    console.log(`Dados    : ${CAMINHO_JSON}`);
    console.log("");
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error("");
  console.error(`[erro] Falha inesperada no relatorio de OS: ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
