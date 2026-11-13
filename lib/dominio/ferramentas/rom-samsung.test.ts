import { describe, expect, it } from "vitest";

import {
  compararComAparelho,
  decodificarBuild,
  lerVersionXml,
  normalizarModelo,
  normalizarRegiao,
  resumoParaOS,
  rotuloDaData,
  urlDoVersionXml,
} from "./rom-samsung";

const XML = `<?xml version="1.0" encoding="UTF-8" ?>
<versioninfo>
  <url>https://fota-cloud-dn.ospserver.net/firmware/</url>
  <firmware>
    <model>SM-A155M</model>
    <cc>ZTO</cc>
    <version>
      <latest o="15">A155MUBS8DYL2/A155MZTO8DYL2/A155MUBS8DYL2/A155MUBS8DYL2</latest>
      <upgrade><value rcount="3" fwsize="123">A155MUBS6BYE1/A155MZTO6BYE1/A155MUBS6BYE1</value></upgrade>
    </version>
  </firmware>
</versioninfo>`;

describe("entrada", () => {
  it("modelo", () => {
    expect(normalizarModelo(" sm-a155m ")).toBe("SM-A155M");
    expect(normalizarModelo("A155M")).toBe("SM-A155M");
    expect(normalizarModelo("SM-S918B")).toBe("SM-S918B");
    expect(normalizarModelo("iPhone")).toBe(null);
    expect(normalizarModelo("SM-A155M/../x")).toBe(null);
  });
  it("regiao", () => {
    expect(normalizarRegiao("zto")).toBe("ZTO");
    expect(normalizarRegiao("ZT")).toBe(null);
    expect(normalizarRegiao("Z/O")).toBe(null);
  });
  it("url", () => {
    expect(urlDoVersionXml("SM-A155M", "ZTO")).toBe("https://fota-cloud-dn.ospserver.net/firmware/ZTO/SM-A155M/version.xml");
  });
});

describe("lerVersionXml", () => {
  it("le a versao mais recente e o Android", () => {
    expect(lerVersionXml(XML)).toEqual({
      ok: true,
      firmware: { pda: "A155MUBS8DYL2", csc: "A155MZTO8DYL2", modem: "A155MUBS8DYL2", android: "15" },
    });
  });
  it("aparelho so Wi-Fi (modem vazio)", () => {
    const r = lerVersionXml("<versioninfo><firmware><version><latest>X200XXU3CXK1/X200OXM3CXK1/</latest></version></firmware></versioninfo>");
    expect(r.ok && r.firmware.modem).toBe("");
    expect(r.ok && r.firmware.android).toBe(null);
  });
  it("regiao invalida e sem firmware", () => {
    expect(lerVersionXml("<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>")).toEqual({
      ok: false,
      motivo: "REGIAO_INVALIDA",
    });
    expect(lerVersionXml("<versioninfo><firmware><version><latest/></version></firmware></versioninfo>")).toEqual({
      ok: false,
      motivo: "NAO_ENCONTRADO",
    });
    expect(lerVersionXml("<html>proxy</html>")).toEqual({ ok: false, motivo: "RESPOSTA_ESTRANHA" });
  });
});

describe("decodificarBuild", () => {
  it("A155MUBS3BXK1", () => {
    expect(decodificarBuild("A155MUBS3BXK1")).toEqual({ tipo: "SEGURANCA", binario: 3, versaoPrincipal: "B", ano: 2024, mes: 11 });
  });
  it("binario acima de 9 vira letra", () => {
    expect(decodificarBuild("A155MUBSBEZG1")).toMatchObject({ binario: 11, versaoPrincipal: "E", ano: 2026, mes: 7 });
    expect(decodificarBuild("S918BXXU3BWK1")).toMatchObject({ tipo: "NOVIDADES", binario: 3, ano: 2023, mes: 11 });
  });
  it("lixo", () => {
    expect(decodificarBuild("?").binario).toBe(null);
  });
  it("rotulo da data", () => {
    expect(rotuloDaData({ ano: 2024, mes: 11 })).toBe("nov/2024");
    expect(rotuloDaData({ ano: null, mes: 1 })).toBe(null);
  });
});

describe("compararComAparelho", () => {
  const consulta = {
    modelo: "SM-A155M",
    regiao: "ZTO",
    firmware: { pda: "A155MUBS8DYL2", csc: "A155MZTO8DYL2", modem: "A155MUBS8DYL2", android: "15" },
  };
  it("em dia", () => {
    expect(compararComAparelho({ modelo: "SM-A155M", regiao: "ZTO", pda: "A155MUBS8DYL2" }, consulta).situacao).toBe("EM_DIA");
  });
  it("desatualizado com binario compativel", () => {
    expect(compararComAparelho({ modelo: "SM-A155M", regiao: "ZTO", pda: "A155MUBS3BXK1" }, consulta)).toEqual({
      situacao: "DESATUALIZADO",
      binarioOk: true,
    });
  });
  it("celular com binario maior que o do servidor", () => {
    expect(compararComAparelho({ modelo: "SM-A155M", regiao: "ZTO", pda: "A155MUBS9DZA2" }, consulta).situacao).toBe(
      "MAIS_NOVO_QUE_O_SERVIDOR"
    );
  });
  it("outro modelo", () => {
    expect(compararComAparelho({ modelo: "SM-A156M", regiao: "ZTO", pda: "x" }, consulta).situacao).toBe("OUTRO_MODELO_OU_REGIAO");
  });
  it("resumo", () => {
    expect(resumoParaOS("SM-A155M", "ZTO", consulta.firmware, "A155MUBS3BXK1")).toContain("Versão anterior: A155MUBS3BXK1");
  });
});
