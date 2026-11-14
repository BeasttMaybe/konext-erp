import { describe, expect, it } from "vitest";

import {
  formatarBytes,
  lerAppsDoDiskstats,
  lerEspacoDoDiskstats,
  lerPastasDoDu,
  montarRetrato,
  nomeDaPasta,
  percentualUsado,
} from "./armazenamento";

const DISKSTATS = `Latency: 0ms
Data-Free: 5242880K / 52428800K total = 10% free
Cache-Free: 1000K
Package Names: [com.whatsapp, com.instagram.android, bad name, com.jogo.x]
App Sizes: [104857600, 209715200, 1, 52428800]
App Data Sizes: [3221225472, 1073741824, 1, 104857600]
Cache Sizes: [524288000, 268435456, 1, 10485760]`;

const DU = `8388608\t/sdcard/DCIM
2097152\t/sdcard/WhatsApp
512000\t/sdcard/Download
52428800\t/sdcard
0\t/sdcard/Empty`;

describe("formatação", () => {
  it("bytes legíveis", () => {
    expect(formatarBytes(0)).toBe("0 B");
    expect(formatarBytes(1024)).toBe("1 KB");
    expect(formatarBytes(1536)).toBe("1,5 KB");
    expect(formatarBytes(5 * 1024 ** 3)).toBe("5 GB");
    expect(formatarBytes(-1)).toBe("—");
  });
  it("percentual usado", () => {
    expect(percentualUsado({ livre: 10, total: 100 })).toBe(90);
    expect(percentualUsado(null)).toBe(null);
    expect(percentualUsado({ livre: 0, total: 0 })).toBe(null);
  });
});

describe("diskstats", () => {
  it("espaço livre e total em bytes", () => {
    expect(lerEspacoDoDiskstats(DISKSTATS)).toEqual({ livre: 5242880 * 1024, total: 52428800 * 1024 });
    expect(lerEspacoDoDiskstats("nada")).toBe(null);
  });
  it("apps: app+dados menos cache, ignora pacote inválido", () => {
    const apps = lerAppsDoDiskstats(DISKSTATS);
    expect(apps.map((a) => a.pacote)).toEqual(["com.whatsapp", "com.instagram.android", "com.jogo.x"]);
    // whatsapp: 104857600 + 3221225472 - 524288000
    expect(apps[0]).toEqual({ pacote: "com.whatsapp", tamanho: 104857600 + 3221225472 - 524288000, cache: 524288000 });
  });
});

describe("du", () => {
  it("pastas sem a raiz, maior ordenação via montarRetrato", () => {
    const pastas = lerPastasDoDu(DU);
    expect(pastas.map((p) => p.caminho)).toEqual(["/sdcard/DCIM", "/sdcard/WhatsApp", "/sdcard/Download", "/sdcard/Empty"]);
    expect(pastas[0]!.tamanho).toBe(8388608 * 1024);
  });
  it("nomes amigáveis", () => {
    expect(nomeDaPasta("/sdcard/DCIM")).toBe("Fotos e vídeos (câmera)");
    expect(nomeDaPasta("/sdcard/WhatsApp")).toBe("WhatsApp");
    expect(nomeDaPasta("/sdcard/MinhaPasta")).toBe("Minhapasta");
  });
});

describe("montarRetrato", () => {
  it("junta tudo, ordena e soma cache", () => {
    const r = montarRetrato(DISKSTATS, DU, { topApps: 2, topPastas: 2 });
    expect(percentualUsado(r.espaco)).toBe(90);
    expect(r.apps).toHaveLength(2);
    expect(r.apps[0]!.pacote).toBe("com.whatsapp");
    expect(r.pastas.map((p) => p.caminho)).toEqual(["/sdcard/DCIM", "/sdcard/WhatsApp"]);
    expect(r.cacheTotal).toBe(524288000 + 268435456 + 10485760);
  });
});
