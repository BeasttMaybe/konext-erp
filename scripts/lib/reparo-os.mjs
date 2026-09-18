// Helpers compartilhados pelos scripts de reparo de OS
// (scripts/reparo/relatorio-os-inconsistentes.mjs e scripts/reparo/aplicar-reparo-os.mjs).
import { types } from "@neondatabase/serverless";
import { encontrarEntregaAuditada } from "../../lib/dominio/os/entrega-auditada.ts";

// Tolerancia usada para "este evento e o mesmo momento que aquele timestamp":
// o mesmo valor (2 segundos) ja usado em scripts/diagnostico/diagnosticar-tenants.mjs
// para comparar OrdemServico.atualizadoEm contra o ultimo evento de auditoria.
export const TOLERANCIA_SEGUNDOS_EVENTO = 2;

/**
 * Limiar minimo, em horas, para o Grupo C sugerir o recalculo de
 * dataInicioGarantia. So recalcula quando a entrega ENTREGUE auditada e mais
 * de LIMIAR_HORAS_RECALCULO_GARANTIA horas POSTERIOR ao dataInicioGarantia
 * atual do termo — nunca quando e anterior ou proxima o suficiente pra ser
 * ruido de fuso/relogio.
 *
 * Como dataFimGarantia = dataInicioGarantia + prazoGarantiaDias (prazo fixo),
 * exigir "entrega auditada > inicio atual + limiar" garante ao mesmo tempo as
 * duas regras exigidas pelo arquiteto: (1) so mexe quando a diferenca e
 * grande o bastante pra ser o bug historico, de verdade, e nao ruido; e (2) a
 * data recalculada NUNCA encurta a garantia — inicio so pode mover pra
 * frente, entao o fim tambem so move pra frente.
 */
export const LIMIAR_HORAS_RECALCULO_GARANTIA = 24;

const OID_TIMESTAMP_SEM_FUSO = 1114;

/**
 * Toda coluna DateTime deste schema e "timestamp without time zone" — o
 * Prisma NUNCA converte fuso horario nela: le o valor gravado como se ja
 * fosse UTC. O driver `pg`/`@neondatabase/serverless`, por padrao, faz o
 * OPOSTO — interpreta o valor como fuso horario LOCAL do processo e converte
 * para UTC. Num processo rodando em UTC-3 isso desloca toda leitura por essas
 * conexoes em 3 horas em relacao ao que o Prisma le da MESMA linha.
 *
 * Isso e inofensivo para os relatorios de diagnostico existentes (eles so
 * fazem `String(data)`, que reconverte para o fuso local na exibicao — os
 * dois deslocamentos se cancelam OS na tela). Mas quebra de verdade a
 * checagem otimista deste modulo: o relatorio grava um snapshot lido via
 * `pg`, e scripts/reparo/aplicar-reparo-os.mjs confere esse snapshot contra
 * uma leitura via Prisma — sem este ajuste, a comparacao SEMPRE dá diferente
 * mesmo quando nada mudou, e todo id seria rejeitado.
 *
 * Chame isto uma vez, antes de abrir qualquer conexao, em qualquer script
 * deste projeto que precise comparar um timestamp lido via `pg` com um lido
 * via Prisma. Efeito e por processo (Node), nunca vaza para outro script.
 */
export function configurarParserTimestampUtc() {
  types.setTypeParser(OID_TIMESTAMP_SEM_FUSO, (valor) => new Date(`${valor}Z`));
}

/**
 * Formata um DateTime deste schema para leitura humana, lendo os campos UTC
 * do Date diretamente (nunca convertendo para o fuso do processo) — mesma
 * convencao "trata o valor gravado como hora local do Brasil, sem conversao"
 * que o resto da aplicacao usa. Ao contrario de `String(data)`, isto exibe
 * igual não importa em que fuso horario o script estiver rodando.
 */
export function formatarDataHora(data) {
  if (data === null || data === undefined) return "";

  const valor = data instanceof Date ? data : new Date(data);
  const dia = String(valor.getUTCDate()).padStart(2, "0");
  const mes = String(valor.getUTCMonth() + 1).padStart(2, "0");
  const ano = valor.getUTCFullYear();
  const hora = String(valor.getUTCHours()).padStart(2, "0");
  const minuto = String(valor.getUTCMinutes()).padStart(2, "0");
  const segundo = String(valor.getUTCSeconds()).padStart(2, "0");

  return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
}

/**
 * Mesma logica de app/actions/garantias.ts (funcao local `adicionarDias`, nao
 * exportada — scripts .mjs nao importam de arquivos "use server", entao a
 * duplicacao aqui e proposital, igual ao restante de scripts/lib/*.mjs).
 */
export function adicionarDias(data, dias) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function tabelaMarkdown(linhas, colunas) {
  if (linhas.length === 0) {
    return "_Nenhuma linha._";
  }

  const cabecalho = `| ${colunas.join(" | ")} |`;
  const separador = `| ${colunas.map(() => "---").join(" | ")} |`;
  const corpo = linhas
    .map(
      (linha) =>
        `| ${colunas
          .map((coluna) => {
            const valor = linha[coluna];
            if (valor === null || valor === undefined || valor === "") return "";
            return String(valor).replace(/\|/g, "\\|").replace(/\n/g, " ");
          })
          .join(" | ")} |`
    )
    .join("\n");

  return `${cabecalho}\n${separador}\n${corpo}`;
}

