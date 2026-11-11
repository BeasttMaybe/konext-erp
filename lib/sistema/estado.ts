import { cronEstaProtegido } from "@/lib/cron/autorizacao";

/**
 * O que o sistema sabe dizer sobre si mesmo: qual versao esta no ar e se as
 * rotinas agendadas estao protegidas.
 *
 * POR QUE ISTO EXISTE
 *
 * Em 10/11/2026 uma coluna foi apagada do banco de producao na suposicao de
 * que o codigo novo ja estava publicado. Nao estava, e o sistema saiu do ar.
 * A suposicao so foi necessaria porque NAO HAVIA COMO OLHAR: nada no sistema
 * dizia qual versao estava servindo as paginas.
 *
 * Agora ha uma linha na tela de Configuracoes com o identificador da versao.
 * Antes de qualquer mudanca que dependa de "o codigo novo ja esta no ar", a
 * pergunta tem resposta — e quem responde e a tela, nao a memoria de alguem.
 *
 * Puro de proposito: recebe o ambiente como argumento, para ser testavel sem
 * mexer em `process.env`.
 */

export type EstadoDoSistema = {
  /** Sete primeiros caracteres do commit publicado, ou `null` fora da Vercel. */
  versao: string | null;
  /** `production`, `preview` ou `development` — ou `null` quando desconhecido. */
  ambiente: string | null;
  /** O ramo do Git que gerou esta publicacao. */
  ramo: string | null;
  /**
   * `true`: ha segredo, as rotinas so respondem a Vercel.
   * `false`: nao ha — e em producao elas se recusam a rodar (ver
   * lib/cron/autorizacao.ts), entao fechamento automatico de caixa, avisos de
   * vencimento e metas automaticas estao PARADOS ate o segredo ser criado.
   */
  rotinasProtegidas: boolean;
};

type Ambiente = Record<string, string | undefined>;

function texto(valor: string | undefined): string | null {
  const limpo = valor?.trim() ?? "";
  return limpo === "" ? null : limpo;
}

export function lerEstadoDoSistema(ambiente: Ambiente): EstadoDoSistema {
  const commit = texto(ambiente.VERCEL_GIT_COMMIT_SHA);

  return {
    versao: commit ? commit.slice(0, 7) : null,
    ambiente: texto(ambiente.VERCEL_ENV) ?? texto(ambiente.NODE_ENV),
    ramo: texto(ambiente.VERCEL_GIT_COMMIT_REF),
    rotinasProtegidas: cronEstaProtegido(ambiente.CRON_SECRET),
  };
}
