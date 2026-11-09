import { describe, expect, it } from "vitest";

import { motivoDeNaoPoderEditar, podeEditar, type StatusProposta } from "./situacao";

/**
 * A regra de "pode editar?" mora num lugar só porque a tela e a action
 * precisam dar a MESMA resposta. Se a tela liberasse o botão e a action
 * recusasse, a pessoa preencheria o formulário inteiro para descobrir no
 * fim — que é o atrito que esta regra existe para evitar.
 */
describe("podeEditar", () => {
  it("libera enquanto o cliente não respondeu", () => {
    expect(podeEditar("RASCUNHO")).toBe(true);
    expect(podeEditar("ENVIADA")).toBe(true);
  });

  it("bloqueia depois da resposta do cliente", () => {
    // Reescrever uma proposta respondida apaga o que o cliente de fato
    // aprovou ou recusou. O caminho certo é duplicar.
    expect(podeEditar("APROVADA")).toBe(false);
    expect(podeEditar("REJEITADA")).toBe(false);
  });

  it("explica o bloqueio e aponta a saída, em vez de só negar", () => {
    for (const status of ["APROVADA", "REJEITADA"] as StatusProposta[]) {
      const motivo = motivoDeNaoPoderEditar(status);
      expect(motivo).toBeTruthy();
      expect(motivo).toContain("Duplicar");
    }
  });

  it("não inventa motivo para quem pode editar", () => {
    expect(motivoDeNaoPoderEditar("RASCUNHO")).toBeNull();
    expect(motivoDeNaoPoderEditar("ENVIADA")).toBeNull();
  });
});
