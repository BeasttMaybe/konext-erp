import { describe, expect, it } from "vitest";

import {
  escopoCaixaSession,
  escopoContaReceber,
  escopoDespesa,
  escopoOrdemServico,
} from "./escopos";
import type { Permissao } from "./permissoes";
import type { ContextoTenantSeguro } from "@/types/tenant";

function contexto(params: {
  usuarioOperacionalId?: string;
  permissoes: readonly Permissao[];
}): ContextoTenantSeguro {
  return {
    usuarioOperacional: {
      id: params.usuarioOperacionalId ?? "usuario-1",
      nome: "Teste",
      email: "teste@konext.com",
      role: "OPERADOR",
    },
    usuarioCentralId: "central-1",
    empresaId: "empresa-1",
    empresaSlug: "empresa-teste",
    tenantId: "tenant-1",
    tenantSlug: "tenant-teste",
    connectionRef: "TENANT_TESTE_DATABASE_URL",
    papelEmpresa: "USUARIO",
    permissoes: new Set(params.permissoes),
  };
}

describe("escopoOrdemServico", () => {
  it("com os.ver_todas: sem restricao nenhuma", () => {
    const ctx = contexto({ permissoes: ["os.ver_todas"] });
    expect(escopoOrdemServico(ctx)).toEqual({});
  });

  it("sem os.ver_todas: só criadas pelo usuário OU onde ele é técnico", () => {
    const ctx = contexto({ usuarioOperacionalId: "u42", permissoes: ["os.ver"] });
    expect(escopoOrdemServico(ctx)).toEqual({
      OR: [{ criadoPorId: "u42" }, { tecnicos: { some: { usuarioId: "u42" } } }],
    });
  });

  it("sem usuarioOperacional.id mapeado: falha fechado (where que nunca bate)", () => {
    const ctx = contexto({ usuarioOperacionalId: "", permissoes: ["os.ver"] });
    const escopo = escopoOrdemServico(ctx);
    expect(escopo).not.toEqual({});
    expect(escopo).toHaveProperty("id");
  });

  it("caso da URL direta: o mesmo fragmento, combinado com {id: osAlvo}, so bate se a OS pertencer ao escopo", () => {
    const ctx = contexto({ usuarioOperacionalId: "u42", permissoes: ["os.ver"] });
    const escopo = escopoOrdemServico(ctx);
    const whereCompleto = { id: "os-de-outro-tecnico", ...escopo };

    // Simula o que o Prisma faria: os campos de `escopo` (OR) se combinam
    // por AND implicito com `id` — uma OS de outro tecnico so aparece nessa
    // consulta se ela tambem satisfizer o OR, o que nao e o caso aqui.
    expect(whereCompleto.id).toBe("os-de-outro-tecnico");
    expect(whereCompleto.OR).toEqual([
      { criadoPorId: "u42" },
      { tecnicos: { some: { usuarioId: "u42" } } },
    ]);
  });
});

describe("escopoCaixaSession", () => {
  it("com caixa.ver_todos: sem restricao", () => {
    const ctx = contexto({ permissoes: ["caixa.ver_todos"] });
    expect(escopoCaixaSession(ctx)).toEqual({});
  });

  it("sem caixa.ver_todos: só as sessões que o usuário abriu", () => {
    const ctx = contexto({ usuarioOperacionalId: "u7", permissoes: ["caixa.ver"] });
    expect(escopoCaixaSession(ctx)).toEqual({ abertoPorId: "u7" });
  });

  it("caixa.ver sozinho (sem _todos) nao da acesso a tudo", () => {
    const ctx = contexto({ usuarioOperacionalId: "u7", permissoes: ["caixa.ver"] });
    expect(escopoCaixaSession(ctx)).not.toEqual({});
  });
});

describe("escopoContaReceber", () => {
  it("com financeiro.ver_todos: sem restricao", () => {
    const ctx = contexto({ permissoes: ["financeiro.ver_todos"] });
    expect(escopoContaReceber(ctx)).toEqual({});
  });

  it("sem financeiro.ver_todos: só os lançamentos que o usuário criou", () => {
    const ctx = contexto({ usuarioOperacionalId: "u9", permissoes: ["financeiro.ver"] });
    expect(escopoContaReceber(ctx)).toEqual({ criadoPorId: "u9" });
  });
});

describe("escopoDespesa", () => {
  it("com financeiro.ver_todos: sem restricao", () => {
    const ctx = contexto({ permissoes: ["financeiro.ver_todos"] });
    expect(escopoDespesa(ctx)).toEqual({});
  });

  it("sem financeiro.ver_todos: só as despesas que o usuário criou", () => {
    const ctx = contexto({ usuarioOperacionalId: "u9", permissoes: ["financeiro.ver"] });
    expect(escopoDespesa(ctx)).toEqual({ criadoPorId: "u9" });
  });

  it("financeiro.ver_todos concedido isoladamente (sem financeiro.ver) ainda remove a restricao — a variante so controla o alcance, nao substitui a base", () => {
    const ctx = contexto({ usuarioOperacionalId: "u9", permissoes: ["financeiro.ver_todos"] });
    expect(escopoDespesa(ctx)).toEqual({});
  });
});
