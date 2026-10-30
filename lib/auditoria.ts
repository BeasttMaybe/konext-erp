import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const CAMPOS_SENSIVEIS = new Set([
  "senha",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "cookie",
  "hash",
  "senhaDesenho",
]);

const VALOR_REDACTED = "[REDACTED]";

export type ContextoAuditoria = {
  usuarioId?: string | null;
  empresaId?: string | null;
  origem?: string | null;
};

export type OpcoesRegistroAuditoria = {
  /**
   * Marca a gravacao como best-effort: uma tabela LogAuditoria ausente nao
   * derruba a operacao, mas a falha e registrada com console.error.
   *
   * Use APENAS fora de transacoes de negocio. Dentro de uma transacao a
   * auditoria e parte do contrato: se ela falha, a escrita nao pode valer.
   */
  melhorEsforco?: boolean;
};

export type EntradaLogAuditoria = {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  motivo?: string | null;
};

// Helpers de auditoria exigem client explicito (tx do tenant ou PrismaClient do tenant).
// Nao existe fallback para Prisma global.
type ClienteAuditoria = Prisma.TransactionClient | PrismaClient;

type DelegateLogAuditoria = {
  create: (args: unknown) => Promise<{ id: string }>;
  /** Opcional: delegate falso de teste nao precisa implementar. */
  createMany?: (args: unknown) => Promise<{ count: number }>;
};

function obterDelegateLogAuditoria(client: ClienteAuditoria): DelegateLogAuditoria {
  const prismaClient = client as unknown as {
    logAuditoria?: DelegateLogAuditoria;
    LogAuditoria?: DelegateLogAuditoria;
  };

  const delegate = prismaClient.logAuditoria ?? prismaClient.LogAuditoria;

  if (!delegate?.create) {
    throw new Error("Delegate Prisma de LogAuditoria nao disponivel.");
  }

  return delegate;
}

function sanitizarValor(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(sanitizarValor);
  }

  if (valor && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};

    for (const [chave, conteudo] of Object.entries(valor)) {
      if (CAMPOS_SENSIVEIS.has(chave)) {
        resultado[chave] = VALOR_REDACTED;
        continue;
      }

      resultado[chave] = sanitizarValor(conteudo);
    }

    return resultado;
  }

  return valor;
}

type ValorJsonAuditoria = Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;

function erroTabelaAuditoriaInexistente(erro: unknown): boolean {
  if (!(erro instanceof Error)) {
    return false;
  }

  const mensagem = erro.message.toLowerCase();

  return (
    mensagem.includes("logauditoria")
    && (
      mensagem.includes("does not exist")
      || mensagem.includes("nao existe")
      || mensagem.includes("p2021")
    )
  );
}

function paraJsonSeguro(valor: unknown): ValorJsonAuditoria | undefined {
  if (typeof valor === "undefined") return undefined;

  const sanitizado = sanitizarValor(valor);

  if (sanitizado === null) {
    return Prisma.JsonNull;
  }

  return sanitizado as Prisma.InputJsonValue;
}

export async function registrarLogAuditoria(
  client: ClienteAuditoria,
  contexto: ContextoAuditoria,
  entrada: EntradaLogAuditoria,
  opcoes?: OpcoesRegistroAuditoria
): Promise<{ id: string }> {
  const delegate = obterDelegateLogAuditoria(client);

  try {
    const registro = await delegate.create({
      data: {
        usuarioId: contexto.usuarioId ? String(contexto.usuarioId) : null,
        empresaId: contexto.empresaId ? String(contexto.empresaId) : null,
        origem: contexto.origem ? String(contexto.origem) : null,
        acao: entrada.acao,
        entidade: entrada.entidade,
        entidadeId: entrada.entidadeId ? String(entrada.entidadeId) : null,
        dadosAntes: paraJsonSeguro(entrada.dadosAntes),
        dadosDepois: paraJsonSeguro(entrada.dadosDepois),
        motivo: entrada.motivo ? String(entrada.motivo) : null,
      },
    });

    return {
      id: String(registro.id),
    };
  } catch (erro) {
    // Tolerancia SOMENTE quando quem chama declarou a gravacao como
    // best-effort. Antes da Fase 1A qualquer falha de "tabela ausente" era
    // engolida em silencio: a escrita de negocio confirmava e a trilha
    // simplesmente nao existia, sem nenhum sinal (AUDIT_REPORT 16.7-b,
    // caminho 7). Dentro de uma transacao isso e inaceitavel — a transacao
    // precisa falhar junto.
    if (opcoes?.melhorEsforco && erroTabelaAuditoriaInexistente(erro)) {
      console.error("[auditoria] registro best-effort ignorado: tabela LogAuditoria ausente", {
        acao: entrada.acao,
        entidade: entrada.entidade,
        entidadeId: entrada.entidadeId ?? null,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      return { id: "auditoria-indisponivel" };
    }

    throw erro;
  }
}

/**
 * Grava varios registros de auditoria numa chamada so.
 *
 * Existe por causa de tempo de transacao, nao de elegancia: as acoes em lote do
 * Financeiro gravavam um log por item, em sequencia, dentro da mesma transacao
 * interativa. Com 20 itens isso somava 20 idas ao banco so de auditoria, e a
 * transacao estourava o limite padrao de 5 segundos — o usuario via "Nao foi
 * possivel concluir a operacao" e nenhum pagamento acontecia.
 *
 * Nao aceita `melhorEsforco`: uma acao em lote que gravou no banco e perdeu a
 * trilha em silencio e exatamente o que a Fase 1A proibiu. Se a auditoria
 * falhar aqui, a transacao inteira falha junto.
 */
export async function registrarLogsAuditoriaEmLote(
  client: ClienteAuditoria,
  contexto: ContextoAuditoria,
  entradas: EntradaLogAuditoria[]
): Promise<{ quantidade: number }> {
  if (entradas.length === 0) return { quantidade: 0 };

  const delegate = obterDelegateLogAuditoria(client);

  if (typeof delegate.createMany !== "function") {
    // Cliente sem createMany (teste com delegate falso): cai pro caminho um a
    // um, que e mais lento mas nunca deixa de registrar.
    for (const entrada of entradas) {
      await registrarLogAuditoria(client, contexto, entrada);
    }
    return { quantidade: entradas.length };
  }

  await delegate.createMany({
    data: entradas.map((entrada) => ({
      usuarioId: contexto.usuarioId ? String(contexto.usuarioId) : null,
      empresaId: contexto.empresaId ? String(contexto.empresaId) : null,
      origem: contexto.origem ? String(contexto.origem) : null,
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId ? String(entrada.entidadeId) : null,
      dadosAntes: paraJsonSeguro(entrada.dadosAntes),
      dadosDepois: paraJsonSeguro(entrada.dadosDepois),
      motivo: entrada.motivo ? String(entrada.motivo) : null,
    })),
  });

  return { quantidade: entradas.length };
}

export function contextoAuditoriaDoUsuario(usuario: { id?: string | null } | null | undefined, origem: string): ContextoAuditoria {
  return {
    usuarioId: usuario?.id ? String(usuario.id) : null,
    origem,
  };
}
