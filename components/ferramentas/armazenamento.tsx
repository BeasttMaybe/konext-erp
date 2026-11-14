"use client";

import { useState } from "react";
import { Cable, HardDrive, Loader2, RefreshCw, Smartphone, Sparkles, Unplug } from "lucide-react";
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
import { formatarBytes, percentualUsado, type RetratoDoArmazenamento } from "@/lib/dominio/ferramentas/armazenamento";
import { cn } from "@/lib/utils";

import { carregarAdb, useConexaoCelular } from "./usar-conexao-celular";

export function Armazenamento() {
  const { estado, celular, erro, setErro, suporte, conectar, desconectar, ref } = useConexaoCelular();
  const [analisando, setAnalisando] = useState(false);
  const [retrato, setRetrato] = useState<RetratoDoArmazenamento | null>(null);
  const [limpando, setLimpando] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);

  const conectado = estado === "CONECTADO";

  const conectarEAnalisar = async () => {
    const c = await conectar();
    if (c) void analisar(c.adb);
  };

  const analisar = async (adb = ref.current?.adb) => {
    if (!adb) return;
    setErro(null);
    setAnalisando(true);
    try {
      const m = await carregarAdb();
      setRetrato(await m.analisarArmazenamento(adb));
    } catch {
      setErro("Não foi possível ler o armazenamento. Confira o cabo e tente de novo.");
    } finally {
      setAnalisando(false);
    }
  };

  const limpar = async () => {
    setConfirmarLimpeza(false);
    const adb = ref.current?.adb;
    if (!adb) return;
    setLimpando(true);
    try {
      const m = await carregarAdb();
      const { antes, depois } = await m.limparCache(adb);
      const liberado = antes !== null && depois !== null ? depois - antes : null;
      toast.success(liberado && liberado > 0 ? `Cache limpo. Liberou ${formatarBytes(liberado)}.` : "Cache limpo.");
      void analisar(adb);
    } catch {
      toast.error("Não foi possível limpar o cache agora.");
    } finally {
      setLimpando(false);
    }
  };

  const pct = retrato ? percentualUsado(retrato.espaco) : null;
  const maiorApp = retrato?.apps[0]?.tamanho ?? 1;
  const maiorPasta = retrato?.pastas[0]?.tamanho ?? 1;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Ferramentas</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">O que está pesando</h1>
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
              <HardDrive className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm text-kx-texto-2">
              Ligue o celular Android no cabo (com a Depuração USB ligada) para ver o que ocupa espaço. Só Android.
            </p>
          </div>
          <div>
            <Button type="button" size="lg" disabled={suporte !== true || estado === "CONECTANDO"} onClick={() => void conectarEAnalisar()}>
              {estado === "CONECTANDO" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Cable className="h-4 w-4" />}
              {estado === "CONECTANDO" ? "Aguardando o Permitir no celular…" : "Conectar e analisar"}
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
          <Button type="button" variant="outline" disabled={analisando} onClick={() => void analisar()}>
            {analisando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" />}
            {retrato ? "Analisar de novo" : "Analisar"}
          </Button>
        </section>
      )}

      {analisando && !retrato ? (
        <p className="py-10 text-center text-sm text-kx-legenda">Lendo o armazenamento… isso pode levar alguns segundos.</p>
      ) : null}

      {retrato ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <h2 className="text-[17px] font-bold text-kx-texto">Espaço do aparelho</h2>
              {retrato.espaco ? (
                <>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-extrabold text-kx-texto">{formatarBytes(retrato.espaco.livre)}</span>
                    <span className="text-sm text-kx-legenda">livres de {formatarBytes(retrato.espaco.total)}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-kx-superficie">
                    <div
                      className={cn("h-full rounded-full", (pct ?? 0) >= 90 ? "bg-kx-erro" : (pct ?? 0) >= 75 ? "bg-kx-alerta" : "bg-kx-primaria")}
                      style={{ width: `${pct ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-kx-legenda">{pct}% usado</span>
                </>
              ) : (
                <p className="text-sm text-kx-legenda">Não foi possível ler o espaço livre neste aparelho.</p>
              )}
              <div className="mt-2 flex flex-col gap-2 rounded-kx-botao bg-kx-superficie p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-kx-info-texto" aria-hidden />
                  <span className="text-kx-texto">
                    Cache acumulado: <strong>{formatarBytes(retrato.cacheTotal)}</strong>
                  </span>
                </div>
                <p className="text-xs text-kx-legenda">Limpar o cache não apaga fotos, conversas nem logins — é lixo temporário dos apps.</p>
                <Button type="button" variant="outline" size="sm" className="self-start" disabled={limpando || retrato.cacheTotal <= 0} onClick={() => setConfirmarLimpeza(true)}>
                  {limpando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" />}
                  Limpar cache de tudo
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <h2 className="text-[17px] font-bold text-kx-texto">Apps que mais ocupam</h2>
              {retrato.apps.length === 0 ? (
                <p className="text-sm text-kx-legenda">Este aparelho não informou o tamanho dos apps.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {retrato.apps.map((app) => (
                    <li key={app.pacote} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-mono text-kx-texto-2">{app.pacote}</span>
                        <span className="shrink-0 font-bold tabular-nums text-kx-texto">{formatarBytes(app.tamanho)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-kx-superficie">
                        <div className="h-full rounded-full bg-kx-info" style={{ width: `${Math.max(3, (app.tamanho / maiorApp) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <h2 className="text-[17px] font-bold text-kx-texto">Pastas do armazenamento</h2>
            {retrato.pastas.length === 0 ? (
              <p className="text-sm text-kx-legenda">Não foi possível ler as pastas (o aparelho pode bloquear o acesso sem desbloquear a tela).</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {retrato.pastas.map((pasta) => (
                  <li key={pasta.caminho} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-kx-texto">
                        {pasta.nome} <span className="font-mono text-xs text-kx-legenda">{pasta.caminho.replace("/sdcard", "")}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-kx-texto">{formatarBytes(pasta.tamanho)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-kx-superficie">
                      <div className="h-full rounded-full bg-kx-garantia" style={{ width: `${Math.max(3, (pasta.tamanho / maiorPasta) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-kx-legenda">
              Fotos, vídeos e mídia do WhatsApp costumam ser o que mais pesa. Mostre ao cliente para ele decidir o que apagar ou passar para o computador (veja o backup na tela de Ferramentas).
            </p>
          </section>
        </>
      ) : null}

      <AlertDialog open={confirmarLimpeza} onOpenChange={setConfirmarLimpeza}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar o cache de todos os apps?</AlertDialogTitle>
            <AlertDialogDescription>
              Libera o espaço de arquivos temporários. Não apaga fotos, conversas, contas nem configurações. Os apps vão recriar o
              cache conforme forem usados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void limpar()}>Limpar cache</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
