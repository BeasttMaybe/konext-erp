import { describe, expect, it } from "vitest";

import * as app from "./cifra";
// Modulo .mjs (o mesmo formato, usado pelos scripts de banco).
import * as scripts from "../../scripts/lib/cifra.mjs";

describe("cifra do app e dos scripts falam o mesmo formato", () => {
  it("o script abre o que o app cifrou, e vice-versa", () => {
    const base64 = app.gerarChave();
    const chave = app.lerChave(base64);
    const doApp = app.cifrar("1234", chave, app.CONTEXTO_SENHA_DO_APARELHO);
    expect(scripts.decifrar(doApp, scripts.lerChave(base64), scripts.CONTEXTO_SENHA_DO_APARELHO)).toBe("1234");
    const doScript = scripts.cifrar("1-5-9", scripts.lerChave(base64), scripts.CONTEXTO_DESENHO_DO_APARELHO);
    expect(app.abrir(doScript, chave, app.CONTEXTO_DESENHO_DO_APARELHO)).toBe("1-5-9");
  });

  it("mesmos contextos", () => {
    expect(scripts.CONTEXTO_SENHA_DO_APARELHO).toBe(app.CONTEXTO_SENHA_DO_APARELHO);
    expect(scripts.CONTEXTO_DESENHO_DO_APARELHO).toBe(app.CONTEXTO_DESENHO_DO_APARELHO);
  });
});
