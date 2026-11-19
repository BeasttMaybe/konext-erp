"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { aplicarDescricaoGoogle, sugerirDescricaoGoogle } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const LIMITE = 750;

export function OtimizarDescricaoGoogle() {
  const [sugerindo, setSugerindo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [atual, setAtual] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState("");
  const [temSugestao, setTemSugestao] = useState(false);

  const sugerir = async () => {
    setSugerindo(true);
    try {
      const r = await sugerirDescricaoGoogle();
      if (r.ok) {
        setAtual(r.atual);
        setSugestao(r.sugestao);
        setTemSugestao(true);
      } else {
        toast.error(r.erro + (r.configurar ? " (Configure a chave de IA no Vercel.)" : ""));
      }
    } catch {
      toast.error("Não foi possível sugerir agora.");
    } finally {
      setSugerindo(false);
    }
  };

  const aplicar = async () => {
    const texto = sugestao.trim();
    if (!texto) {
      toast.error("A descrição está vazia.");
      return;
    }
    setAplicando(true);
    try {
      const r = await aplicarDescricaoGoogle(texto);
      if (r.ok) {
        toast.success("Descrição atualizada no Google. Pode levar alguns minutos para aparecer.");
        setAtual(texto);
      } else {
        toast.error(r.erro ?? "Não foi possível aplicar.");
      }
    } catch {
      toast.error("Não foi possível aplicar agora.");
    } finally {
      setAplicando(false);
    }
  };

  const mudou = temSugestao && sugestao.trim().length > 0 && sugestao.trim() !== (atual ?? "").trim();

  return (
    <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-kx-texto">Descrição do Google</h2>
        <span className="text-xs text-kx-legenda">A IA sugere, você revisa e aplica — nada muda sem o seu clique.</span>
      </div>

      {!temSugestao ? (
        <>
          <p className="text-sm text-kx-texto-2">
            A descrição ajuda a loja a aparecer no Google. Peça uma versão melhorada para a IA e aplique se gostar.
          </p>
          <div>
            <Button type="button" disabled={sugerindo} onClick={() => void sugerir()}>
              {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              Sugerir melhoria com IA
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {atual ? (
            <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-superficie px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">Descrição atual</span>
              <p className="whitespace-pre-line text-sm text-kx-texto-2">{atual}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-kx-texto">Sugestão da IA (edite à vontade)</span>
              <Button type="button" variant="outline" size="sm" disabled={sugerindo} onClick={() => void sugerir()}>
                {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                Gerar de novo
              </Button>
            </div>
            <Textarea
              rows={6}
              maxLength={LIMITE}
              className="border-kx-campo-borda bg-kx-superficie text-kx-texto"
              value={sugestao}
              onChange={(e) => setSugestao(e.target.value)}
            />
            <span className="self-end text-xs text-kx-legenda">
              {sugestao.length}/{LIMITE}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={aplicando || !mudou} onClick={() => void aplicar()}>
              {aplicando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              Aplicar no Google
            </Button>
            {!mudou && temSugestao ? (
              <span className="flex items-center gap-1 text-xs text-kx-sucesso-texto">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Igual ao que já está publicado
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
