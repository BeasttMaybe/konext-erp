"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Cable,
  CheckCircle2,
  ClipboardCopy,
  Crosshair,
  ExternalLink,
  Loader2,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  Smartphone,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { montarRelatorio, type AppAnalisado, type NivelDeSuspeita } from "@/lib/dominio/ferramentas/remocao-de-virus";
import type { CelularConectado } from "@/lib/ferramentas/adb-no-navegador";
import { cn } from "@/lib/utils";

type Estado =
  | { fase: "DESCONECTADO" }
  | { fase: "CONECTANDO" }
  | { fase: "CONECTADO" }
  | { fase: "VARRENDO"; feitos: number; total: number };

type Situacao = "REMOVIDO" | "BLOQUEADO" | "PRECISA_ADMIN" | null;

const ESTILO_NIVEL: Record<NivelDeSuspeita, { rotulo: string; classe: string }> = {
  ALTO: { rotulo: "Muito suspeito", classe: "bg-kx-erro-fundo text-kx-erro-texto border-kx-erro-borda" },
  MEDIO: { rotulo: "Suspeito", classe: "bg-kx-alerta-fundo text-kx-alerta-texto border-kx-alerta" },
  BAIXO: { rotulo: "Normal", classe: "bg-kx-superficie text-kx-texto-2 border-kx-painel-borda" },
};

/** As bibliotecas de USB/ADB so carregam quando alguem clica em conectar. */
const carregarAdb = () => import("@/lib/ferramentas/adb-no-navegador");

