/**
 * Rom Samsung — regras puras: validar modelo/regiao, ler o version.xml do
 * servidor de atualizacao da Samsung e explicar o numero da versao.
 *
 * O version.xml (fota-cloud-dn.ospserver.net/firmware/REGIAO/MODELO/) e
 * publico e pequeno: diz a versao mais recente de um modelo numa regiao. O
 * download da ROM (3 a 8 GB) fica fora do TechOS, no Bifrost (MIT), no
 * computador da loja — ver a tela da ferramenta.
 *
 * COMO LER UM NUMERO DE VERSAO (ex.: A155MUBS3BXK1)
 *
 *   ...  U B S  3  B  X  K  1
 *            |  |  |  |  |  └ build
 *            |  |  |  |  └── mes (A = janeiro ... L = dezembro)
 *            |  |  |  └───── ano (A = 2001 ... U = 2021, X = 2024, Z = 2026)
 *            |  |  └──────── versao principal (A, B, C... sobe a cada One UI)
 *            |  └─────────── BINARIO / bootloader (0-9, depois A, B...)
 *            └────────────── S = so seguranca, U = com novidades
 *
 * O binario e o que importa na bancada: nao da para gravar uma ROM com
 * binario MENOR que o do celular (o bootloader recusa).
 */

export type FirmwareSamsung = {
  /** PDA/AP: a versao do sistema (ex.: A155MUBS3BXK1). */
  pda: string;
  csc: string;
  modem: string;
  /** Versao principal do Android, quando a Samsung informa (atributo o=). */
  android: string | null;
};

export type BuildDecodificado = {
  tipo: "SEGURANCA" | "NOVIDADES" | null;
  binario: number | null;
  versaoPrincipal: string | null;
  ano: number | null;
  mes: number | null;
};

export type ResultadoVersionXml =
  | { ok: true; firmware: FirmwareSamsung }
  | { ok: false; motivo: "REGIAO_INVALIDA" | "NAO_ENCONTRADO" | "RESPOSTA_ESTRANHA" };

/** Regioes (CSC) do Brasil. Outras podem ser digitadas. */
export const REGIOES_DO_BRASIL = [
  { codigo: "ZTO", nome: "Brasil (livre)" },
  { codigo: "ZTA", nome: "Claro" },
  { codigo: "ZVV", nome: "Vivo" },
  { codigo: "ZTM", nome: "TIM" },
] as const;

export function normalizarModelo(entrada: string): string | null {
  let modelo = String(entrada ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]\d{3}[A-Z0-9]{0,4}$/.test(modelo)) modelo = `SM-${modelo}`; // "A155M" -> "SM-A155M"
  return /^(SM|GT)-[A-Z0-9]{3,8}$/.test(modelo) ? modelo : null;
}

