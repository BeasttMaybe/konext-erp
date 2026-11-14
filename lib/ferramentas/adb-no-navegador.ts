/**
 * Conversa com o celular Android pelo cabo USB, direto do navegador (WebUSB +
 * protocolo ADB, biblioteca Tango — MIT). Nada e instalado no computador e
 * nada sai do navegador: o servidor do TechOS nao ve a lista de apps.
 *
 * Requisitos (mostrados na tela antes de conectar):
 * - Chrome ou Edge no computador (Firefox e Safari nao tem WebUSB);
 * - "Depuracao USB" ligada no celular e o "Permitir" aceito na tela dele;
 * - nenhum outro programa segurando o celular (adb, Samsung Smart Switch,
 *   Android Studio, scrcpy) — o USB so tem um dono por vez.
 *
 * Este arquivo so roda no navegador; as bibliotecas sao carregadas sob
 * demanda, quando o tecnico clica em conectar.
 */
import type { Adb } from "@yume-chan/adb";

import { montarRetrato, type RetratoDoArmazenamento } from "@/lib/dominio/ferramentas/armazenamento";
import { classificarLista, ehEssencial, type AppClassificado } from "@/lib/dominio/ferramentas/bloatware";
import {
  analisarApp,
  lerAdministradores,
  lerAppEmFoco,
  lerDetalheDoPacote,
  lerListaDePacotes,
  lerPacotesDeComponentes,
  lerResultadoDaDesinstalacao,
  lerServicosHabilitados,
  ordenarPorSuspeita,
  pacoteValido,
  type AppAnalisado,
  type ResultadoDaRemocao,
} from "@/lib/dominio/ferramentas/remocao-de-virus";

export type CelularConectado = {
  adb: Adb;
  fabricante: string;
  modelo: string;
  android: string;
  serial: string;
};

export class ErroDeConexao extends Error {}

export function webUsbDisponivel(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator && typeof window !== "undefined" && window.isSecureContext;
}

/**
 * Abre a janela do navegador para escolher o celular e autentica no ADB. A
 * promessa so termina depois que alguem toca em "Permitir" no celular.
 */
export async function conectarCelular(): Promise<CelularConectado | null> {
  const [{ Adb, AdbDaemonTransport }, { AdbDaemonWebUsbDeviceManager, AdbDaemonWebUsbDevice }, credenciais] = await Promise.all([
    import("@yume-chan/adb"),
    import("@yume-chan/adb-daemon-webusb"),
    import("@yume-chan/adb-credential-web"),
  ]);
  const gerenciador = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!gerenciador) throw new ErroDeConexao("Este navegador não acessa USB. Use o Chrome ou o Edge no computador.");

  const dispositivo = await gerenciador.requestDevice();
  if (!dispositivo) return null;

  let conexao;
  try {
    conexao = await dispositivo.connect();
  } catch (erro) {
    if (erro instanceof AdbDaemonWebUsbDevice.DeviceBusyError) {
      throw new ErroDeConexao(
        "O celular está ocupado por outro programa (ADB, Samsung Smart Switch, Android Studio, scrcpy). Feche esse programa — no Prompt de Comando: adb kill-server — e tente de novo."
      );
    }
    throw new ErroDeConexao(
      "Não foi possível abrir o celular. Desconecte e conecte o cabo, confira se a Depuração USB está ligada e tente de novo."
    );
  }

  const CredentialStore = credenciais.default;
  const transporte = await AdbDaemonTransport.authenticate({
    serial: dispositivo.serial,
    connection: conexao,
    credentialStore: new CredentialStore("TechOS ERP"),
  });
  const adb = new Adb(transporte);
  const [fabricante, modelo, android] = await Promise.all([
    adb.getProp("ro.product.manufacturer"),
    adb.getProp("ro.product.model"),
    adb.getProp("ro.build.version.release"),
  ]);
  return { adb, fabricante: fabricante.trim(), modelo: modelo.trim(), android: android.trim(), serial: dispositivo.serial };
}

export async function desconectar(celular: CelularConectado | null): Promise<void> {
  try {
    await celular?.adb.close();
  } catch {
    // ja desconectado (cabo puxado)
  }
}