export function RemocaoDeVirus() {
  const [suporte, setSuporte] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "DESCONECTADO" });
  const [erro, setErro] = useState<string | null>(null);
  const celularRef = useRef<CelularConectado | null>(null);
  const [celular, setCelular] = useState<Omit<CelularConectado, "adb"> | null>(null);
  const [apps, setApps] = useState<AppAnalisado[] | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [situacao, setSituacao] = useState<Record<string, Situacao>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ pacote: string; texto: string } | null>(null);
  const [emFoco, setEmFoco] = useState<string | null>(null);
  const [confirmarLote, setConfirmarLote] = useState(false);

  useEffect(() => {
    void carregarAdb().then((m) => setSuporte(m.webUsbDisponivel()));
    return () => {
      void carregarAdb().then((m) => m.desconectar(celularRef.current));
    };
  }, []);

  const conectar = async () => {
    setErro(null);
    setEstado({ fase: "CONECTANDO" });
    try {
      const m = await carregarAdb();
      const conectado = await m.conectarCelular();
      if (!conectado) {
        setEstado({ fase: "DESCONECTADO" });
        return;
      }
      celularRef.current = conectado;
      setCelular({ fabricante: conectado.fabricante, modelo: conectado.modelo, android: conectado.android, serial: conectado.serial });
      setEstado({ fase: "CONECTADO" });
      void conectado.adb.disconnected.then(() => {
        if (celularRef.current === conectado) {
          celularRef.current = null;
          setCelular(null);
          setEstado({ fase: "DESCONECTADO" });
          toast.info("Celular desconectado.");
        }
      });
    } catch (falha) {
      setEstado({ fase: "DESCONECTADO" });
      const m = await carregarAdb();
      if (falha instanceof m.ErroDeConexao) setErro(falha.message);
      else if (falha instanceof DOMException && falha.name === "NotFoundError") setErro(null); // fechou a janela
      else setErro("Não foi possível conectar. Desbloqueie o celular, aceite o \"Permitir depuração USB\" e tente de novo.");
    }
  };

  const desconectarCelular = async () => {
    const m = await carregarAdb();
    const atual = celularRef.current;
    celularRef.current = null;
    await m.desconectar(atual);
    setCelular(null);
    setApps(null);
    setSituacao({});
    setEmFoco(null);
    setEstado({ fase: "DESCONECTADO" });
  };

  const varrer = async () => {
    const atual = celularRef.current;
    if (!atual) return;
    setErro(null);
    setSituacao({});
    setEstado({ fase: "VARRENDO", feitos: 0, total: 0 });
    try {
      const m = await carregarAdb();
      const lista = await m.varrerApps(atual.adb, (feitos, total) => setEstado({ fase: "VARRENDO", feitos, total }));
      setApps(lista);
      setMostrarTodos(false);
    } catch {
      setErro("A verificação parou no meio. Confira o cabo e tente de novo.");
    } finally {
      if (celularRef.current) setEstado({ fase: "CONECTADO" });
    }
  };

  const descobrirAppNaTela = async () => {
    const atual = celularRef.current;
    if (!atual) return;
    const m = await carregarAdb();
    const pacote = await m.appNaTela(atual.adb);
    setEmFoco(pacote);
    if (!pacote) toast.error("Não deu para identificar o app na tela.");
  };

  const remover = async (app: AppAnalisado) => {
    const atual = celularRef.current;
    if (!atual) return;
    setOcupado(app.pacote);
    try {
      const m = await carregarAdb();
      const r = await m.removerApp(atual.adb, app);
      if (r.resultado === "REMOVIDO") {
        setSituacao((s) => ({ ...s, [app.pacote]: "REMOVIDO" }));
        toast.success(`${app.pacote} removido.`);
      } else if (r.resultado === "BLOQUEADO_POR_ADMIN") {
        setSituacao((s) => ({ ...s, [app.pacote]: "PRECISA_ADMIN" }));
        setAviso({ pacote: app.pacote, texto: r.detalhe });
      } else {
        toast.error(`Não removeu: ${r.detalhe}`);
      }
    } finally {
      setOcupado(null);
    }
  };

  const bloquear = async (app: AppAnalisado) => {
    const atual = celularRef.current;
    if (!atual) return;
    setOcupado(app.pacote);
    try {
      const m = await carregarAdb();
      if (await m.bloquearApp(atual.adb, app.pacote)) {
        setSituacao((s) => ({ ...s, [app.pacote]: "BLOQUEADO" }));
        toast.success(`${app.pacote} bloqueado.`);
      } else toast.error("O Android não deixou bloquear este app.");
    } finally {
      setOcupado(null);
    }
  };

  const abrirNoCelular = async (pacote: string) => {
    const atual = celularRef.current;
    if (!atual) return;
    const m = await carregarAdb();
    await m.abrirAppNoCelular(atual.adb, pacote);
    toast.info("Abriu a página do app no celular.");
  };

  const removerTodosDeRiscoAlto = async () => {
    setConfirmarLote(false);
    for (const app of altos.filter((a) => !situacao[a.pacote])) {
      if (!celularRef.current) break;
      await remover(app);
    }
  };

  const pendentes = (apps ?? []).filter((a) => situacao[a.pacote] !== "REMOVIDO");
  const altos = pendentes.filter((a) => a.nivel === "ALTO");
  const medios = pendentes.filter((a) => a.nivel === "MEDIO");
  const visiveis = useMemo(
    () => (apps ?? []).filter((a) => mostrarTodos || a.nivel !== "BAIXO" || situacao[a.pacote] || a.pacote === emFoco),
    [apps, mostrarTodos, situacao, emFoco]
  );

  const copiarRelatorio = async () => {
    if (!celular || !apps) return;
    const removidos = Object.entries(situacao).filter(([, s]) => s === "REMOVIDO").map(([p]) => p);
    const bloqueados = Object.entries(situacao).filter(([, s]) => s === "BLOQUEADO" || s === "PRECISA_ADMIN").map(([p]) => p);
    const texto = montarRelatorio(`${celular.fabricante} ${celular.modelo} (Android ${celular.android})`, new Date(), removidos, bloqueados, apps.length);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Relatório copiado. Cole nas observações da OS.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const conectado = estado.fase === "CONECTADO" || estado.fase === "VARRENDO";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Ferramentas</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Remoção de Vírus</h1>
        </div>
        {conectado ? (
          <Button type="button" variant="outline" onClick={() => void desconectarCelular()}>
            <Unplug className="h-4 w-4" />
            Desconectar
          </Button>
        ) : null}
      </div>

      {suporte === false ? (
        <p role="alert" className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-4 py-3 text-sm text-kx-alerta-texto">
          Este navegador não acessa o USB. Abra o TechOS no <strong>Google Chrome</strong> ou no <strong>Microsoft Edge</strong> do
          computador (não funciona pelo celular, nem no Firefox ou Safari).
        </p>
      ) : null}

      {erro ? (
        <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-4 py-3 text-sm text-kx-erro-texto">
          {erro}
        </p>
      ) : null}

      {!conectado ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <h2 className="text-[17px] font-bold text-kx-texto">Antes de conectar</h2>
            <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-sm text-kx-texto-2">
              <li>
                No celular, ative as <strong className="text-kx-texto">Opções do desenvolvedor</strong>: Configurações → Sobre o telefone →
                toque 7 vezes em <em>Número de compilação</em> (na Samsung fica em Informações do software).
              </li>
              <li>
                Em Configurações → Opções do desenvolvedor, ligue a <strong className="text-kx-texto">Depuração USB</strong>.
              </li>
              <li>Ligue o celular no computador com um cabo de dados e desbloqueie a tela.</li>
              <li>
                Clique em <strong className="text-kx-texto">Selecionar celular</strong>, escolha o aparelho na janela do navegador e, no
                celular, toque em <strong className="text-kx-texto">Permitir</strong> (marque &quot;Sempre permitir deste computador&quot;).
              </li>
            </ol>
            <div>
              <Button type="button" size="lg" disabled={suporte !== true || estado.fase === "CONECTANDO"} onClick={() => void conectar()}>
                {estado.fase === "CONECTANDO" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Cable className="h-4 w-4" />}
                {estado.fase === "CONECTANDO" ? "Aguardando o Permitir no celular…" : "Selecionar celular"}
              </Button>
            </div>
          </section>
          <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5 text-sm text-kx-texto-2">
            <h2 className="text-[17px] font-bold text-kx-texto">Bom saber</h2>
            <p>
              Funciona com <strong className="text-kx-texto">Android</strong>. iPhone não permite listar nem remover apps pelo cabo.
            </p>
            <p>
              O celular não aparece na lista? Troque o cabo (muitos só carregam), confira a Depuração USB e feche programas que usam o
              celular (Samsung Smart Switch, Android Studio, adb, scrcpy).
            </p>
            <p>Nada é apagado sozinho: o sistema aponta os suspeitos e o técnico decide o que remover.</p>
            <p>A lista de apps não sai do computador — tudo roda no navegador.</p>
          </section>
        </div>
      ) : null}

      {conectado && celular ? (
        <section className="flex flex-wrap items-center gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-sucesso-fundo text-kx-sucesso-texto">
            <Smartphone className="h-6 w-6" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-bold capitalize text-kx-texto">
              {celular.fabricante} {celular.modelo}
            </span>
            <span className="text-xs text-kx-legenda">Android {celular.android} · conectado</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={estado.fase === "VARRENDO"} onClick={() => void descobrirAppNaTela()}>
              <Crosshair className="h-4 w-4" />
              Qual app está na tela?
            </Button>
            <Button type="button" disabled={estado.fase === "VARRENDO"} onClick={() => void varrer()}>
              {estado.fase === "VARRENDO" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : apps ? <RefreshCw className="h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}
              {apps ? "Verificar de novo" : "Verificar apps"}
            </Button>
          </div>
          {estado.fase === "VARRENDO" ? (
            <div className="w-full">
              <div className="h-2 w-full overflow-hidden rounded-full bg-kx-superficie">
                <div
                  className="h-full bg-kx-primaria transition-all"
                  style={{ width: `${estado.total ? Math.round((estado.feitos / estado.total) * 100) : 5}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-kx-legenda">
                {estado.total ? `Analisando ${estado.feitos} de ${estado.total} apps…` : "Listando os apps…"}
              </p>
            </div>
          ) : null}
          {emFoco ? (
            <p className="w-full rounded-kx-botao bg-kx-info-fundo px-3 py-2 text-sm text-kx-info-texto">
              App na tela agora: <strong className="font-mono">{emFoco}</strong>
              {apps?.some((a) => a.pacote === emFoco) ? " — destacado na lista abaixo." : apps ? " (é um app do sistema)." : " — clique em Verificar apps para ver os detalhes."}
            </p>
          ) : (
            <p className="w-full text-xs text-kx-legenda">
              Dica: deixe o anúncio aparecer no celular e clique em &quot;Qual app está na tela?&quot; para pegar o culpado na hora.
            </p>
          )}
        </section>
      ) : null}

      {conectado && apps ? (
        <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="text-[17px] font-bold text-kx-texto">
                {altos.length + medios.length === 0
                  ? "Nenhum app suspeito"
                  : `${altos.length + medios.length} ${altos.length + medios.length === 1 ? "app suspeito" : "apps suspeitos"}`}
              </h2>
              <span className="text-xs text-kx-legenda">
                {apps.length} apps instalados pelo usuário · {altos.length} muito suspeitos · {medios.length} suspeitos
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {altos.filter((a) => !situacao[a.pacote]).length > 1 ? (
                <Button type="button" variant="destructive" disabled={ocupado !== null} onClick={() => setConfirmarLote(true)}>
                  <Trash2 className="h-4 w-4" />
                  Remover os muito suspeitos
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => void copiarRelatorio()}>
                <ClipboardCopy className="h-4 w-4" />
                Copiar relatório
              </Button>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {visiveis.map((app) => (
              <LinhaDoApp
                key={app.pacote}
                app={app}
                situacao={situacao[app.pacote] ?? null}
                ocupado={ocupado === app.pacote}
                travado={ocupado !== null}
                destacado={app.pacote === emFoco}
                onRemover={() => void remover(app)}
                onBloquear={() => void bloquear(app)}
                onAbrir={() => void abrirNoCelular(app.pacote)}
              />
            ))}
          </ul>
          {visiveis.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-kx-sucesso-texto">
              <CheckCircle2 className="h-4 w-4" /> Nenhum app com sinais de anúncio ou vírus.
            </p>
          ) : null}
          <Button type="button" variant="ghost" className="self-start" onClick={() => setMostrarTodos((v) => !v)}>
            {mostrarTodos ? "Mostrar só os suspeitos" : `Mostrar todos os ${apps.length} apps`}
          </Button>
        </section>
      ) : null}

      <AlertDialog open={aviso !== null} onOpenChange={(abrir) => !abrir && setAviso(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Falta um passo no celular</AlertDialogTitle>
            <AlertDialogDescription>{aviso?.texto}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAviso(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarLote} onOpenChange={setConfirmarLote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {altos.filter((a) => !situacao[a.pacote]).length} apps muito suspeitos?</AlertDialogTitle>
            <AlertDialogDescription>
              Confira a lista antes: um app do cliente (banco, trabalho) pode ter sinais parecidos. A remoção apaga o app e os dados
              dele no celular.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removerTodosDeRiscoAlto()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LinhaDoApp({
  app,
  situacao,
  ocupado,
  travado,
  destacado,
  onRemover,
  onBloquear,
  onAbrir,
}: {
  app: AppAnalisado;
  situacao: Situacao;
  ocupado: boolean;
  travado: boolean;
  destacado: boolean;
  onRemover: () => void;
  onBloquear: () => void;
  onAbrir: () => void;
}) {
  const estilo = ESTILO_NIVEL[app.nivel];
  const removido = situacao === "REMOVIDO";
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-kx-botao border bg-kx-superficie p-3 sm:flex-row sm:items-start",
        destacado ? "border-kx-primaria ring-2 ring-kx-primaria/30" : "border-transparent",
        removido && "opacity-60"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("break-all font-mono text-sm font-bold text-kx-texto", removido && "line-through")}>{app.pacote}</span>
          <span className={cn("rounded-kx-pilula border px-2 py-0.5 text-[11px] font-bold", estilo.classe)}>{estilo.rotulo}</span>
          {app.confiavel ? (
            <span className="rounded-kx-pilula border border-kx-painel-borda px-2 py-0.5 text-[11px] text-kx-legenda">App conhecido da loja</span>
          ) : null}
          {situacao === "REMOVIDO" ? <Etiqueta texto="Removido" classe="text-kx-sucesso-texto" /> : null}
          {situacao === "BLOQUEADO" ? <Etiqueta texto="Bloqueado" classe="text-kx-info-texto" /> : null}
          {situacao === "PRECISA_ADMIN" ? <Etiqueta texto="Bloqueado — desative o administrador no celular" classe="text-kx-alerta-texto" /> : null}
          {!situacao && app.desativado ? <Etiqueta texto="Já desativado" classe="text-kx-legenda" /> : null}
        </div>
        {app.sinais.length ? (
          <ul className="flex flex-col gap-0.5 text-xs text-kx-texto-2">
            {app.sinais.map((s) => (
              <li key={s.id} className="flex items-start gap-1.5">
                <ShieldAlert className={cn("mt-0.5 h-3 w-3 shrink-0", s.peso >= 3 ? "text-kx-erro-icone" : "text-kx-alerta-icone")} aria-hidden />
                {s.texto}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-kx-legenda">Sem sinais de anúncio ou vírus.</span>
        )}
        <span className="text-[11px] text-kx-legenda">
          {app.instalador ? `Instalado por ${app.instalador}` : "Instalado por arquivo APK"}
          {app.instaladoEm ? ` · em ${new Date(app.instaladoEm).toLocaleDateString("pt-BR")}` : ""}
          {app.versao ? ` · versão ${app.versao}` : ""}
        </span>
      </div>
      {!removido ? (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="ghost" disabled={travado} onClick={onAbrir} title="Abre a página do app no celular, com nome e ícone">
            <ExternalLink className="h-3.5 w-3.5" />
            Ver no celular
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={travado || situacao === "BLOQUEADO"} onClick={onBloquear}>
            <Ban className="h-3.5 w-3.5" />
            Bloquear
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={travado} onClick={onRemover}>
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" />}
            Remover
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Etiqueta({ texto, classe }: { texto: string; classe: string }) {
  return <span className={cn("text-[11px] font-bold", classe)}>{texto}</span>;
}
