// Helpers compartilhados pelos scripts de reparo de OS
// (scripts/reparo/relatorio-os-inconsistentes.mjs e scripts/reparo/aplicar-reparo-os.mjs).
import { types } from "@neondatabase/serverless";

// Tolerancia usada para "este evento e o mesmo momento que aquele timestamp":
// o mesmo valor (2 segundos) ja usado em scripts/diagnostico/diagnosticar-tenants.mjs
// para comparar OrdemServico.atualizadoEm contra o ultimo evento de auditoria.
export const TOLERANCIA_SEGUNDOS_EVENTO = 2;

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
 * Ultima transicao PARA ENTREGUE registrada na auditoria desta OS — mesma
 * consulta de `obterMomentoEntregaAuditado` em app/actions/os.ts, reescrita
 * para o cliente `pg` (parametros posicionais, nao tagged template do Prisma).
 */
export async function buscarUltimaTransicaoEntregue(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT id, "criadoEm"
       FROM "LogAuditoria"
      WHERE entidade = 'ORDEM_SERVICO'
        AND "entidadeId" = $1
        AND "dadosDepois" ->> 'status' = 'ENTREGUE'
      ORDER BY "criadoEm" DESC
      LIMIT 1`,
    [osId]
  );

  const linha = resultado.rows[0];
  return linha ? { logId: String(linha.id), criadoEm: new Date(linha.criadoEm) } : null;
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

export async function buscarQuantidadeItens(clientePg, osId) {
  const resultado = await clientePg.query(
    `SELECT COUNT(*)::int AS quantidade FROM "ItemOS" WHERE "osId" = $1`,
    [osId]
  );

  return Number(resultado.rows[0]?.quantidade ?? 0);
}