async function shell(adb: Adb, comando: string): Promise<string> {
  try {
    return await adb.subprocess.noneProtocol.spawnWaitText(comando);
  } catch {
    return "";
  }
}

function exigirPacote(pacote: string): string {
  if (!pacoteValido(pacote)) throw new Error("Pacote inválido.");
  return pacote;
}

/** Roda `tarefa` sobre a lista com no maximo `paralelo` ao mesmo tempo. */
async function emLotes<T, R>(itens: readonly T[], paralelo: number, tarefa: (item: T) => Promise<R>, aoAvancar: () => void): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(paralelo, itens.length) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      resultados[indice] = await tarefa(itens[indice]!);
      aoAvancar();
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

/**
 * Varredura: lista os apps instalados pelo usuario, levanta os sinais de cada
 * um e devolve do mais suspeito para o menos. `aoProgresso(feitos, total)`.
 */
export async function varrerApps(adb: Adb, aoProgresso: (feitos: number, total: number) => void): Promise<AppAnalisado[]> {
  const [pacotesTexto, launcherTexto, homeTexto, adminTexto, acessibilidadeTexto, notificacoesTexto] = await Promise.all([
    shell(adb, "pm list packages -3 -i"),
    shell(adb, "cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER"),
    shell(adb, "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME"),
    shell(adb, "dumpsys device_policy"),
    shell(adb, "settings get secure enabled_accessibility_services"),
    shell(adb, "settings get secure enabled_notification_listeners"),
  ]);

  const pacotes = lerListaDePacotes(pacotesTexto);
  const comIcone = lerPacotesDeComponentes(launcherTexto);
  // Aparelho antigo sem `cmd package query-activities`: sem a informacao,
  // ninguem e acusado de estar escondido.
  const iconeConhecido = comIcone.size > 0;
  const linhasHome = homeTexto.trim().split(/\r?\n/);
  const telaInicial = lerPacotesDeComponentes(linhasHome[linhasHome.length - 1] ?? "");
  const admins = lerAdministradores(adminTexto);
  const acessibilidade = lerServicosHabilitados(acessibilidadeTexto);
  const notificacoes = lerServicosHabilitados(notificacoesTexto);

  let feitos = 0;
  aoProgresso(0, pacotes.length);
  const agora = new Date();
  const analisados = await emLotes(
    pacotes,
    4,
    async ({ pacote, instalador }) => {
      const detalhe = lerDetalheDoPacote(
        await shell(adb, `dumpsys package ${exigirPacote(pacote)}; appops get ${pacote} SYSTEM_ALERT_WINDOW`)
      );
      const componentesAdmin = admins.filter((c) => c.startsWith(`${pacote}/`));
      return analisarApp(
        {
          pacote,
          instalador,
          temIcone: iconeConhecido ? comIcone.has(pacote) : true,
          sobreOutrosApps: detalhe.sobreOutrosApps ?? detalhe.permissoes.has("android.permission.SYSTEM_ALERT_WINDOW"),
          administrador: componentesAdmin.length > 0,
          acessibilidade: acessibilidade.has(pacote),
          leitorDeNotificacoes: notificacoes.has(pacote),
          telaInicialPadrao: telaInicial.has(pacote),
          permissoes: detalhe.permissoes,
          instaladoEm: detalhe.instaladoEm,
          versao: detalhe.versao,
          desativado: detalhe.desativado,
          suspenso: detalhe.suspenso,
          componentesAdmin,
        },
        agora
      );
    },
    () => aoProgresso(++feitos, pacotes.length)
  );
  return ordenarPorSuspeita(analisados);
}

/** Qual app esta na tela agora — para pegar o anuncio "no flagra". */
export async function appNaTela(adb: Adb): Promise<string | null> {
  return lerAppEmFoco(await shell(adb, "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"));
}

export type ResultadoDaAcao = { resultado: ResultadoDaRemocao; detalhe: string };

/**
 * Desinstala. Para o app primeiro (o anuncio some na hora), tira o
 * administrador quando o Android deixa, e desinstala. Se o administrador
 * bloquear, BLOQUEIA o app (sem anuncio, sem rodar) e abre no celular a tela
 * de administradores para o tecnico desmarcar — depois e so tentar de novo.
 */
