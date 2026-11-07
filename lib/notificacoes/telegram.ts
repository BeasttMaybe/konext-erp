/**
 * Envio de mensagem pelo Telegram.
 *
 * Um bot só, da Konext, cujo token vive em `TELEGRAM_BOT_TOKEN` (segredo de
 * ambiente). O DESTINO é por loja: cada tenant guarda o seu `telegramChatId`
 * em `Configuracao`. Isso é o desenho certo pro produto ser vendido: o dono
 * de cada loja conversa com o mesmo bot e recebe só os avisos dela.
 *
 * O chat id não é segredo — é um identificador, como um número de telefone
 * numa agenda —, então ele pode ser colado na tela de Configurações pelo
 * próprio dono. O token é, e nunca passa por aqui: vem do ambiente.
 *
 * NADA NESTE MÓDULO LANÇA. Um aviso que não saiu é um aviso que não saiu; não
 * é motivo pra derrubar o cron e deixar os outros tenants sem aviso nenhum.
 * Quem chama decide o que fazer com o `false`.
 */

/** O Telegram corta mensagem acima disto. Quebrar antes é melhor que ser cortado. */
const LIMITE_DE_CARACTERES = 4096;

export type ResultadoDoEnvio =
  | { enviado: true; partes: number }
  | { enviado: false; motivo: string };

/**
 * Quebra o texto em partes que caibam no limite, sempre em quebra de linha.
 *
 * Cortar no meio de uma linha partiria um aviso em dois — "R$ 1.2" numa
 * mensagem e "90,00" na seguinte é pior que não avisar. Uma linha sozinha
 * maior que o limite (não deveria existir aqui) é cortada, porque a
 * alternativa é descartá-la.
 */
export function quebrarEmPartes(
  texto: string,
  limite: number = LIMITE_DE_CARACTERES
): string[] {
  if (texto.length <= limite) return texto.length > 0 ? [texto] : [];

  const partes: string[] = [];
  let atual = "";

  for (const linha of texto.split("\n")) {
    const candidata = atual === "" ? linha : `${atual}\n${linha}`;

    if (candidata.length <= limite) {
      atual = candidata;
      continue;
    }

    if (atual !== "") {
      partes.push(atual);
      atual = "";
    }

    if (linha.length <= limite) {
      atual = linha;
      continue;
    }

    for (let inicio = 0; inicio < linha.length; inicio += limite) {
      partes.push(linha.slice(inicio, inicio + limite));
    }
  }

  if (atual !== "") partes.push(atual);

  return partes;
}

export function telegramEstaConfigurado(): boolean {
  return (process.env.TELEGRAM_BOT_TOKEN ?? "").trim().length > 0;
}

/**
 * Manda o texto pro chat.
 *
 * `disable_web_page_preview` porque um aviso de boleto não tem link pra
 * pré-visualizar, e a prévia só ocuparia tela.
 */
export async function enviarMensagemNoTelegram({
  chatId,
  texto,
}: {
  chatId: string;
  texto: string;
}): Promise<ResultadoDoEnvio> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();

  if (token === "") {
    return { enviado: false, motivo: "TELEGRAM_BOT_TOKEN nao configurado." };
  }

  const destino = chatId.trim();
  if (destino === "") {
    return { enviado: false, motivo: "Loja sem chat do Telegram configurado." };
  }

  const partes = quebrarEmPartes(texto);
  if (partes.length === 0) {
    return { enviado: false, motivo: "Mensagem vazia." };
  }

  for (const [indice, parte] of partes.entries()) {
    try {
      const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: destino,
          text: parte,
          disable_web_page_preview: true,
        }),
      });

      if (!resposta.ok) {
        // O corpo do erro do Telegram diz o que está errado em texto legível
        // ("chat not found", "bot was blocked by the user"), e é exatamente
        // isso que quem for diagnosticar precisa ver. O token nunca aparece
        // no corpo — só na URL, que não é logada.
        const corpo = await resposta.text().catch(() => "");
        return {
          enviado: false,
          motivo: `Telegram respondeu ${resposta.status} na parte ${indice + 1}/${partes.length}: ${corpo.slice(0, 300)}`,
        };
      }
    } catch (erro) {
      return {
        enviado: false,
        motivo: `Falha de rede ao falar com o Telegram: ${erro instanceof Error ? erro.message : String(erro)}`,
      };
    }
  }

  return { enviado: true, partes: partes.length };
}
