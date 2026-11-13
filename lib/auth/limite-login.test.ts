import { describe, expect, it } from "vitest";

import { decidirBloqueio, ipDaRequisicao, mensagemDeBloqueio, resumoDe } from "./limite-login";

const agora = new Date("2026-11-13T12:00:00Z");
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60000);

describe("decidirBloqueio", () => {
  it("4 erros do e-mail ainda deixam tentar; o 5o trava", () => {
    const quatro = [1, 2, 3, 4].map(minutosAtras);
    expect(decidirBloqueio(quatro, [], agora)).toEqual({ bloqueado: false });
    const cinco = [1, 2, 3, 4, 5].map(minutosAtras);
    const r = decidirBloqueio(cinco, [], agora);
    expect(r.bloqueado).toBe(true);
    // a 5a mais recente foi ha 5 min: libera em 10 min
    if (r.bloqueado) expect(r.liberaEm.toISOString()).toBe("2026-11-13T12:10:00.000Z");
  });

  it("erros fora da janela de 15 minutos nao contam", () => {
    expect(decidirBloqueio([1, 2, 3, 4, 16, 20].map(minutosAtras), [], agora)).toEqual({ bloqueado: false });
  });

  it("IP trava com 20 erros, nao com 19", () => {
    const dezenove = Array.from({ length: 19 }, (_, i) => minutosAtras(i * 0.5));
    expect(decidirBloqueio([], dezenove, agora).bloqueado).toBe(false);
    expect(decidirBloqueio([], [...dezenove, minutosAtras(10)], agora).bloqueado).toBe(true);
  });

  it("com os dois travados, vale a liberacao mais tarde", () => {
    const r = decidirBloqueio(
      [1, 2, 3, 4, 14].map(minutosAtras),
      Array.from({ length: 20 }, () => minutosAtras(1)),
      agora
    );
    if (!r.bloqueado) throw new Error("devia travar");
    expect(r.liberaEm.toISOString()).toBe("2026-11-13T12:14:00.000Z");
  });
});

describe("apoio", () => {
  it("mensagem com minutos arredondados para cima, singular", () => {
    expect(mensagemDeBloqueio(new Date(agora.getTime() + 30000), agora)).toContain("1 minuto.");
    expect(mensagemDeBloqueio(new Date(agora.getTime() + 9.2 * 60000), agora)).toContain("10 minutos");
  });

  it("hash ignora caixa e espacos e nao guarda o valor", () => {
    expect(resumoDe(" A@B.com ")).toBe(resumoDe("a@b.com"));
    expect(resumoDe("a@b.com")).not.toContain("a@b");
  });

  it("IP: primeiro do x-forwarded-for, senao x-real-ip", () => {
    const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });
    expect(ipDaRequisicao(h({ "x-forwarded-for": "200.1.1.1, 10.0.0.1" }))).toBe("200.1.1.1");
    expect(ipDaRequisicao(h({ "x-real-ip": "200.2.2.2" }))).toBe("200.2.2.2");
    expect(ipDaRequisicao(h({}))).toBe("desconhecido");
  });
});