export async function removerApp(adb: Adb, app: Pick<AppAnalisado, "pacote" | "componentesAdmin">): Promise<ResultadoDaAcao> {
  const pacote = exigirPacote(app.pacote);
  await shell(adb, `am force-stop ${pacote}`);
  for (const componente of app.componentesAdmin) {
    if (/^[\w.]+\/[\w.$]+$/.test(componente)) await shell(adb, `dpm remove-active-admin ${componente}`);
  }
  let saida = await shell(adb, `pm uninstall ${pacote}`);
  let resultado = lerResultadoDaDesinstalacao(saida);
  if (resultado === "FALHOU") {
    saida = await shell(adb, `pm uninstall --user 0 ${pacote}`);
    resultado = lerResultadoDaDesinstalacao(saida);
  }
  if (resultado === "BLOQUEADO_POR_ADMIN") {
    await bloquearApp(adb, pacote);
    await abrirAdministradoresNoCelular(adb);
    return {
      resultado,
      detalhe:
        "O app é administrador do dispositivo e o Android não deixou remover. Ele já foi bloqueado (não abre mais anúncio). No celular abriu a tela de administradores: desative o app ali e clique em Remover de novo.",
    };
  }
  return { resultado, detalhe: resultado === "REMOVIDO" ? "Removido." : saida.trim().slice(0, 200) || "O Android recusou a remoção." };
}

/**
 * Bloqueia sem desinstalar: para o app, tira a permissao de abrir por cima e
 * desativa. Some da tela e nao roda mais; da para reativar depois.
 */
export async function bloquearApp(adb: Adb, pacoteInformado: string): Promise<boolean> {
  const pacote = exigirPacote(pacoteInformado);
  await shell(adb, `am force-stop ${pacote}`);
  await shell(adb, `appops set ${pacote} SYSTEM_ALERT_WINDOW deny`);
  const saida = await shell(adb, `pm disable-user --user 0 ${pacote}`);
  if (/disabled/i.test(saida)) return true;
  // Android que nao deixa desativar (admin ativo): suspende.
  const suspenso = await shell(adb, `pm suspend ${pacote}`);
  return /suspended/i.test(suspenso) && !/false/i.test(suspenso);
}

export async function abrirAppNoCelular(adb: Adb, pacote: string): Promise<void> {
  await shell(adb, `am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:${exigirPacote(pacote)}`);
}

async function abrirAdministradoresNoCelular(adb: Adb): Promise<void> {
  const saida = await shell(adb, "am start -n com.android.settings/.Settings\\$DeviceAdminSettingsActivity");
  if (/Error|Exception/i.test(saida)) await shell(adb, "am start -a android.settings.SECURITY_SETTINGS");
}

export type InfoSamsung = {
  samsung: boolean;
  modelo: string;
  regiao: string | null;
  /** Versao do sistema gravada (ex.: A155MUBS3BXK1) */
  pda: string | null;
  bootloader: string | null;
  android: string;
};

/** Modelo, regiao (CSC) e versao atual — para a ferramenta Rom Samsung. */
export async function lerInfoSamsung(celular: CelularConectado): Promise<InfoSamsung> {
  const prop = async (chave: string) => (await celular.adb.getProp(chave).catch(() => "")).trim();
  const [modelo, csc1, csc2, pda, bootloader] = await Promise.all([
    prop("ro.product.model"),
    prop("ro.csc.sales_code"),
    prop("ro.boot.sales_code"),
    prop("ro.build.PDA"),
    prop("ro.boot.bootloader"),
  ]);
  const regiao = (csc1 || csc2).toUpperCase();
  return {
    samsung: celular.fabricante.toLowerCase() === "samsung",
    modelo: modelo.toUpperCase(),
    regiao: /^[A-Z0-9]{3}$/.test(regiao) ? regiao : null,
    pda: pda || bootloader || null,
    bootloader: bootloader || null,
    android: celular.android,
  };
}

// ── Armazenamento ("o que está pesando") ─────────────────────────────────────

