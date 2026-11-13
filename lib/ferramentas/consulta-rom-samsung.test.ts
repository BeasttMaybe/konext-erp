import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant/exigir-contexto-tenant", () => ({
  exigirContextoTenant: vi.fn(async () => ({ modulosAtivos: new Set(["ferramentas"]) })),
}));

import { consultarRomSamsung } from "@/app/actions/rom-samsung";

const XML = `<versioninfo><firmware><version><latest o="15">A155MUBS8DYL2/A155MZTO8DYL2/A155MUBS8DYL2/A155MUBS8DYL2</latest></version></firmware></versioninfo>`;

afterEach(() => vi.unstubAllGlobals());

describe("consultarRomSamsung", () => {
  it("monta a URL da Samsung e le a versao", async () => {
    const fetchFalso = vi.fn(async (_url: string) => new Response(XML, { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const r = await consultarRomSamsung("a155m", "zto");
    expect(r).toEqual({
      ok: true,
      modelo: "SM-A155M",
      regiao: "ZTO",
      firmware: { pda: "A155MUBS8DYL2", csc: "A155MZTO8DYL2", modem: "A155MUBS8DYL2", android: "15" },
    });
    expect(fetchFalso.mock.calls[0]![0]).toBe("https://fota-cloud-dn.ospserver.net/firmware/ZTO/SM-A155M/version.xml");
  });

  it("regiao errada vira mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 })));
    const r = await consultarRomSamsung("SM-A155M", "XYZ");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/região/);
  });

  it("nao chama a Samsung com entrada invalida, e sobrevive a rede fora", async () => {
    const fetchFalso = vi.fn(async () => {
      throw new Error("rede");
    });
    vi.stubGlobal("fetch", fetchFalso);
    expect((await consultarRomSamsung("../../x", "ZTO")).ok).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
    const r = await consultarRomSamsung("SM-A155M", "ZTO");
    expect(!r.ok && r.erro).toMatch(/servidor da Samsung/);
  });
});
