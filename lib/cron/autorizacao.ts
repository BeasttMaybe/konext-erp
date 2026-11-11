import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Quem pode disparar uma rotina agendada.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * As tres rotas de cron tinham, cada uma, a mesma linha:
 *
 *   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return 401
 *
 * O `cronSecret &&` faz a checagem valer SO quando a variavel existe. Sem
 * `CRON_SECRET` no ambiente, a condicao e falsa e a rota segue — aberta para
 * a internet inteira. Qualquer pessoa fecharia o caixa de todas as lojas,
 * dispararia os avisos do Telegram e leria, na resposta, o slug de cada
 * tenant e as mensagens de erro de cada banco.
 *
 * E o tipo de falha que nao aparece: com a variavel configurada tudo funciona
 * como esperado, e no dia em que ela some (projeto novo na Vercel, ambiente
 * recriado, migracao para VPS) nada quebra — so deixa de proteger.
 *
 * A REGRA AGORA
 *
 * Em producao, sem segredo configurado a rota RECUSA (503). Protecao que
 * depende de alguem lembrar de configurar tem que falhar fechada.
 *
 * Fora de producao o segredo e opcional, para rodar `curl localhost` sem
 * cerimonia — mas se existir, e exigido tambem.
 */

export type DecisaoDoCron =
  | { autorizado: true }
  | { autorizado: false; status: 401 | 503; erro: string };

function resumo(texto: string): Buffer {
  return createHash("sha256").update(texto).digest();
}

/**
 * Comparacao em tempo constante.
 *
 * `===` em texto para no primeiro caractere diferente, e o tempo de resposta
 * passa a dizer quantos caracteres o chute acertou. Comparar os resumos
 * SHA-256 resolve tambem o tamanho: `timingSafeEqual` exige buffers do mesmo
 * comprimento, e resumo tem sempre 32 bytes.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  return timingSafeEqual(resumo(a), resumo(b));
}

export function decidirAutorizacaoDoCron(entrada: {
  /** Valor do cabecalho `Authorization` da requisicao. */
  cabecalho: string | null;
  /** `process.env.CRON_SECRET`. */
  segredo: string | undefined;
  /** `process.env.NODE_ENV`. */
  ambiente: string | undefined;
}): DecisaoDoCron {
  const segredo = entrada.segredo?.trim() ?? "";

  if (segredo === "") {
    if (entrada.ambiente === "production") {
      return {
        autorizado: false,
        status: 503,
        erro: "Rotina desativada: CRON_SECRET não está configurado neste ambiente.",
      };
    }

    return { autorizado: true };
  }

  if (!entrada.cabecalho || !iguaisEmTempoConstante(entrada.cabecalho, `Bearer ${segredo}`)) {
    return { autorizado: false, status: 401, erro: "Não autorizado." };
  }

  return { autorizado: true };
}

/** O segredo existe? Usado pela tela de Configuracoes para avisar o dono. */
export function cronEstaProtegido(segredo: string | undefined): boolean {
  return (segredo?.trim() ?? "") !== "";
}
