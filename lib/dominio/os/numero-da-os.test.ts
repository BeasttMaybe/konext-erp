import { describe, expect, it } from "vitest";

import { formatarNumeroOS } from "./numero-da-os";

describe("formatarNumeroOS", () => {
  it("usa o ano da criacao, nao o de hoje", () => {
    expect(formatarNumeroOS(90, new Date("2025-06-10T12:00:00Z"))).toBe("OS-2025-090");
  });

  it("usa o fuso da loja: 31/12 as 22h em Sao Paulo ainda e o ano velho", () => {
    expect(formatarNumeroOS(7, "2027-01-01T01:30:00Z", "America/Sao_Paulo")).toBe("OS-2026-007");
  });

  it("sem data, cai no ano de hoje", () => {
    expect(formatarNumeroOS(1, null)).toBe(`OS-${new Date().getFullYear()}-001`);
  });
});
