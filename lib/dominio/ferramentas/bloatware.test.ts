import { describe, expect, it } from "vitest";

import { classificarApp, classificarLista, contarBloatware, ehEssencial } from "./bloatware";

const app = (pacote: string, doSistema = true, desativado = false) => ({ pacote, doSistema, desativado });

describe("classificarApp", () => {
  it("essenciais nunca viram bloatware", () => {
    for (const p of ["com.android.phone", "com.android.systemui", "com.android.vending", "com.google.android.gms", "com.sec.android.app.launcher", "com.samsung.android.dialer"]) {
      expect(classificarApp(app(p)).classe).toBe("ESSENCIAL");
      expect(ehEssencial(p)).toBe(true);
    }
  });
  it("bloatware conhecido", () => {
    expect(classificarApp(app("com.facebook.appmanager")).classe).toBe("BLOATWARE");
    expect(classificarApp(app("com.samsung.android.app.spage")).rotulo).toBe("Samsung Free / Notícias");
    expect(classificarApp(app("com.miui.msa.global")).classe).toBe("BLOATWARE");
    expect(classificarApp(app("com.king.candycrushsaga")).classe).toBe("BLOATWARE");
  });
  it("app do usuário e app de sistema desconhecido", () => {
    expect(classificarApp(app("com.nubank.app", false)).classe).toBe("USUARIO");
    expect(classificarApp(app("com.samsung.desconhecido")).classe).toBe("SISTEMA");
  });
  it("whatsapp do usuário não é bloatware mesmo sendo popular", () => {
    expect(classificarApp(app("com.whatsapp", false)).classe).toBe("USUARIO");
  });
});

describe("lista", () => {
  it("ordena bloatware primeiro e conta os ativos", () => {
    const lista = classificarLista([
      app("com.android.phone"),
      app("com.facebook.services"),
      app("com.nubank.app", false),
      app("com.samsung.android.bixby.agent", true, true),
    ]);
    expect(lista[0]!.classe).toBe("BLOATWARE");
    expect(lista.at(-1)!.classe).toBe("ESSENCIAL");
    // bixby está desativado -> não conta
    expect(contarBloatware(lista)).toBe(1);
  });
});
