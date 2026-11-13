"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import {
  lerVersionXml,
  normalizarModelo,
  normalizarRegiao,
  urlDoVersionXml,
  type FirmwareSamsung,
} from "@/lib/dominio/ferramentas/rom-samsung";

/**
 * Ferramentas → Rom Samsung: versao mais recente de um modelo numa regiao,
 * lida do version.xml publico da Samsung (regras em
 * lib/dominio/ferramentas/rom-samsung.ts). So consulta — o download da ROM
 * fica no Bifrost, no computador da loja.
 */

export type ResultadoConsultaRom =
  | { ok: true; modelo: string; regiao: string; firmware: FirmwareSamsung }
  | { ok: false; erro: string };

const MENSAGENS = {
  REGIAO_INVALIDA: "A Samsung não tem este modelo nesta região. Confira o modelo e a região (CSC).",
  NAO_ENCONTRADO: "A Samsung não publicou ROM para este modelo nesta região.",
  RESPOSTA_ESTRANHA: "O servidor da Samsung respondeu algo inesperado. Tente de novo em instantes.",
} as const;

export async function consultarRomSamsung(modeloInformado: string, regiaoInformada: string): Promise<ResultadoConsultaRom> {
  const contexto = await exigirContextoTenant();
  if (contexto.modulosAtivos && !contexto.modulosAtivos.has("ferramentas")) {
    return { ok: false, erro: "O módulo Ferramentas não está ativo nesta loja." };
  }

  const modelo = normalizarModelo(modeloInformado);
  if (!modelo) return { ok: false, erro: "Modelo inválido. Use o formato SM-A155M (está em Configurações → Sobre o telefone)." };
  const regiao = normalizarRegiao(regiaoInformada);
  if (!regiao) return { ok: false, erro: "Região inválida. São 3 letras, como ZTO." };

  try {
    const resposta = await fetch(urlDoVersionXml(modelo, regiao), {
      headers: { "User-Agent": "Kiss2.0_FUS", Accept: "application/xml,text/xml" },
      signal: AbortSignal.timeout(12_000),
      // A versao muda no maximo algumas vezes por mes.
      next: { revalidate: 1800 },
    });
    if (resposta.status === 403 || resposta.status === 404) {
      const corpo = await resposta.text().catch(() => "");
      const lido = lerVersionXml(corpo);
      return { ok: false, erro: lido.ok ? MENSAGENS.RESPOSTA_ESTRANHA : MENSAGENS[lido.motivo === "RESPOSTA_ESTRANHA" ? "REGIAO_INVALIDA" : lido.motivo] };
    }
    if (!resposta.ok) return { ok: false, erro: MENSAGENS.RESPOSTA_ESTRANHA };
    const lido = lerVersionXml(await resposta.text());
    if (!lido.ok) return { ok: false, erro: MENSAGENS[lido.motivo] };
    return { ok: true, modelo, regiao, firmware: lido.firmware };
  } catch (erro) {
    console.error("[rom-samsung] falha na consulta", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível falar com o servidor da Samsung agora. Tente de novo em instantes." };
  }
}
