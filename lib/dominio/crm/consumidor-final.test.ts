import { describe, expect, it } from "vitest";
import {
  DADOS_CLIENTE_CONSUMIDOR_FINAL,
  ID_CLIENTE_CONSUMIDOR_FINAL,
  ehClienteConsumidorFinal,
  exigeClienteRealParaFinalizarVenda,
  garantirClienteConsumidorFinal,
  podeEditarCliente,
  podeExcluirCliente,
  resolverClienteEfetivoPdv,
} from "./consumidor-final";

describe("ehClienteConsumidorFinal", () => {
  it("reconhece o id fixo do cliente do sistema", () => {
    expect(ehClienteConsumidorFinal(ID_CLIENTE_CONSUMIDOR_FINAL)).toBe(true);
  });

  it("nao reconhece um cliente real", () => {
    expect(ehClienteConsumidorFinal("cliente-real-123")).toBe(false);
  });

  it("nao reconhece nulo/indefinido/vazio", () => {
    expect(ehClienteConsumidorFinal(null)).toBe(false);
    expect(ehClienteConsumidorFinal(undefined)).toBe(false);
    expect(ehClienteConsumidorFinal("")).toBe(false);
  });
});

describe("resolverClienteEfetivoPdv — venda sem cliente cai no Consumidor Final", () => {
  it("devolve o Consumidor Final quando nenhum cliente foi informado", () => {
    expect(resolverClienteEfetivoPdv(undefined)).toBe(ID_CLIENTE_CONSUMIDOR_FINAL);
    expect(resolverClienteEfetivoPdv(null)).toBe(ID_CLIENTE_CONSUMIDOR_FINAL);
    expect(resolverClienteEfetivoPdv("")).toBe(ID_CLIENTE_CONSUMIDOR_FINAL);
  });

  it("devolve o Consumidor Final quando o campo so tem espacos", () => {
    expect(resolverClienteEfetivoPdv("   ")).toBe(ID_CLIENTE_CONSUMIDOR_FINAL);
  });

  it("devolve o id do cliente real quando informado", () => {
    expect(resolverClienteEfetivoPdv("cliente-real-123")).toBe("cliente-real-123");
  });
});

describe("exigeClienteRealParaFinalizarVenda — crediario/boleto bloqueiam o Consumidor Final", () => {
  const ehPagamentoPrazo = (forma: string) => forma === "BOLETO" || forma === "CREDIARIO" || forma === "EMPENHO_PUBLICO";

  it("nao exige cliente real so com dinheiro/pix/cartao", () => {
    expect(
      exigeClienteRealParaFinalizarVenda([{ formaPagamento: "DINHEIRO" }, { formaPagamento: "PIX" }], ehPagamentoPrazo)
    ).toBe(false);
  });

  it("exige cliente real quando ha crediario", () => {
    expect(exigeClienteRealParaFinalizarVenda([{ formaPagamento: "CREDIARIO" }], ehPagamentoPrazo)).toBe(true);
  });

  it("exige cliente real quando ha boleto", () => {
    expect(exigeClienteRealParaFinalizarVenda([{ formaPagamento: "BOLETO" }], ehPagamentoPrazo)).toBe(true);
  });

  it("exige cliente real em pagamento misto com uma forma a prazo", () => {
    expect(
      exigeClienteRealParaFinalizarVenda([{ formaPagamento: "DINHEIRO" }, { formaPagamento: "CREDIARIO" }], ehPagamentoPrazo)
    ).toBe(true);
  });

  it("lista vazia nao exige cliente real", () => {
    expect(exigeClienteRealParaFinalizarVenda([], ehPagamentoPrazo)).toBe(false);
  });
});

describe("podeEditarCliente / podeExcluirCliente — Consumidor Final e fixo", () => {
  it("nega editar o Consumidor Final, com motivo", () => {
    const resultado = podeEditarCliente(ID_CLIENTE_CONSUMIDOR_FINAL);
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toBeTruthy();
  });

  it("nega excluir o Consumidor Final, com motivo", () => {
    const resultado = podeExcluirCliente(ID_CLIENTE_CONSUMIDOR_FINAL);
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toBeTruthy();
  });

  it("permite editar um cliente real", () => {
    expect(podeEditarCliente("cliente-real-123")).toEqual({ permitido: true });
  });

  it("permite excluir um cliente real", () => {
    expect(podeExcluirCliente("cliente-real-123")).toEqual({ permitido: true });
  });
});

describe("garantirClienteConsumidorFinal — idempotente", () => {
  it("cria quando ainda nao existe", async () => {
    const chamadasCreate: unknown[] = [];
    const prismaFalso = {
      cliente: {
        findUnique: async () => null,
        create: async (args: { data: typeof DADOS_CLIENTE_CONSUMIDOR_FINAL }) => {
          chamadasCreate.push(args.data);
          return { id: args.data.id };
        },
      },
    };

    const resultado = await garantirClienteConsumidorFinal(prismaFalso);

    expect(resultado).toEqual({ criado: true });
    expect(chamadasCreate).toHaveLength(1);
    expect(chamadasCreate[0]).toEqual(DADOS_CLIENTE_CONSUMIDOR_FINAL);
  });

  it("nao cria de novo quando ja existe (idempotente)", async () => {
    let chamadasCreate = 0;
    const prismaFalso = {
      cliente: {
        findUnique: async () => ({ id: ID_CLIENTE_CONSUMIDOR_FINAL }),
        create: async () => {
          chamadasCreate += 1;
          return { id: ID_CLIENTE_CONSUMIDOR_FINAL };
        },
      },
    };

    const resultado = await garantirClienteConsumidorFinal(prismaFalso);

    expect(resultado).toEqual({ criado: false });
    expect(chamadasCreate).toBe(0);
  });
});
