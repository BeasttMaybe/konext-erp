"use server";

import { revalidatePath } from "next/cache";

import { registrarLogAuditoria, contextoAuditoriaDoUsuario } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { paraMensagemSegura } from "@/lib/erros";
import {
  enviarMensagemNoTelegram,
  explicarErroDoTelegram,
  idDoBot,
  listarChatsRecentes,
  telegramEstaConfigurado,
  type ChatEncontrado,
} from "@/lib/notificacoes/telegram";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Aviso de vencimento no Telegram: a parte que o dono configura.
 *
 * O token do bot é segredo de ambiente e NUNCA passa por aqui — nem pra ser
 * lido de volta. O que esta tela guarda é o DESTINO: o chat id, que é um
 * identificador (como um número de telefone numa agenda), não um segredo.
 *
 * `tokenConfigurado` existe pra tela poder dizer a verdade. Sem ele, um dono
 * que colasse o chat id e não recebesse nada não teria como saber se errou o
 * id ou se o bot ainda não foi ligado no ambiente.
 */

export type ConfiguracaoDeAvisos = {
  chatId: string;
  ligado: boolean;
  /** O bot existe no ambiente? Se não, nenhum aviso sai, por mais certo que o chat id esteja. */
  tokenConfigurado: boolean;
};

export type ResultadoDeAvisos = { sucesso: true; mensagem: string } | { sucesso: false; mensagem: string };

type ConfiguracaoDelegate = {
  findFirst: (args: unknown) => Promise<{
    id: string;
    telegramChatId?: string | null;
    avisarVencimentoNoTelegram?: boolean | null;
  } | null>;
  update: (args: unknown) => Promise<unknown>;
};

function delegateDeConfiguracao(prisma: unknown): ConfiguracaoDelegate {
  const raiz = prisma as Record<string, ConfiguracaoDelegate | undefined>;
  const delegate = raiz.configuracao ?? raiz.Configuracao;

  if (!delegate?.findFirst || !delegate?.update) {
    throw new Error("Delegate Prisma de Configuracao nao disponivel.");
  }

  return delegate;
}

export async function obterConfiguracaoDeAvisos(): Promise<ConfiguracaoDeAvisos> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "configuracoes.sistema");

  const configuracao = await delegateDeConfiguracao(contexto.prisma).findFirst({
    orderBy: { criadoEm: "asc" },
    select: { id: true, telegramChatId: true, avisarVencimentoNoTelegram: true },
  });

  return {
    chatId: configuracao?.telegramChatId?.trim() ?? "",
    ligado: configuracao?.avisarVencimentoNoTelegram !== false,
    tokenConfigurado: telegramEstaConfigurado(),
  };
}

/**
 * O chat id do Telegram é um número, às vezes negativo (grupo), às vezes
 * precedido de `@` quando é um canal público.
 *
 * A validação é frouxa de propósito: recusar um formato que o Telegram aceita
 * seria pior do que deixar passar um errado, que o botão de teste pega na
 * hora. O que não pode passar é texto solto que claramente não é destino —
 * alguém colando o nome do bot, por exemplo.
 */
function validarChatId(valor: string): string | null {
  const limpo = valor.trim();
  if (limpo === "") return null;

  if (!/^-?\d{1,32}$/.test(limpo) && !/^@[A-Za-z0-9_]{3,64}$/.test(limpo)) {
    return "O chat id é um número (negativo, em grupo) ou @nome do canal.";
  }

  // O erro que aconteceu de verdade na primeira configuração: o número antes
  // dos dois-pontos do TOKEN é o id do próprio bot, e é facílimo confundir
  // com o chat. O Telegram recusa com "the bot can't send messages to the
  // bot" — mensagem correta e inútil pra quem não sabe o que é um chat id.
  // Melhor recusar aqui, dizendo o que fazer.
  if (limpo === idDoBot()) {
    return "Esse é o número do próprio bot (o que vem antes dos dois-pontos no token), não o seu. Mande uma mensagem pro bot no Telegram e clique em “Procurar meu chat”.";
  }

  return null;
}

