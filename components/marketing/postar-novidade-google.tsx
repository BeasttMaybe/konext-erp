"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { publicarNovidadeGoogle, sugerirNovidadeGoogle } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const LIMITE = 1400;

export function PostarNovidadeGoogle() {
  const [tema, setTema] = useState("");
  const [sugerindo, setSugerindo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [texto, setTexto] = useState("");
  const [temTexto, setTemTexto] = useState(false);
  const [urlPublicada, setUrlPublicada] = useState<string | null>(null);

  const sugerir = async () => {
    setSugerindo(true);
    setUrlPublicada(null);
    try {
      const r = await sugerirNovidadeGoogle(tema);
      if (r.ok) {
        setTexto(r.sugestao);
        setTemTexto(true);
      } else {
        toast.error(r.erro + (r.configurar ? " (Configure a chave de IA no Vercel.)" : ""));
      }
    } catch {
      toast.error("Não foi possível sugerir agora.");
    } finally {
      setSugerindo(false);
    }
  };

  const publicar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) {
      toast.error("Escreva a novidade.");
      return;
    }
    setPublicando(true);
    try {
      const r = await publicarNovidadeGoogle(conteudo);
      if (r.ok) {
        toast.success("Novidade publicada no Google! 🎉");
        setUrlPublicada(r.url ?? null);
        setTexto("");
        setTemTexto(false);
        setTema("");
      } else {
        toast.error(r.erro ?? "Não foi possível publicar.");
      }
    } catch {
      toast.error("Não foi possível publicar agora.");
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-kx-texto">Postar novidade no Google</h2>
        <span className="text-xs text-kx-legenda">A IA escreve, você revisa e publica.</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Tema (opcional): ex. promoção de troca de tela"
          className="h-10 flex-1 border-kx-campo-borda bg-kx-superficie"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          maxLength={200}
        />
        <Button type="button" variant="outline" disabled={sugerindo} onClick={() => void sugerir()}>
          {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          Sugerir com IA
        </Button>
      </div>

      {temTexto ? (
        <div className="flex flex-col gap-1.5">
          <Textarea
            rows={4}
            maxLength={LIMITE}
            className="border-kx-campo-borda bg-kx-superficie text-kx-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <Button type="button" disabled={publicando || !texto.trim()} onClick={() => void publicar()}>
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Publicar no Google
            </Button>
            <span className="text-xs text-kx-legenda">
              {texto.length}/{LIMITE}
            </span>
          </div>
        </div>
      ) : null}

      {urlPublicada ? (
        <a href={urlPublicada} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1 text-xs font-bold text-kx-info-texto hover:underline">
          Ver no Google <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