/**
 * Retrato do armazenamento: espaço livre, apps que mais ocupam e pastas do
 * cartão. `du` pode demorar em cartão cheio, por isso o timeout maior fica a
 * cargo do subprocess do Tango.
 */
export async function analisarArmazenamento(adb: Adb): Promise<RetratoDoArmazenamento> {
  const [diskstats, du] = await Promise.all([
    shell(adb, "dumpsys diskstats"),
    shell(adb, "du -k -d 1 /sdcard 2>/dev/null"),
  ]);
  return montarRetrato(diskstats, du);
}

/**
 * Limpa o cache de todos os apps sem apagar fotos, conversas ou dados: o
 * Android escolhe o que descartar para liberar o espaço pedido. Devolve o
 * espaço livre antes e depois para mostrar quanto rendeu.
 */
export async function limparCache(adb: Adb): Promise<{ antes: number | null; depois: number | null }> {
  const { lerEspacoDoDiskstats } = await import("@/lib/dominio/ferramentas/armazenamento");
  const antes = lerEspacoDoDiskstats(await shell(adb, "dumpsys diskstats"));
  // "trim-caches" pede um tamanho-alvo; um número enorme força limpar tudo.
  await shell(adb, "pm trim-caches 9999999999999");
  const depois = lerEspacoDoDiskstats(await shell(adb, "dumpsys diskstats"));
  return { antes: antes?.livre ?? null, depois: depois?.livre ?? null };
}

// ── Limpeza de apps (bloatware) ──────────────────────────────────────────────

/**
 * Lista os apps do aparelho (de fábrica e do usuário) já classificados
 * (lib/dominio/ferramentas/bloatware.ts), para a limpeza de bloatware.
 */
export async function listarAppsDoAparelho(adb: Adb): Promise<AppClassificado[]> {
  const [todos, sistema, desativados] = await Promise.all([
    shell(adb, "pm list packages"),
    shell(adb, "pm list packages -s"),
    shell(adb, "pm list packages -d"),
  ]);
  const comoSet = (saida: string) =>
    new Set(
      saida
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^package:/, ""))
        .filter((p) => /^[a-zA-Z][\w.]+$/.test(p))
    );
  const doSistema = comoSet(sistema);
  const off = comoSet(desativados);
  const lista = [...comoSet(todos)].map((pacote) => ({
    pacote,
    doSistema: doSistema.has(pacote),
    desativado: off.has(pacote),
  }));
  return classificarLista(lista);
}

export type ResultadoLimpezaApp = { pacote: string; ok: boolean; detalhe: string };

/**
 * "Remove" um app de fábrica do jeito reversível: desinstala só para o
 * usuário atual (`pm uninstall --user 0`), que é como o Android esconde
 * bloatware sem mexer na partição — dá para trazer de volta com uma
 * restauração de fábrica ou `cmd package install-existing`. App do usuário é
 * desinstalado de vez. Recusa qualquer pacote essencial, por segurança.
 */
export async function desativarAppEmLote(adb: Adb, pacotes: readonly string[]): Promise<ResultadoLimpezaApp[]> {
  const resultados: ResultadoLimpezaApp[] = [];
  for (const bruto of pacotes) {
    const pacote = String(bruto).trim();
    if (!/^[a-zA-Z][\w.]+$/.test(pacote)) {
      resultados.push({ pacote, ok: false, detalhe: "Pacote inválido." });
      continue;
    }
    if (ehEssencial(pacote)) {
      resultados.push({ pacote, ok: false, detalhe: "App essencial — bloqueado por segurança." });
      continue;
    }
    const saida = await shell(adb, `pm uninstall --user 0 ${pacote}`);
    if (/\bSuccess\b/.test(saida)) {
      resultados.push({ pacote, ok: true, detalhe: "Removido deste aparelho (reversível)." });
      continue;
    }
    // Alguns apps de sistema não deixam desinstalar; aí desativa.
    const off = await shell(adb, `pm disable-user --user 0 ${pacote}`);
    resultados.push(
      /disabled/i.test(off)
        ? { pacote, ok: true, detalhe: "Desativado." }
        : { pacote, ok: false, detalhe: (saida || off).trim().slice(0, 120) || "O Android recusou." }
    );
  }
  return resultados;
}
