import { describe, expect, it } from "vitest";

import {
  analisarApp,
  ehConfiavel,
  lerAdministradores,
  lerAppEmFoco,
  lerDetalheDoPacote,
  lerListaDePacotes,
  lerListaSimples,
  lerPacotesDeComponentes,
  lerResultadoDaDesinstalacao,
  lerServicosHabilitados,
  montarRelatorio,
  ordenarPorSuspeita,
  type AppDoCelular,
} from "./remocao-de-virus";

const base: AppDoCelular = {
  pacote: "com.exemplo.app",
  instalador: "com.android.vending",
  temIcone: true,
  sobreOutrosApps: false,
  administrador: false,
  acessibilidade: false,
  leitorDeNotificacoes: false,
  telaInicialPadrao: false,
  permissoes: new Set(),
  instaladoEm: null,
  versao: null,
  desativado: false,
  suspenso: false,
  componentesAdmin: [],
};

describe("leitura dos comandos", () => {
  it("pm list packages -3 -i", () => {
    const saida = [
      "package:com.whatsapp  installer=com.android.vending",
      "package:my.tasks.mtt  installer=null",
      "package:com.foo.cleaner installer=com.google.android.packageinstaller",
      "lixo",
      "",
    ].join("\n");
    expect(lerListaDePacotes(saida)).toEqual([
      { pacote: "com.whatsapp", instalador: "com.android.vending" },
      { pacote: "my.tasks.mtt", instalador: null },
      { pacote: "com.foo.cleaner", instalador: "com.google.android.packageinstaller" },
    ]);
  });

  it("componentes de launcher e tela inicial", () => {
    const saida = "com.whatsapp/.Main\n  com.foo.cleaner/com.foo.cleaner.ui.Splash\npriority=0";
    expect([...lerPacotesDeComponentes(saida)]).toEqual(["com.whatsapp", "com.foo.cleaner"]);
  });

  it("servicos habilitados (acessibilidade/notificacoes)", () => {
    expect([...lerServicosHabilitados("com.a.b/com.a.b.Svc:com.c.d/.X\n")]).toEqual(["com.a.b", "com.c.d"]);
    expect(lerServicosHabilitados("null").size).toBe(0);
  });

  it("administradores do dispositivo", () => {
    const saida = `Enabled Device Admins (User 0, provisioningState: 0):
  com.veniosg.dir.android.fm/com.veniosg.dir.android.Admin:
    uid=10200
    admin=ComponentInfo{com.veniosg.dir.android.fm/com.veniosg.dir.android.Admin}
  ComponentInfo{com.google.android.gms/com.google.android.gms.mdm.receivers.MdmDeviceAdminReceiver}`;
    expect(lerAdministradores(saida)).toEqual([
      "com.veniosg.dir.android.fm/com.veniosg.dir.android.Admin",
      "com.google.android.gms/com.google.android.gms.mdm.receivers.MdmDeviceAdminReceiver",
    ]);
  });

  it("lista simples do appops", () => {
    expect([...lerListaSimples("com.a.b\ncom.c.d\n\nNo operations.")]).toEqual(["com.a.b", "com.c.d"]);
  });

  it("detalhe do pacote", () => {
    const saida = `Packages:
  Package [my.tasks.mtt] (abc):
    versionName=2.1
    firstInstallTime=2026-11-01 10:20:30
    requested permissions:
      android.permission.SYSTEM_ALERT_WINDOW
      android.permission.RECEIVE_BOOT_COMPLETED
    User 0: ceDataInode=1 installed=true hidden=false suspended=false distractionFlags=0 stopped=false notLaunched=false enabled=0 instant=false virtual=false
SYSTEM_ALERT_WINDOW: allow; time=+1d`;
    const d = lerDetalheDoPacote(saida);
    expect(d.instaladoEm).toBe("2026-11-01T10:20:30");
    expect(d.versao).toBe("2.1");
    expect(d.permissoes.has("android.permission.RECEIVE_BOOT_COMPLETED")).toBe(true);
    expect(d.desativado).toBe(false);
    expect(d.sobreOutrosApps).toBe(true);
    expect(lerDetalheDoPacote("User 0: installed=true suspended=true enabled=3").desativado).toBe(true);
    expect(lerDetalheDoPacote("nada").sobreOutrosApps).toBe(null);
  });

  it("app em foco", () => {
    expect(lerAppEmFoco("  mCurrentFocus=Window{a1b2 u0 my.tasks.mtt/com.mbridge.msdk.AdActivity}")).toBe("my.tasks.mtt");
    expect(lerAppEmFoco("mCurrentFocus=null\n  mFocusedApp=ActivityRecord{x u0 com.foo.bar/.Main t12}")).toBe("com.foo.bar");
    expect(lerAppEmFoco("nada")).toBe(null);
  });

  it("resultado da desinstalacao", () => {
    expect(lerResultadoDaDesinstalacao("Success\n")).toBe("REMOVIDO");
    expect(lerResultadoDaDesinstalacao("Failure [DELETE_FAILED_DEVICE_POLICY_MANAGER]")).toBe("BLOQUEADO_POR_ADMIN");
    expect(lerResultadoDaDesinstalacao("Failure [DELETE_FAILED_INTERNAL_ERROR]")).toBe("FALHOU");
  });
});

describe("pontuacao", () => {
  const agora = new Date("2026-11-13T12:00:00Z");

  it("app normal da loja fica baixo", () => {
    expect(analisarApp(base, agora).nivel).toBe("BAIXO");
  });

  it("adware classico: escondido, sobreposicao, APK, recente", () => {
    const r = analisarApp(
      { ...base, pacote: "com.flashlight.pro", instalador: null, temIcone: false, sobreOutrosApps: true, instaladoEm: "2026-11-10T10:00:00" },
      agora
    );
    expect(r.nivel).toBe("ALTO");
    expect(r.sinais.map((s) => s.id)).toEqual(expect.arrayContaining(["sem-icone", "sobreposicao", "fora-da-loja", "nome", "recente"]));
  });

  it("administrador sozinho + fora da loja ja e medio/alto", () => {
    expect(analisarApp({ ...base, instalador: null, administrador: true }, agora).nivel).toBe("ALTO");
  });

  it("app confiavel da loja nao pontua, mas o mesmo pacote por APK sim", () => {
    const whats = { ...base, pacote: "com.whatsapp", leitorDeNotificacoes: true, sobreOutrosApps: true };
    expect(ehConfiavel(whats)).toBe(true);
    expect(analisarApp(whats, agora).pontos).toBe(0);
    expect(analisarApp({ ...whats, instalador: null }, agora).pontos).toBeGreaterThan(0);
    expect(ehConfiavel({ pacote: "com.whatsappfake", instalador: "com.android.vending" })).toBe(false);
  });

  it("malicioso conhecido sempre alto", () => {
    expect(analisarApp({ ...base, pacote: "my.tasks.mtt" }, agora).nivel).toBe("ALTO");
    expect(analisarApp({ ...base, pacote: "com.gbwhatsapp" }, agora).conhecidoComoMalicioso).toBe(true);
  });

  it("ordena do mais suspeito", () => {
    const lista = ordenarPorSuspeita([analisarApp(base, agora), analisarApp({ ...base, pacote: "my.tasks.mtt" }, agora)]);
    expect(lista[0]!.pacote).toBe("my.tasks.mtt");
  });

  it("relatorio", () => {
    expect(montarRelatorio("Samsung SM-A155M", agora, ["my.tasks.mtt"], [], 80)).toContain("Removidos (1): my.tasks.mtt");
  });
});
