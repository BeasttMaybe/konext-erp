"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Plug, Unplug } from "lucide-react";
import { toast } from "sonner";

import { conectarZernio, desconectarZernio, type EstadoConexaoZernio } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

const CLASSE_PLATAFORMA: Record<string, string> = {
  instagram: "bg-kx-info-fundo text-kx-info-texto",
  facebook: "bg-kx-info-fundo text-kx-info-texto",
  tiktok: "bg-kx-superficie text-kx-texto-2",
  googlebusiness: "bg-kx-sucesso-fundo text-kx-sucesso-texto",
};

const formatarData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

export function PainelConexoes({ conexao }: { conexao: EstadoConexaoZernio }) {
  const router = useRouter();
  const [chave, setChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [trocando, setTrocando] = useState(!conexao.configurada);
  const [confirmarDesconectar, setConfirmarDesconectar] = useState(false);

  const conectar = async () => {
    const valor = chave.trim();
    if (!valor) {
      toast.error("Cole a sua chave da API Zernio.");
      return;
    }
    setSalvando(true);
    try {
      const r = await conectarZernio(valor);
      if (r.ok) {
        toast.success(`Zernio conectada — ${r.contas} ${r.contas === 1 ? "conta encontrada" : "contas encontradas"}.`);
        setChave("");
        setTrocando(false);
        router.refresh();
      } else {
        toast.error(r.erro);
      }
    } catch {
      toast.error("Não foi possível conectar agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const desconectar = async () => {
    setConfirmarDesconectar(false);
    setSalvando(true);
    try {
      await desconectarZernio();
      toast.success("Zernio desconectada.");
      setTrocando(true);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Conexões</h1>
      </div>

      <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-4 py-3 text-sm text-kx-texto-2">
        As redes da loja (Instagram, TikTok e Perfil do Google) são ligadas na <strong className="text-kx-texto">Zernio</strong>, e o ERP
        publica, agenda e lê as métricas por ela. Aqui você cola a sua chave da API Zernio uma vez — ela fica guardada de forma cifrada e
        nunca aparece na tela de novo.
      </p>

      {/* Estado atual */}
      <div className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        {conexao.configurada ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-kx-sucesso-texto">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Zernio conectada
              </span>
              {formatarData(conexao.conectadoEm) ? (
                <span className="text-xs text-kx-legenda">desde {formatarData(conexao.conectadoEm)}</span>
              ) : null}
            </div>

            {conexao.erro ? (
              <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
                {conexao.erro}
              </p>
            ) : conexao.contas.length === 0 ? (
              <p className="text-sm text-kx-legenda">
                Nenhuma conta conectada na Zernio ainda. Entre em zernio.com, ligue as contas da loja e volte aqui.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">Contas conectadas</span>
                <ul className="flex flex-col gap-2">
                  {conexao.contas.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cn("rounded-kx-pilula px-2 py-0.5 text-[11px] font-bold", CLASSE_PLATAFORMA[c.plataforma] ?? "bg-kx-superficie text-kx-texto-2")}>
                          {c.rotulo}
                        </span>
                        <span className="truncate text-sm text-kx-texto">{c.usuario || "conta"}</span>
                      </div>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-kx-sucesso-texto" aria-hidden />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTrocando((v) => !v)}>
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> Trocar chave
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-kx-erro-texto" disabled={salvando} onClick={() => setConfirmarDesconectar(true)}>
                <Unplug className="h-3.5 w-3.5" aria-hidden /> Desconectar
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm font-bold text-kx-texto">
            <Plug className="h-4 w-4 text-kx-legenda" aria-hidden /> Zernio ainda não conectada
          </div>
        )}

        {/* Formulário da chave */}
        {trocando ? (
          <div className="flex flex-col gap-2 border-t border-kx-painel-borda pt-4">
            <Label htmlFor="zernio-chave" className="text-xs font-bold text-kx-texto">
              Chave da API Zernio
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="zernio-chave"
                type="password"
                autoComplete="off"
                placeholder="Cole aqui a sua API key da Zernio"
                className="h-11 flex-1 border-kx-campo-borda bg-kx-superficie font-mono"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void conectar();
                }}
              />
              <Button type="button" disabled={salvando} onClick={() => void conectar()}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plug className="h-4 w-4" aria-hidden />}
                Conectar
              </Button>
            </div>
            <a
              href="https://zernio.com/dashboard/api-keys"
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1 text-xs font-bold text-kx-info-texto hover:underline"
            >
              Onde pego minha chave? <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmarDesconectar} onOpenChange={setConfirmarDesconectar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar a Zernio?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave guardada será apagada e o ERP deixa de publicar, agendar e ler métricas até você conectar de novo. As contas na
              Zernio não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void desconectar()}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
