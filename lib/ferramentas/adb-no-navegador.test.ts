import { describe, expect, it } from "vitest";
import type { Adb } from "@yume-chan/adb";

import { bloquearApp, removerApp, varrerApps } from "./adb-no-navegador";

/** ADB de mentira: responde cada comando com a saida de um celular com adware. */
function adbFalso(respostas: (comando: string) => string, registro: string[] = []): Adb {
  return {
    subprocess: {
      noneProtocol: {
        spawnWaitText: async (comando: string) => {
          registro.push(comando);
          return respostas(comando);
        },
      },
    },
  } as unknown as Adb;
}

const CELULAR = (comando: string): string => {
  if (comando === "pm list packages -3 -i")
    return "package:com.whatsapp  installer=com.android.vending\npackage:my.tasks.mtt  installer=null\npackage:com.lanterna.flashlight  installer=com.google.android.packageinstaller\n";
  if (comando.includes("category.LAUNCHER")) return "com.whatsapp/.Main\n";
  if (comando.includes("category.HOME")) return "priority=0\ncom.sec.android.app.launcher/.Launcher\n";
  if (comando === "dumpsys device_policy") return "admin=ComponentInfo{com.lanterna.flashlight/com.lanterna.Admin}";
  if (comando.includes("enabled_accessibility_services")) return "null";
  if (comando.includes("enabled_notification_listeners")) return "com.whatsapp/com.whatsapp.Notif";
  if (comando.startsWith("dumpsys package my.tasks.mtt"))
    return "firstInstallTime=2026-11-10 10:00:00\nUser 0: installed=true suspended=false enabled=0\nSYSTEM_ALERT_WINDOW: allow";
  if (comando.startsWith("dumpsys package")) return "User 0: installed=true enabled=0\nSYSTEM_ALERT_WINDOW: default";
  return "";
};

describe("varrerApps", () => {
  it("junta os sinais e ordena do mais suspeito", async () => {
    const progresso: number[] = [];
    const apps = await varrerApps(adbFalso(CELULAR), (feitos) => progresso.push(feitos));
    expect(apps.map((a) => a.pacote)).toEqual(["my.tasks.mtt", "com.lanterna.flashlight", "com.whatsapp"]);
    const lanterna = apps.find((a) => a.pacote === "com.lanterna.flashlight")!;
    expect(lanterna.administrador).toBe(true);
    expect(lanterna.componentesAdmin).toEqual(["com.lanterna.flashlight/com.lanterna.Admin"]);
    expect(lanterna.temIcone).toBe(false);
    expect(apps.find((a) => a.pacote === "com.whatsapp")!.nivel).toBe("BAIXO");
    expect(progresso.at(-1)).toBe(3);
  });

  it("aparelho sem query-activities nao acusa todo mundo de escondido", async () => {
    const apps = await varrerApps(adbFalso((c) => (c.includes("LAUNCHER") ? "Unknown command" : CELULAR(c))), () => {});
    expect(apps.every((a) => a.temIcone)).toBe(true);
  });
});

describe("removerApp", () => {
  it("para, tenta tirar o admin e desinstala", async () => {
    const registro: string[] = [];
    const r = await removerApp(
      adbFalso((c) => (c.startsWith("pm uninstall") ? "Success" : ""), registro),
      { pacote: "com.lanterna.flashlight", componentesAdmin: ["com.lanterna.flashlight/com.lanterna.Admin"] }
    );
    expect(r.resultado).toBe("REMOVIDO");
    expect(registro).toEqual([
      "am force-stop com.lanterna.flashlight",
      "dpm remove-active-admin com.lanterna.flashlight/com.lanterna.Admin",
      "pm uninstall com.lanterna.flashlight",
    ]);
  });

  it("admin que nao sai: bloqueia e abre a tela de administradores", async () => {
    const registro: string[] = [];
    const r = await removerApp(
      adbFalso((c) => {
        if (c.startsWith("pm uninstall")) return "Failure [DELETE_FAILED_DEVICE_POLICY_MANAGER]";
        if (c.startsWith("pm disable-user")) return "Package com.x.y new state: disabled-user";
        return "";
      }, registro),
      { pacote: "com.x.y", componentesAdmin: [] }
    );
    expect(r.resultado).toBe("BLOQUEADO_POR_ADMIN");
    expect(registro).toContain("pm disable-user --user 0 com.x.y");
    expect(registro.some((c) => c.includes("DeviceAdminSettingsActivity"))).toBe(true);
  });

  it("recusa pacote com caractere de comando", async () => {
    await expect(removerApp(adbFalso(() => ""), { pacote: "com.a; rm -rf /", componentesAdmin: [] })).rejects.toThrow();
    await expect(bloquearApp(adbFalso(() => ""), "a b")).rejects.toThrow();
  });
});
