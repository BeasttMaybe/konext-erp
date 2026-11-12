import { describe, expect, it } from "vitest";

import { mensagemDeErroDaCamera } from "./camera";

const erro = (name: string) => Object.assign(new Error("x"), { name });

describe("mensagemDeErroDaCamera", () => {
  it("permissao negada diz onde liberar no iPhone", () => {
    expect(mensagemDeErroDaCamera(erro("NotAllowedError"))).toContain("Ajustes");
  });

  it("cada causa conhecida tem mensagem propria", () => {
    const mensagens = ["NotAllowedError", "NotFoundError", "NotReadableError", "ContextoInseguro"].map((nome) =>
      mensagemDeErroDaCamera(erro(nome))
    );
    expect(new Set(mensagens).size).toBe(4);
  });

  it("qualquer outra coisa tem uma mensagem generica, sem lancar", () => {
    expect(mensagemDeErroDaCamera("texto solto")).toMatch(/Não foi possível/);
    expect(mensagemDeErroDaCamera(undefined)).toMatch(/Não foi possível/);
  });
});
