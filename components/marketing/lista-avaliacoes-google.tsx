"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquareReply, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";

import {
  obterAvaliacoesGoogle,
  responderAvaliacaoGoogle,
  sugerirRespostaAvaliacao,
  type FiltroAvaliacoes,
} from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Avaliacao = {
  id: string;
  contaId: string;
  autor: string;
  fotoAutor: string | null;
  nota: number;
  texto: string;
  criadoEm: string;
  respondida: boolean;
  respostaTexto: string | null;
  url: string | null;
};

const FILTROS: Array<{ id: FiltroAvaliacoes; rotulo: string }> = [
  { id: "TODAS", rotulo: "Todas" },
  { id: "SEM_RESPOSTA", rotulo: "Sem resposta" },
  { id: "BAIXAS", rotulo: "Críticas (≤3★)" },
];

const formatarData = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("h-3.5 w-3.5", n <= nota ? "fill-kx-destaque text-kx-destaque" : "fill-kx-superficie text-kx-painel-borda")}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function ListaAvaliacoesGoogle({
  inicial,
}: {
  inicial: { avaliacoes: Avaliacao[]; proximoCursor: string | null };
}) {
  const [filtro, setFiltro] = useState<FiltroAvaliacoes>("TODAS");
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>(inicial.avaliacoes);
  const [cursor, setCursor] = useState<string | null>(inicial.proximoCursor);
  const [carregando, setCarregando] = useState(false);
  const [respondendo, setRespondendo] = useState<Avaliacao | null>(null);

  const trocarFiltro = async (novo: FiltroAvaliacoes) => {
    if (novo === filtro || carregando) return;
    setFiltro(novo);
    setCarregando(true);
    try {
      const r = await obterAvaliacoesGoogle(novo);
      if (r.ok) {
        setAvaliacoes(r.avaliacoes);
        setCursor(r.proximoCursor);
      } else {
        toast.error(r.erro);
      }
    } finally {
      setCarregando(false);
    }
  };

  const carregarMais = async () => {
    if (!cursor || carregando) return;
    setCarregando(true);
    try {
      const r = await obterAvaliacoesGoogle(filtro, cursor);
      if (r.ok) {
        setAvaliacoes((atual) => [...atual, ...r.avaliacoes]);
        setCursor(r.proximoCursor);
      } else {
        toast.error(r.erro);
      }
    } finally {
      setCarregando(false);
    }
  };

  const aoResponder = (resposta: string) => {
    if (!respondendo) return;
    const alvo = respondendo.id;
    setAvaliacoes((atual) => atual.map((a) => (a.id === alvo ? { ...a, respondida: true, respostaTexto: resposta } : a)));
    setRespondendo(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => void trocarFiltro(f.id)}
            className={cn(
              "rounded-kx-pilula px-3 py-1 text-xs font-bold transition-colors",
              filtro === f.id ? "bg-kx-primaria text-primary-foreground" : "bg-kx-superficie text-kx-texto-2 hover:text-kx-texto"
            )}
          >
            {f.rotulo}
          </button>
        ))}
        {carregando ? <Loader2 className="h-4 w-4 animate-spin text-kx-legenda" aria-hidden /> : null}
      </div>

      {avaliacoes.length === 0 ? (
        <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-4 py-6 text-center text-sm text-kx-legenda">
          {filtro === "SEM_RESPOSTA" ? "Tudo respondido por aqui. 🎉" : "Nenhuma avaliação neste filtro."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {avaliacoes.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {a.fotoAutor ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar público do Google
                    <img src={a.fotoAutor} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-sm font-bold text-kx-texto-2">
                      {a.autor.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-kx-texto">{a.autor}</span>
                    <div className="flex items-center gap-2">
                      <Estrelas nota={a.nota} />
                      <span className="text-xs text-kx-legenda">{formatarData(a.criadoEm)}</span>
                    </div>
                  </div>
                </div>
                {a.respondida ? (
                  <span className="shrink-0 rounded-kx-pilula bg-kx-sucesso-fundo px-2 py-0.5 text-[11px] font-bold text-kx-sucesso-texto">Respondida</span>
                ) : (
                  <span className="shrink-0 rounded-kx-pilula bg-kx-alerta-fundo px-2 py-0.5 text-[11px] font-bold text-kx-alerta-texto">Sem resposta</span>
                )}
              </div>

              {a.texto ? <p className="whitespace-pre-line text-sm text-kx-texto-2">{a.texto}</p> : <p className="text-sm italic text-kx-legenda">Avaliação sem texto.</p>}

              {a.respondida && a.respostaTexto ? (
                <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-superficie px-3 py-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">Sua resposta</span>
                  <p className="whitespace-pre-line text-sm text-kx-texto-2">{a.respostaTexto}</p>
                </div>
              ) : (
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRespondendo(a)}>
                    <MessageSquareReply className="h-3.5 w-3.5" aria-hidden /> Responder
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <Button type="button" variant="ghost" size="sm" className="self-center" disabled={carregando} onClick={() => void carregarMais()}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Carregar mais
        </Button>
      ) : null}

      <DialogoResponder avaliacao={respondendo} onFechar={() => setRespondendo(null)} onRespondida={aoResponder} />
    </div>
  );
}

const LIMITE_RESPOSTA = 500;

function DialogoResponder({
  avaliacao,
  onFechar,
  onRespondida,
}: {
  avaliacao: Avaliacao | null;
  onFechar: () => void;
  onRespondida: (resposta: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);

  const sugerir = async (dados: { autor: string; nota: number; texto: string }) => {
    setSugerindo(true);
    setTexto("");
    try {
      const r = await sugerirRespostaAvaliacao(dados);
      if (r.ok) setTexto(r.sugestao.slice(0, LIMITE_RESPOSTA));
      else toast.error(r.erro + (r.configurar ? " (Configure a chave de IA.)" : ""));
    } catch {
      toast.error("Não foi possível sugerir agora.");
    } finally {
      setSugerindo(false);
    }
  };

  // Ao abrir uma avaliação, já gera a sugestão da IA sozinho (o sugerir limpa o campo).
  const idAberta = avaliacao?.id ?? null;
  useEffect(() => {
    if (!avaliacao) return;
    const dados = { autor: avaliacao.autor, nota: avaliacao.nota, texto: avaliacao.texto };
    const t = setTimeout(() => void sugerir(dados), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAberta]);

  const enviar = async () => {
    if (!avaliacao) return;
    const valor = texto.trim();
    if (!valor) {
      toast.error("Escreva a resposta.");
      return;
    }
    setEnviando(true);
    try {
      const r = await responderAvaliacaoGoogle(avaliacao.id, avaliacao.contaId, valor);
      if (r.ok) {
        toast.success("Resposta publicada no Google.");
        onRespondida(valor);
      } else {
        toast.error(r.erro ?? "Não foi possível responder.");
      }
    } catch {
      toast.error("Não foi possível responder agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={avaliacao !== null} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Responder avaliação</DialogTitle>
          <DialogDescription>
            A resposta aparece publicamente no seu Perfil do Google. O Google guarda uma resposta por avaliação — enviar de novo substitui a
            anterior.
          </DialogDescription>
        </DialogHeader>

        {avaliacao ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-superficie px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-kx-texto">{avaliacao.autor}</span>
                <Estrelas nota={avaliacao.nota} />
              </div>
              {avaliacao.texto ? <p className="mt-1 whitespace-pre-line text-sm text-kx-texto-2">{avaliacao.texto}</p> : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="resposta-texto" className="text-xs font-bold text-kx-texto">
                  Sua resposta {sugerindo && !texto ? <span className="font-normal text-kx-legenda">· a IA está escrevendo…</span> : null}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sugerindo}
                  onClick={() => void sugerir({ autor: avaliacao.autor, nota: avaliacao.nota, texto: avaliacao.texto })}
                >
                  {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                  Gerar de novo
                </Button>
              </div>
              <Textarea
                id="resposta-texto"
                rows={5}
                maxLength={LIMITE_RESPOSTA}
                className="border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder"
                placeholder={sugerindo ? "A IA está escrevendo a resposta…" : "A resposta sugerida aparece aqui. Edite à vontade."}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <span className="self-end text-xs text-kx-legenda">
                {texto.length}/{LIMITE_RESPOSTA}
              </span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          <Button type="button" disabled={enviando || !texto.trim()} onClick={() => void enviar()}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageSquareReply className="h-4 w-4" aria-hidden />}
            Enviar resposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
