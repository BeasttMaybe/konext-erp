"use client";

import { useState } from "react";
import { Globe, Loader2, Sparkles, TrendingUp } from "lucide-react";

import { gerarAnaliseMarketing, type ResultadoAnalise } from "@/app/actions/marketing";
import { rotuloArea, type AreaAnalise, type Prioridade, type Recomendacao } from "@/lib/dominio/marketing/analise";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDEM_AREAS: AreaAnalise[] = ["PERFIL_GOOGLE", "SITE_SEO", "REDES", "AVALIACOES"];

const COR_PRIORIDADE: Record<Prioridade, string> = {
  Alta: "bg-kx-erro-fundo text-kx-erro-texto",
  "Média": "bg-kx-alerta-fundo text-kx-alerta-texto",
  Baixa: "bg-kx-info-fundo text-kx-info-texto",
};

export function PainelAnalise() {
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<Extract<ResultadoAnalise, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarAnaliseMarketing();
      if (r.ok) setResultado(r);
      else setErro(r.erro + (r.configurar ? " (Configure a chave de IA no Vercel.)" : ""));
    } catch {
      setErro("Não foi possível gerar a análise agora. Tente de novo.");
    } finally {
      setGerando(false);
    }
  };

  const porArea = (area: AreaAnalise): Recomendacao[] => resultado?.recomendacoes.filter((r) => r.area === area) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
            <TrendingUp className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-kx-texto">Diagnóstico com IA</p>
            <p className="text-sm text-kx-legenda">
              A IA analisa seus números do Google, Instagram, TikTok, as avaliações e o seu site, e sugere melhorias práticas e
              priorizadas (SEO local, site, conteúdo e reputação).
            </p>
          </div>
        </div>
        <div>
          <Button type="button" disabled={gerando} onClick={() => void gerar()}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {resultado ? "Gerar de novo" : "Gerar análise"}
          </Button>
        </div>
        {erro ? (
          <p role="alert" className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-3 py-2 text-sm text-kx-alerta-texto">
            {erro}
          </p>
        ) : null}
        {gerando && !resultado ? (
          <p className="text-sm text-kx-legenda">Lendo seus dados e escrevendo as recomendações… isso leva alguns segundos.</p>
        ) : null}
      </div>

      {resultado ? (
        <>
          {resultado.seo ? (
            <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-kx-legenda" aria-hidden />
                <h2 className="text-[15px] font-bold text-kx-texto">Retrato do site</h2>
                <span className="truncate text-xs text-kx-legenda">{resultado.seo.url}</span>
              </div>
              <p className="text-xs text-kx-legenda">Texto detectado: {resultado.seo.palavras} palavras.</p>
              {resultado.seo.problemas.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {resultado.seo.problemas.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-kx-texto-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-kx-alerta" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-kx-sucesso-texto">Nenhum problema técnico óbvio no HTML. 👍</p>
              )}
            </div>
          ) : null}

          {ORDEM_AREAS.map((area) => {
            const itens = porArea(area);
            if (itens.length === 0) return null;
            return (
              <div key={area} className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
                <h2 className="text-[15px] font-bold text-kx-texto">{rotuloArea(area)}</h2>
                <ul className="flex flex-col gap-2">
                  {itens.map((r, i) => (
                    <li key={i} className="flex flex-col gap-1 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-kx-pilula px-2 py-0.5 text-[11px] font-bold", COR_PRIORIDADE[r.prioridade])}>{r.prioridade}</span>
                        <span className="text-sm font-bold text-kx-texto">{r.titulo}</span>
                      </div>
                      <p className="text-sm text-kx-texto-2">{r.dica}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
