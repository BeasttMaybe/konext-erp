"use client";

import { useMemo, useState } from "react";
import { Cable, Loader2, PackageMinus, RotateCcw, ScanSearch, Smartphone, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { contarBloatware, type AppClassificado, type ClasseDoApp } from "@/lib/dominio/ferramentas/bloatware";
import { cn } from "@/lib/utils";

import { carregarAdb, useConexaoCelular } from "./usar-conexao-celular";

const ESTILO: Record<ClasseDoApp, { rotulo: string; classe: string }> = {
  BLOATWARE: { rotulo: "Pode tirar", classe: "bg-kx-alerta-fundo text-kx-alerta-texto border-kx-alerta" },
  USUARIO: { rotulo: "App do usuário", classe: "bg-kx-info-fundo text-kx-info-texto border-transparent" },
  SISTEMA: { rotulo: "Sistema", classe: "bg-kx-superficie text-kx-texto-2 border-kx-painel-borda" },
  ESSENCIAL: { rotulo: "Essencial", classe: "bg-kx-superficie text-kx-legenda border-kx-painel-borda" },
};

type Filtro = "SUGERIDOS" | "TODOS";

export function LimpezaDeApps() {
  const { estado, celular, erro, setErro, suporte, conectar, desconectar, ref } = useConexaoCelular();
  const [lendo, setLendo] = useState(false);
  const [apps, setApps] = useState<AppClassificado[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [filtro, setFiltro] = useState<Filtro>("SUGERIDOS");
  const [removendo, setRemovendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const conectado = estado === "CONECTADO";

  const conectarELer = async () => {
    const c = await conectar();
    if (c) void listar(c.adb);
  };

  const listar = async (adb = ref.current?.adb) => {
    if (!adb) return;
    setErro(null);
    setLendo(true);
    try {
      const m = await carregarAdb();
      const lista = await m.listarAppsDoAparelho(adb);
      setApps(lista);
      setMarcados(new Set());
    } catch {
      setErro("Não foi possível ler os apps. Confira o cabo e tente de novo.");
    } finally {
      setLendo(false);
    }
  };

  const alternar = (pacote: string) =>
    setMarcados((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(pacote)) proxima.delete(pacote);
      else proxima.add(pacote);
      return proxima;
    });

  const remover = async () => {
    setConfirmar(false);
    const adb = ref.current?.adb;
    if (!adb || marcados.size === 0) return;
    setRemovendo(true);
    try {
      const m = await carregarAdb();
      const resultados = await m.desativarAppEmLote(adb, [...marcados]);
      const ok = resultados.filter((r) => r.ok).length;
      const falhas = resultados.length - ok;
      if (ok) toast.success(`${ok === 1 ? "1 app removido" : `${ok} apps removidos`} deste aparelho.`);
      if (falhas) toast.error(`${falhas === 1 ? "1 app não saiu" : `${falhas} apps não saíram`}.`);
      setMarcados(new Set());
      await listar(adb);
    } catch {
      toast.error("Não foi possível remover agora.");
    } finally {
      setRemovendo(false);
    }
  };

  const bloatware = apps ? contarBloatware(apps) : 0;
  const visiveis = useMemo(
    () => (apps ?? []).filter((a) => (filtro === "TODOS" ? true : a.classe === "BLOATWARE" || marcados.has(a.pacote))),
    [apps, filtro, marcados]
  );
  const marcarTodosBloat = () => {
    if (!apps) return;
    setMarcados((atual) => {
      const alvo = apps.filter((a) => a.classe === "BLOATWARE" && !a.desativado).map((a) => a.pacote);
      const todos = alvo.every((p) => atual.has(p));
      const proxima = new Set(atual);
      for (const p of alvo) {
        if (todos) proxima.delete(p);
        else proxima.add(p);
      }
      return proxima;
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Ferramentas</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Limpeza de apps</h1>
        </div>
        {conectado ? (
          <Button type="button" variant="outline" onClick={() => void desconectar()}>
            <Unplug className="h-4 w-4" />
            Desconectar
          </Button>
        ) : null}
      </div>

      {suporte === false ? (
        <p role="alert" className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-4 py-3 text-sm text-kx-alerta-texto">
          Este navegador não acessa o USB. Abra o TechOS no <strong>Chrome</strong> ou no <strong>Edge</strong> do computador.
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-4 py-3 text-sm text-kx-erro-texto">
          {erro}
        </p>
      ) : null}

      {!conectado ? (
        <section className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
              <PackageMinus className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm text-kx-texto-2">
              Tira apps de fábrica (bloatware) que deixam o aparelho lento. Os essenciais (telefone, ajustes, Play Store) ficam
              protegidos e nunca aparecem para remover. Só Android, pelo cabo com Depuração USB.
            </p>
          </div>
          <div>
            <Button type="button" size="lg" disabled={suporte !== true || estado === "CONECTANDO"} onClick={() => void conectarELer()}>
              {estado === "CONECTANDO" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Cable className="h-4 w-4" />}
              {estado === "CONECTANDO" ? "Aguardando o Permitir no celular…" : "Conectar e listar apps"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-wrap items-center gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-kx-botao bg-kx-sucesso-fundo text-kx-sucesso-texto">
            <Smartphone className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-bold capitalize text-kx-texto">
              {celular?.fabricante} {celular?.modelo}
            </span>
            <span className="text-xs text-kx-legenda">Android {celular?.android} · conectado</span>
          </div>
          <Button type="button" variant="outline" disabled={lendo} onClick={() => void listar()}>
            {lendo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ScanSearch className="h-4 w-4" />}
            {apps ? "Listar de novo" : "Listar apps"}
          </Button>
        </section>
      )}

      {apps ? (
        <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="text-[17px] font-bold text-kx-texto">
                {bloatware === 0 ? "Nenhum bloatware conhecido" : `${bloatware} ${bloatware === 1 ? "app pode sair" : "apps podem sair"}`}
              </h2>
              <span className="text-xs text-kx-legenda">{apps.length} apps no aparelho</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {bloatware > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={marcarTodosBloat}>
                  Marcar sugeridos
                </Button>
              ) : null}
              <div className="flex overflow-hidden rounded-kx-botao border border-kx-painel-borda text-sm">
                {(["SUGERIDOS", "TODOS"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltro(f)}
                    className={cn("px-3 py-1.5", filtro === f ? "bg-kx-primaria text-primary-foreground" : "bg-kx-superficie text-kx-texto-2")}
                  >
                    {f === "SUGERIDOS" ? "Sugeridos" : "Todos"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-1.5">
            {visiveis.map((app) => {
              const estilo = ESTILO[app.classe];
              const podeMarcar = app.classe !== "ESSENCIAL" && !app.desativado;
              return (
                <li
                  key={app.pacote}
                  className={cn(
                    "flex items-start gap-3 rounded-kx-botao border bg-kx-superficie px-3 py-2.5",
                    marcados.has(app.pacote) ? "border-kx-primaria" : "border-transparent",
                    app.desativado && "opacity-55"
                  )}
                >
                  <Checkbox
                    aria-label={`Marcar ${app.pacote}`}
                    className="mt-0.5"
                    checked={marcados.has(app.pacote)}
                    disabled={!podeMarcar}
                    onCheckedChange={() => podeMarcar && alternar(app.pacote)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-sm text-kx-texto">{app.pacote}</span>
                      <span className={cn("rounded-kx-pilula border px-2 py-0.5 text-[11px] font-bold", estilo.classe)}>{estilo.rotulo}</span>
                      {app.desativado ? <span className="text-[11px] font-bold text-kx-legenda">Já desativado</span> : null}
                    </div>
                    {app.rotulo ? <span className="text-xs font-semibold text-kx-texto-2">{app.rotulo}</span> : null}
                    {app.motivo ? <span className="text-xs text-kx-legenda">{app.motivo}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="flex items-start gap-1.5 text-xs text-kx-legenda">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Reversível: os apps saem só deste usuário. Uma restauração de fábrica traz todos de volta. Nada é apagado da partição do
            sistema.
          </p>
        </section>
      ) : null}

      {apps && marcados.size > 0 ? (
        <div className="sticky bottom-3 z-kx-sticky flex flex-wrap items-center gap-3 rounded-kx-cartao border border-kx-primaria/40 bg-kx-painel p-3 shadow-lg">
          <span className="px-1 text-sm font-bold text-kx-texto">
            {marcados.size === 1 ? "1 app marcado" : `${marcados.size} apps marcados`}
          </span>
          <span className="flex-1" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setMarcados(new Set())}>
            Limpar
          </Button>
          <Button type="button" variant="destructive" disabled={removendo} onClick={() => setConfirmar(true)}>
            {removendo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PackageMinus className="h-4 w-4" />}
            Remover deste aparelho
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {marcados.size === 1 ? "1 app" : `${marcados.size} apps`} deste aparelho?</AlertDialogTitle>
            <AlertDialogDescription>
              Eles somem deste celular, mas é reversível: uma restauração de fábrica traz tudo de volta. Confira a lista — não marque
              nada que o cliente use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remover()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
