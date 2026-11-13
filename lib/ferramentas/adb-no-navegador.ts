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