export function normalizarRegiao(entrada: string): string | null {
  const regiao = String(entrada ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{3}$/.test(regiao) ? regiao : null;
}

export function urlDoVersionXml(modelo: string, regiao: string): string {
  return `https://fota-cloud-dn.ospserver.net/firmware/${regiao}/${modelo}/version.xml`;
}

const decodificarEntidades = (texto: string) =>
  texto.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function lerVersionXml(xml: string): ResultadoVersionXml {
  const texto = String(xml ?? "");
  if (/<code>\s*AccessDenied\s*<\/code>/i.test(texto)) return { ok: false, motivo: "REGIAO_INVALIDA" };
  if (!/<versioninfo/i.test(texto)) {
    return /<Error>/i.test(texto) ? { ok: false, motivo: "NAO_ENCONTRADO" } : { ok: false, motivo: "RESPOSTA_ESTRANHA" };
  }
  const latest = /<latest(\s[^>]*)?>([^<]*)<\/latest>/i.exec(texto);
  const valor = latest ? decodificarEntidades(latest[2]!.trim()) : "";
  if (!valor) return { ok: false, motivo: "NAO_ENCONTRADO" };

  // "PDA/CSC/MODEM" ou "PDA/CSC/MODEM/BOOT"; MODEM vazio = aparelho so Wi-Fi.
  const partes = valor.split("/");
  const pda = partes[0] ?? "";
  if (!/^[A-Z0-9]{8,20}$/.test(pda)) return { ok: false, motivo: "RESPOSTA_ESTRANHA" };
  const android = /\so\s*=\s*["']?(\d{1,2})/.exec(latest?.[1] ?? "")?.[1] ?? null;
  return {
    ok: true,
    firmware: { pda, csc: partes[1] || pda, modem: partes[2] || "", android },
  };
}

function letraParaNumero(letra: string | undefined): number | null {
  if (!letra) return null;
  if (/^[0-9]$/.test(letra)) return Number(letra);
  if (/^[A-Z]$/.test(letra)) return 10 + letra.charCodeAt(0) - 65;
  return null;
}

/** Explica as 6 ultimas posicoes do numero de versao. */
export function decodificarBuild(build: string): BuildDecodificado {
  const b = String(build ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(b)) return { tipo: null, binario: null, versaoPrincipal: null, ano: null, mes: null };
  const c = (deTras: number) => b[b.length - deTras];
  const tipoLetra = c(6);
  const anoLetra = c(3);
  const mesLetra = c(2);
  const mes = mesLetra && /^[A-L]$/.test(mesLetra) ? mesLetra.charCodeAt(0) - 64 : null;
  const ano = anoLetra && /^[A-Z]$/.test(anoLetra) ? 2001 + anoLetra.charCodeAt(0) - 65 : null;
  const major = c(4);
  return {
    tipo: tipoLetra === "S" ? "SEGURANCA" : tipoLetra === "U" ? "NOVIDADES" : null,
    binario: letraParaNumero(c(5)),
    versaoPrincipal: major && /^[A-Z]$/.test(major) ? major : null,
    ano,
    mes,
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function rotuloDaData(d: Pick<BuildDecodificado, "ano" | "mes">): string | null {
  if (!d.ano || !d.mes) return null;
  return `${MESES[d.mes - 1]}/${d.ano}`;
}

export type Comparacao =
  | { situacao: "EM_DIA" }
  | { situacao: "DESATUALIZADO"; binarioOk: boolean }
  | { situacao: "MAIS_NOVO_QUE_O_SERVIDOR" }
  | { situacao: "OUTRO_MODELO_OU_REGIAO" };

/** Compara o que esta no celular com a versao mais recente da Samsung. */
export function compararComAparelho(
  aparelho: { modelo: string; regiao: string | null; pda: string },
  consulta: { modelo: string; regiao: string; firmware: FirmwareSamsung }
): Comparacao {
  if (aparelho.modelo !== consulta.modelo || (aparelho.regiao && aparelho.regiao !== consulta.regiao)) {
    return { situacao: "OUTRO_MODELO_OU_REGIAO" };
  }
  if (aparelho.pda === consulta.firmware.pda) return { situacao: "EM_DIA" };
  const atual = decodificarBuild(aparelho.pda);
  const novo = decodificarBuild(consulta.firmware.pda);
  if (atual.binario !== null && novo.binario !== null && novo.binario < atual.binario) {
    return { situacao: "MAIS_NOVO_QUE_O_SERVIDOR" };
  }
  const dataAtual = (atual.ano ?? 0) * 12 + (atual.mes ?? 0);
  const dataNova = (novo.ano ?? 0) * 12 + (novo.mes ?? 0);
  if (dataAtual > dataNova) return { situacao: "MAIS_NOVO_QUE_O_SERVIDOR" };
  return { situacao: "DESATUALIZADO", binarioOk: atual.binario === null || novo.binario === null || novo.binario >= atual.binario };
}

/** Texto para colar na OS. */
export function resumoParaOS(modelo: string, regiao: string, firmware: FirmwareSamsung, versaoAnterior: string | null): string {
  const linhas = [`ROM Samsung — ${modelo} (${regiao})`, `Versão gravada: ${firmware.pda} / ${firmware.csc}${firmware.modem ? ` / ${firmware.modem}` : ""}`];
  if (firmware.android) linhas.push(`Android ${firmware.android}`);
  if (versaoAnterior) linhas.push(`Versão anterior: ${versaoAnterior}`);
  return linhas.join("\n");
}
