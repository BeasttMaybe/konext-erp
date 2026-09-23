// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { CartaoIndicador } from "./cartao-indicador";

afterEach(() => {
  cleanup();
});

describe("CartaoIndicador", () => {
  it("sem tendenciaPercentual (ex.: KPI sem base anterior) nao mostra nenhuma linha de variacao", () => {
    render(<CartaoIndicador titulo="Faturamento" valor="R$ 0,00" />);

    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
    // Nem o simbolo de percentual nem os icones de tendencia (seta) devem
    // existir no DOM — "sem prop = nao mostra nada", nao "mostra 0%" nem
    // "mostra -100%" (regressao do KPI de faturamento sem periodo anterior).
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("com tendenciaPercentual numerica (mesmo 0) mostra a linha de variacao", () => {
    const { container } = render(
      <CartaoIndicador titulo="Faturamento" valor="R$ 100,00" tendenciaPercentual={0} />
    );

    // "+", "0" e "%" nascem em nos de texto JSX separados — comparar pelo
    // textContent do paragrafo inteiro em vez de getByText com uma string
    // exata, que quebraria por causa da fragmentacao dos nos.
    const linhaTendencia = container.querySelector("p.text-kx-sucesso, p.text-kx-erro");
    expect(linhaTendencia?.textContent).toBe("+0%");
  });

  it("tendencia negativa mostra o percentual sem sinal de '+' e a seta pra baixo", () => {
    const { container } = render(
      <CartaoIndicador titulo="Faturamento" valor="R$ 50,00" tendenciaPercentual={-50} />
    );

    const linhaTendencia = container.querySelector("p.text-kx-sucesso, p.text-kx-erro");
    expect(linhaTendencia?.textContent).toBe("-50%");
  });
});
