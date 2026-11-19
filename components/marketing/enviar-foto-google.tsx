"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { enviarFotoGoogle } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";

const CATEGORIAS = [
  { id: "ADDITIONAL", rotulo: "Geral" },
  { id: "EXTERIOR", rotulo: "Fachada" },
  { id: "INTERIOR", rotulo: "Interior" },
  { id: "PRODUCT", rotulo: "Produto/serviço" },
  { id: "COVER", rotulo: "Capa" },
  { id: "LOGO", rotulo: "Logotipo" },
];

export function EnviarFotoGoogle() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("ADDITIONAL");
  const [enviando, setEnviando] = useState(false);

  const aoEscolher = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("arquivo", file);
      fd.set("categoria", categoria);
      const r = await enviarFotoGoogle(fd);
      if (r.ok) toast.success("Foto enviada ao Google! Pode levar alguns minutos para aparecer.");
      else toast.error(r.erro ?? "Não foi possível enviar.");
    } catch {
      toast.error("Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-kx-texto">Fotos do Google</h2>
        <span className="text-xs text-kx-legenda">Perfis com mais fotos recebem mais visualizações.</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="h-10 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-2 text-sm text-kx-texto"
          aria-label="Categoria da foto"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <Button type="button" disabled={enviando} onClick={() => inputRef.current?.click()}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          Enviar foto
        </Button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void aoEscolher(e)} />
      </div>
    </div>
  );
}
