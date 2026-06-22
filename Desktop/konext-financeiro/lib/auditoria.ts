import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

export type EntradaLogAuditoria = {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  motivo?: string | null;
};

type ClienteAuditoria = Prisma.TransactionClient | typeof prisma;

type DelegateLogAuditoria = {
  create: (args: unknown) => Promise<{ id: string }>;
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
  entrada: EntradaLogAuditoria
): Promise<{ id: string }> {
  const delegate = obterDelegateLogAuditoria(client);

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
}

export function contextoAuditoriaDoUsuario(usuario: { id?: string | null } | null | undefined, origem: string): ContextoAuditoria {
  return {
    usuarioId: usuario?.id ? String(usuario.id) : null,
    origem,
  };
}
