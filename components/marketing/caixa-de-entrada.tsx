"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { obterConversas, obterMensagens, responderMensagem, sugerirRespostaMensagem } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Conversa = {
  id: string;
  contaId: string;
  plataforma: string;
  participante: string;
  usuario: string;
  foto: string | null;
  ultimaMensagem: string;
  atualizadoEm: string;
  naoLidas: number;
};

type Anexo = { tipo: string; url: string };
type Mensagem = { id: string; texto: string; de: string; entrada: boolean; em: string; anexos: Anexo[] };

const horaCurta = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const ROTULO_PLATAFORMA: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp" };

export function CaixaDeEntrada({
  inicial,
  compacto = false,
}: {
  inicial: { conversas: Conversa[]; proximoCursor: string | null };
  compacto?: boolean;
}) {
  const [conversas, setConversas] = useState<Conversa[]>(inicial.conversas);
  const [cursor, setCursor] = useState<string | null>(inicial.proximoCursor);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [sel, setSel] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);

  const abrir = async (c: Conversa) => {
    setSel(c);
    setTexto("");
    setMensagens([]);
    setCarregandoMsgs(true);
    setConversas((atual) => atual.map((x) => (x.id === c.id ? { ...x, naoLidas: 0 } : x)));
    try {
      const r = await obterMensagens(c.id, c.contaId);
      if (r.ok) setMensagens(r.mensagens);
      else toast.error(r.erro);
    } finally {
      setCarregandoMsgs(false);
    }
  };

  const carregarMais = async () => {
    if (!cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const r = await obterConversas(cursor);
      if (r.ok) {
        setConversas((atual) => [...atual, ...r.conversas]);
        setCursor(r.proximoCursor);
      } else {
        toast.error(r.erro);
      }
    } finally {
      setCarregandoMais(false);
    }
  };

  const sugerir = async () => {
    if (!sel) return;
    setSugerindo(true);
    try {
      const r = await sugerirRespostaMensagem(sel.id, sel.contaId);
      if (r.ok) setTexto(r.sugestao);
      else toast.error(r.erro + (r.configurar ? " (Configure a chave de IA.)" : ""));
    } catch {
      toast.error("Não foi possível sugerir agora.");
    } finally {
      setSugerindo(false);
    }
  };

  const enviar = async () => {
    if (!sel) return;
    const msg = texto.trim();
    if (!msg) {
      toast.error("Escreva a mensagem.");
      return;
    }
    setEnviando(true);
    try {
      const r = await responderMensagem(sel.id, sel.contaId, msg);
      if (r.ok) {
        setMensagens((atual) => [...atual, { id: `local-${Date.now()}`, texto: msg, de: "Loja", entrada: false, em: new Date().toISOString(), anexos: [] }]);
        setTexto("");
        toast.success("Mensagem enviada.");
      } else {
        toast.error(r.erro ?? "Não foi possível enviar.");
      }
    } catch {
      toast.error("Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className={cn(
        "flex overflow-hidden bg-kx-painel",
        compacto ? "h-full" : "h-[calc(100vh-11rem)] min-h-[420px] rounded-kx-painel border border-kx-painel-borda"
      )}
    >
      {/* Lista de conversas */}
      <div
        className={cn(
          "w-full flex-col border-r border-kx-painel-borda",
          compacto ? (sel ? "hidden" : "flex") : cn("md:flex md:w-80", sel ? "hidden md:flex" : "flex")
        )}
      >
        <div className="flex items-center gap-2 border-b border-kx-painel-borda px-4 py-3">
          <MessageSquare className="h-4 w-4 text-kx-legenda" aria-hidden />
          <span className="text-sm font-bold text-kx-texto">Conversas</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversas.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-kx-legenda">Nenhuma conversa ainda.</p>
          ) : (
            <ul>
              {conversas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void abrir(c)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-kx-painel-borda px-4 py-3 text-left transition-colors hover:bg-kx-superficie",
                      sel?.id === c.id ? "bg-kx-superficie" : ""
                    )}
                  >
                    {c.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar público da rede
                      <img src={c.foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-sm font-bold text-kx-texto-2">
                        {c.participante.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-kx-texto">{c.participante}</span>
                        {c.naoLidas > 0 ? (
                          <span className="shrink-0 rounded-full bg-kx-primaria px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{c.naoLidas}</span>
                        ) : null}
                      </div>
                      <span className="truncate text-xs text-kx-legenda">{c.ultimaMensagem || "—"}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cursor ? (
            <div className="p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full" disabled={carregandoMais} onClick={() => void carregarMais()}>
                {carregandoMais ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Carregar mais
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Conversa aberta */}
      <div className={cn("flex-1 flex-col", compacto ? (sel ? "flex" : "hidden") : sel ? "flex" : "hidden md:flex")}>
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-kx-legenda">
            Escolha uma conversa para ver as mensagens e responder.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-kx-painel-borda px-4 py-3">
              <button type="button" className={cn(!compacto && "md:hidden")} onClick={() => setSel(null)} aria-label="Voltar">
                <ArrowLeft className="h-5 w-5 text-kx-texto-2" aria-hidden />
              </button>
              <span className="text-sm font-bold text-kx-texto">{sel.participante}</span>
              <span className="rounded-kx-pilula bg-kx-superficie px-2 py-0.5 text-[11px] text-kx-legenda">
                {ROTULO_PLATAFORMA[sel.plataforma] ?? sel.plataforma}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {carregandoMsgs ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-kx-legenda" aria-hidden />
                </div>
              ) : mensagens.length === 0 ? (
                <p className="text-center text-sm text-kx-legenda">Sem mensagens.</p>
              ) : (
                mensagens.map((m) => (
                  <div key={m.id} className={cn("flex", m.entrada ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-kx-botao px-3 py-2 text-sm",
                        m.entrada ? "bg-kx-superficie text-kx-texto" : "bg-kx-primaria text-primary-foreground"
                      )}
                    >
                      {m.texto ? <p className="whitespace-pre-line">{m.texto}</p> : null}
                      {m.anexos.map((a, i) => {
                        if (a.tipo === "image") {
                          // eslint-disable-next-line @next/next/no-img-element -- mídia do direct (CDN da rede)
                          return <img key={i} src={a.url} alt="anexo" className="mt-1 max-h-52 rounded-kx-botao" referrerPolicy="no-referrer" />;
                        }
                        if (a.tipo === "video") return <video key={i} src={a.url} controls className="mt-1 max-h-52 rounded-kx-botao" />;
                        if (a.tipo === "audio") return <audio key={i} src={a.url} controls className="mt-1 w-[220px] max-w-full" />;
                        return (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline">
                            Abrir anexo
                          </a>
                        );
                      })}
                      {!m.texto && m.anexos.length === 0 ? <p className="italic opacity-80">[mensagem]</p> : null}
                      <span className={cn("mt-0.5 block text-[10px]", m.entrada ? "text-kx-legenda" : "text-primary-foreground/80")}>{horaCurta(m.em)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-kx-painel-borda p-3">
              <Textarea
                rows={2}
                maxLength={2000}
                className="resize-none border-kx-campo-borda bg-kx-superficie text-kx-texto"
                placeholder="Escreva uma resposta, ou use Sugerir com IA…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" disabled={sugerindo} onClick={() => void sugerir()}>
                  {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                  Sugerir com IA
                </Button>
                <Button type="button" disabled={enviando || !texto.trim()} onClick={() => void enviar()}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                  Enviar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
