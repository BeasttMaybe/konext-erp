import { Prisma } from "@prisma/client-central";
import type { PrismaClient } from "@prisma/client-central";

/**
 * Auditoria do banco CENTRAL (Fase 1D-1) — mesmo contrato de
 * lib/auditoria.ts, mas apontado pro client `@prisma/client-central` (um
 * client Prisma gerado diferente, com suas proprias classes `Prisma.*` —
 * por isso nao da pra simplesmente reusar as funcoes de lib/auditoria.ts
 * aqui: os tipos nao batem, mesmo o runtime sendo compativel). Usado por
 * app/actions/cargos.ts pra auditar mudanca de cargo/permissao/vinculo.
 */

const CAMPOS_SENSIVEIS = new Set(["senha", "password", "token", "accessToken", "refreshToken", "cookie", "hash"]);
const VALOR_REDACTED = "[REDACTED]";

export type ContextoAuditoriaCentral = {
  usuarioId?: string | null;
  empresaId: string;
  origem?: string | null;
};

export type EntradaLogAuditoriaCentral = {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  motivo?: string | null;
};

type ClienteAuditoriaCentral = Prisma.TransactionClient | PrismaClient;

function sanitizarValor(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(sanitizarValor);
  }

  if (valor && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};

    for (const [chave, conteudo] of Object.entries(valor)) {
      resultado[chave] = CAMPOS_SENSIVEIS.has(chave) ? VALOR_REDACTED : sanitizarValor(conteudo);
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

export async function registrarLogAuditoriaCentral(
  client: ClienteAuditoriaCentral,
  contexto: ContextoAuditoriaCentral,
  entrada: EntradaLogAuditoriaCentral
): Promise<{ id: string }> {
  const registro = await client.logAuditoria.create({
    data: {
      empresaId: contexto.empresaId,
      usuarioId: contexto.usuarioId ? String(contexto.usuarioId) : null,
      origem: contexto.origem ? String(contexto.origem) : null,
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId ? String(entrada.entidadeId) : null,
      dadosAntes: paraJsonSeguro(entrada.dadosAntes),
      dadosDepois: paraJsonSeguro(entrada.dadosDepois),
      motivo: entrada.motivo ? String(entrada.motivo) : null,
    },
    select: { id: true },
  });

  return { id: String(registro.id) };
}

export function contextoAuditoriaCentralDoUsuario(
  usuario: { id?: string | null } | null | undefined,
  empresaId: string,
  origem: string
): ContextoAuditoriaCentral {
  return {
    usuarioId: usuario?.id ? String(usuario.id) : null,
    empresaId,
    origem,
  };
}
