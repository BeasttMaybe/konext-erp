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

/**
 * O id do PRÓPRIO bot, lido do token.
 *
 * O token tem o formato `123456789:AAH...`, e o número antes dos dois-pontos
 * é o id do bot como usuário do Telegram. Isso é documentado e estável.
 *
 * Existe aqui por um motivo prático: é o erro que o dono da loja cometeu na
 * primeira tentativa. Ele colou o número do token achando que era o chat, e o
 * Telegram respondeu "the bot can't send messages to the bot" — mensagem
 * correta, mas que não ajuda ninguém que não saiba o que é um chat id. Dá pra
 * detectar isso ANTES de tentar enviar, e dizer o que fazer.
 */
export function idDoBot(): string | null {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const prefixo = token.split(":")[0]?.trim();

  return prefixo && /^\d+$/.test(prefixo) ? prefixo : null;
}

export type ChatEncontrado = {
  id: string;
  nome: string;
  /** "private" (pessoa), "group", "supergroup" ou "channel". */
  tipo: string;
};

/**
 * Quem conversou com o bot recentemente.
 *
 * Serve pra tirar o chat id das mãos de quem configura: em vez de caçar o
 * número num terceiro bot e colar sem saber se está certo, a pessoa manda uma
 * mensagem qualquer pro bot, clica em "procurar" e escolhe da lista.
 *
 * Limite do `getUpdates`, honesto: o Telegram só guarda as atualizações por
 * 24 horas, e só as que ainda não foram consumidas. Então isto encontra quem
 * falou com o bot HOJE — que é exatamente o fluxo de quem está configurando
 * agora. Não é um catálogo de contatos, e não tenta ser.
 *
 * O `offset` não é avançado de propósito: consumir as atualizações faria a
 * segunda tentativa de "procurar" vir vazia, e a pessoa concluiria que parou
 * de funcionar.
 */
export async function listarChatsRecentes(): Promise<
  { ok: true; chats: ChatEncontrado[] } | { ok: false; motivo: string }
> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (token === "") return { ok: false, motivo: "TELEGRAM_BOT_TOKEN nao configurado." };

  try {
    const resposta = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      return { ok: false, motivo: `Telegram respondeu ${resposta.status}: ${corpo.slice(0, 300)}` };
    }

    const dados = (await resposta.json()) as {
      ok?: boolean;
      result?: Array<Record<string, unknown>>;
    };

    if (!dados.ok || !Array.isArray(dados.result)) {
      return { ok: false, motivo: "O Telegram respondeu num formato inesperado." };
    }

    return { ok: true, chats: extrairChats(dados.result) };
  } catch (erro) {
    return {
      ok: false,
      motivo: `Falha de rede ao falar com o Telegram: ${erro instanceof Error ? erro.message : String(erro)}`,
    };
  }
}

/**
 * Tira os chats distintos de uma lista de updates do Telegram.
 *
 * Separado e exportado pra poder ser testado sem rede — a forma do update
 * varia (`message`, `edited_message`, `channel_post`…) e é onde isto erraria.
 */
export function extrairChats(updates: Array<Record<string, unknown>>): ChatEncontrado[] {
  const porId = new Map<string, ChatEncontrado>();

  for (const update of updates) {
    for (const chave of ["message", "edited_message", "channel_post", "my_chat_member"]) {
      const evento = update[chave] as Record<string, unknown> | undefined;
      const chat = evento?.chat as Record<string, unknown> | undefined;

      if (!chat || (typeof chat.id !== "number" && typeof chat.id !== "string")) continue;

      const id = String(chat.id);
      if (porId.has(id)) continue;

      // O nome é só pra pessoa se reconhecer na lista. Chat privado tem
      // first_name; grupo e canal têm title; username é o que sobra.
      const nome =
        [chat.first_name, chat.last_name].filter((parte) => typeof parte === "string").join(" ") ||
        (typeof chat.title === "string" ? chat.title : "") ||
        (typeof chat.username === "string" ? `@${chat.username}` : "") ||
        "Sem nome";

      porId.set(id, {
        id,
        nome,
        tipo: typeof chat.type === "string" ? chat.type : "private",
      });
    }
  }

  return [...porId.values()];
}

/**
 * Traduz a recusa do Telegram pra uma frase que diz O QUE FAZER.
 *
 * As mensagens da API são corretas e inúteis pra quem está configurando:
 * "Forbidden: the bot can't send messages to the bot" está certo e não ajuda
 * ninguém que não saiba o que é um chat id — foi literalmente o que o dono da
 * loja viu na primeira tentativa.
 *
 * O texto original é mantido no fim, entre parênteses. Quem souber ler vai
 * querer vê-lo, e escondê-lo tornaria impossível diagnosticar um caso que
 * esta função não previu.
 */
export function explicarErroDoTelegram(motivo: string): string {
  const cru = motivo.toLowerCase();

  const explicacao = cru.includes("can't send messages to the bot")
    ? "Esse número é o do próprio bot, não o da sua conversa com ele. Mande uma mensagem pro bot no Telegram e use “Procurar meu chat”."
    : cru.includes("chat not found")
      ? "O Telegram não achou essa conversa. Mande uma mensagem pro bot primeiro — bot não consegue falar com quem nunca falou com ele."
      : cru.includes("bot was blocked by the user")
        ? "Você bloqueou o bot no Telegram. Desbloqueie e tente de novo."
        : cru.includes("bot is not a member")
          ? "O bot não está nesse grupo. Adicione o bot ao grupo e tente de novo."
          : cru.includes("unauthorized")
            ? "O token do bot foi recusado pelo Telegram. Confira o TELEGRAM_BOT_TOKEN no ambiente."
            : null;

  return explicacao ? `${explicacao} (Telegram: ${motivo})` : motivo;
}