/**
 * Entrega real desta OS, reconstruida da auditoria — usa a MESMA funcao pura
 * de `app/actions/os.ts:obterMomentoEntregaAuditado`
 * (lib/dominio/os/entrega-auditada.ts): a PRIMEIRA transicao para ENTREGUE,
 * nunca um eco de resgate (Arquivar OS completando uma OS que ja estava
 * ENTREGUE). Nome antigo era `buscarUltimaTransicaoEntregue` — pegava a mais
 * RECENTE, o que confundia esse eco com uma entrega de verdade.
 */
export async function buscarEntregaAuditada(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT id, "criadoEm",
            "dadosAntes" ->> 'status' AS "statusAntes",
            "dadosDepois" ->> 'status' AS "statusDepois",
            "dadosDepois" ->> 'tipoFinalizacao' AS "tipoFinalizacao"
       FROM "LogAuditoria"
      WHERE entidade = 'ORDEM_SERVICO'
        AND "entidadeId" = $1
        AND "dadosDepois" ->> 'status' = 'ENTREGUE'`,
    [osId]
  );

  const encontrada = encontrarEntregaAuditada(
    resultado.rows.map((linha) => ({
      id: String(linha.id),
      criadoEm: new Date(linha.criadoEm),
      statusAntes: linha.statusAntes,
      statusDepois: linha.statusDepois,
      tipoFinalizacao: linha.tipoFinalizacao,
    }))
  );

  return encontrada.encontrada ? { logId: encontrada.logId, criadoEm: encontrada.momento } : null;
}

/**
 * Soma e data mais recente entre os lancamentos de ContaReceber confirmados
 * (PAGO ou RECEBIDO) desta OS — mesmo filtro de `osPossuiPagamentoConfirmado`
 * em app/actions/os.ts.
 */
export async function buscarPagamentoConfirmado(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT COALESCE(SUM(valor), 0)::float AS total,
            MAX(COALESCE("dataRecebimento", "dataVencimento")) AS "ultimaData",
            COUNT(*)::int AS quantidade
       FROM "ContaReceber"
      WHERE "ordemServicoId" = $1
        AND status IN ('PAGO', 'RECEBIDO')`,
    [osId]
  );

  const linha = resultado.rows[0];

  if (!linha || Number(linha.quantidade) === 0) {
    return null;
  }

  return {
    valorTotal: Number(linha.total),
    ultimaData: linha.ultimaData ? new Date(linha.ultimaData) : null,
    quantidade: Number(linha.quantidade),
  };
}

export async function buscarTermoAtivo(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT id, "dataInicioGarantia", "dataFimGarantia", "prazoGarantiaDias", "criadoEm", "atualizadoEm"
       FROM "TermoGarantiaOS"
      WHERE "osId" = $1
        AND "canceladaEm" IS NULL
      LIMIT 1`,
    [osId]
  );

  const linha = resultado.rows[0];

  if (!linha) return null;

  return {
    id: String(linha.id),
    dataInicioGarantia: new Date(linha.dataInicioGarantia),
    dataFimGarantia: new Date(linha.dataFimGarantia),
    prazoGarantiaDias: Number(linha.prazoGarantiaDias),
    criadoEm: new Date(linha.criadoEm),
    atualizadoEm: new Date(linha.atualizadoEm),
  };
}

/**
 * Itens no formato que lib/dominio/os/regras-finalizacao.ts:avaliarFinalizacao
 * exige (`itens: ItemParaAvaliacaoFinalizacao[]`) — mesmo mapeamento
 * custoPeca -> custo / valorCobrado -> precoVenda de
 * app/actions/os.ts:finalizarOrdemServico.
 */
export async function buscarItensParaAvaliacao(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT id, descricao, "custoPeca" AS custo, "valorCobrado" AS "precoVenda"
       FROM "ItemOS"
      WHERE "osId" = $1
      ORDER BY "criadoEm" ASC`,
    [osId]
  );

  return resultado.rows.map((linha) => ({
    id: String(linha.id),
    descricao: linha.descricao,
    custo: Number(linha.custo),
    precoVenda: Number(linha.precoVenda),
  }));
}

/**
 * "Pedido gerado no PDV" — mesmo criterio de
 * app/actions/os.ts:finalizarOrdemServico (`possuiVendaVinculada`): existe um
 * ContaReceber com origem ORDEM_SERVICO e vendaId preenchido para esta OS.
 */
export async function buscarVendaVinculada(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT EXISTS (
        SELECT 1 FROM "ContaReceber" cr
         WHERE cr."ordemServicoId" = $1
           AND cr."vendaId" IS NOT NULL
           AND cr.origem = 'ORDEM_SERVICO'
     ) AS possui`,
    [osId]
  );

  return Boolean(resultado.rows[0]?.possui);
}