export async function salvarConfiguracaoDeAvisos(entrada: {
  chatId: string;
  ligado: boolean;
}): Promise<ResultadoDeAvisos> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    const erro = validarChatId(entrada.chatId);
    if (erro) return { sucesso: false, mensagem: erro };

    const delegate = delegateDeConfiguracao(contexto.prisma);
    const configuracao = await delegate.findFirst({
      orderBy: { criadoEm: "asc" },
      select: { id: true },
    });

    if (!configuracao) {
      return { sucesso: false, mensagem: "Configuração da loja não encontrada." };
    }

    const chatId = entrada.chatId.trim();

    // `tx` sem anotação de propósito: o tipo certo é `Prisma.TransactionClient`,
    // que só existe no cliente Prisma gerado. Anotar como `unknown` aqui
    // quebrou o build — `registrarLogAuditoria` exige o cliente de verdade.
    await contexto.prisma.$transaction(async (tx) => {
      await delegateDeConfiguracao(tx).update({
        where: { id: configuracao.id },
        data: {
          telegramChatId: chatId === "" ? null : chatId,
          avisarVencimentoNoTelegram: entrada.ligado,
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/avisos-telegram.ts:salvarConfiguracaoDeAvisos"
        ),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_AVISOS_TELEGRAM,
          entidade: ENTIDADES_AUDITORIA.CONFIGURACAO,
          entidadeId: configuracao.id,
          // O chat id vai pra trilha porque é configuração, não segredo — e
          // saber quando o destino dos avisos mudou é exatamente o tipo de
          // coisa que a trilha existe pra responder.
          dadosDepois: {
            telegramChatId: chatId === "" ? null : chatId,
            avisarVencimentoNoTelegram: entrada.ligado,
          },
        }
      );
    });

    revalidatePath("/configuracoes");

    return {
      sucesso: true,
      mensagem:
        chatId === ""
          ? "Chat removido. Os avisos continuam aparecendo no sininho do sistema."
          : "Destino salvo.",
    };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

/**
 * Manda uma mensagem de teste agora.
 *
 * Mesma razão do teste de armazenamento de fotos: o projeto não tem ambiente
 * de Preview, então a primeira vez que o código fala com o Telegram é em
 * produção. Descobrir ali que o chat id está errado é descobrir no dia em que
 * um boleto venceu sem aviso.
 */
export type ResultadoDaProcura =
  | { sucesso: true; chats: ChatEncontrado[] }
  | { sucesso: false; mensagem: string };

/**
 * Procura quem falou com o bot nas últimas horas.
 *
 * Existe pra tirar o chat id das mãos de quem configura. Caçar o número num
 * terceiro bot e colar às cegas é como a primeira configuração foi feita — e
 * ela foi feita errada, com o id do próprio bot. Aqui a pessoa manda uma
 * mensagem qualquer pro bot, clica em procurar e escolhe da lista.
 *
 * O chat do próprio bot é filtrado: ele nunca é um destino válido.
 */
export async function procurarChatsDoTelegram(): Promise<ResultadoDaProcura> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    if (!telegramEstaConfigurado()) {
      return {
        sucesso: false,
        mensagem:
          "O bot do Telegram ainda não foi ligado no ambiente (TELEGRAM_BOT_TOKEN). Sem ele não há o que procurar.",
      };
    }

    const resultado = await listarChatsRecentes();
    if (!resultado.ok) return { sucesso: false, mensagem: resultado.motivo };

    const meuBot = idDoBot();

    return { sucesso: true, chats: resultado.chats.filter((chat) => chat.id !== meuBot) };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

export async function enviarAvisoDeTeste(): Promise<ResultadoDeAvisos> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    const { chatId, tokenConfigurado } = await obterConfiguracaoDeAvisos();

    if (!tokenConfigurado) {
      return {
        sucesso: false,
        mensagem:
          "O bot do Telegram ainda não foi ligado no ambiente (TELEGRAM_BOT_TOKEN). Sem ele nenhum aviso sai.",
      };
    }

    if (chatId === "") {
      return { sucesso: false, mensagem: "Salve um chat id antes de testar." };
    }

    const resultado = await enviarMensagemNoTelegram({
      chatId,
      texto:
        "TechOS — teste de aviso\n\nSe você está lendo isto, os avisos de vencimento vão chegar aqui: 3 dias antes, 2, 1 e no dia.",
    });

    return resultado.enviado
      ? { sucesso: true, mensagem: "Mensagem enviada. Confira o Telegram." }
      : { sucesso: false, mensagem: explicarErroDoTelegram(resultado.motivo) };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}
