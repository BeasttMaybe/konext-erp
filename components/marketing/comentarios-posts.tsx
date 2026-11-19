"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Heart, Loader2, MessageCircle, Send, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  obterComentariosDoPost,
  obterPostsComentarios,
  ocultarComentarioPost,
  responderComentarioPost,
  sugerirRespostaComentario,
  type ComentarioZernio,
  type PostComComentarios,
} from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LIMITE_RESPOSTA = 400;

const data = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";
const numero = (n: number) => n.toLocaleString("pt-BR");

export function ComentariosPosts({
  inicial,
}: {
  inicial: { conta: string; posts: PostComComentarios[]; proximoCursor: string | null };
}) {
  const [posts, setPosts] = useState<PostComComentarios[]>(inicial.posts);
  const [cursor, setCursor] = useState<string | null>(inicial.proximoCursor);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [sel, setSel] = useState<PostComComentarios | null>(null);

  const carregarMais = async () => {
    if (!cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const r = await obterPostsComentarios(cursor);
      if (r.ok) {
        setPosts((atual) => [...atual, ...r.posts]);
        setCursor(r.proximoCursor);
      } else {
        toast.error(r.erro);
      }
    } finally {
      setCarregandoMais(false);
    }
  };

  if (sel) {
    return <PainelComentarios post={sel} onVoltar={() => setSel(null)} />;
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-10 text-center text-sm text-kx-legenda">
        Nenhum post encontrado no Instagram ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {posts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setSel(p)}
              className="group flex w-full gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-3 text-left transition-colors hover:border-kx-destaque focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
            >
              {p.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- mídia pública do post (CDN do Instagram)
                <img src={p.foto} alt="" className="h-20 w-20 shrink-0 rounded-kx-botao object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-kx-botao bg-kx-superficie text-kx-legenda">
                  <MessageCircle className="h-6 w-6" aria-hidden />
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="line-clamp-3 text-xs text-kx-texto-2">{p.conteudo || "Post sem legenda."}</p>
                <div className="mt-auto flex items-center gap-3 text-xs text-kx-legenda">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {numero(p.qtdComentarios)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" aria-hidden /> {numero(p.qtdCurtidas)}
                  </span>
                  <span className="ml-auto">{data(p.criadoEm)}</span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {cursor ? (
        <Button type="button" variant="ghost" size="sm" className="self-center" disabled={carregandoMais} onClick={() => void carregarMais()}>
          {carregandoMais ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Carregar mais posts
        </Button>
      ) : null}
    </div>
  );
}

type ComentarioLocal = ComentarioZernio & { respondido?: boolean };

function PainelComentarios({ post, onVoltar }: { post: PostComComentarios; onVoltar: () => void }) {
  const [comentarios, setComentarios] = useState<ComentarioLocal[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const carregar = async (cur?: string | null) => {
    const r = await obterComentariosDoPost(post.id, post.contaId, cur ?? undefined);
    if (r.ok) {
      setComentarios((atual) => (cur ? [...atual, ...r.comentarios] : r.comentarios));
      setCursor(r.proximoCursor);
      setErro(null);
    } else {
      setErro(r.erro);
    }
  };

  // Carrega os comentários ao montar o painel (o setState acontece depois do
  // await, não de forma síncrona no efeito).
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await obterComentariosDoPost(post.id, post.contaId);
      if (!vivo) return;
      if (r.ok) {
        setComentarios(r.comentarios);
        setCursor(r.proximoCursor);
        setErro(null);
      } else {
        setErro(r.erro);
      }
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [post.id, post.contaId]);

  const carregarMais = async () => {
    if (!cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      await carregar(cursor);
    } finally {
      setCarregandoMais(false);
    }
  };

  const aoResponder = (id: string) => {
    setComentarios((atual) => atual.map((c) => (c.id === id ? { ...c, respondido: true } : c)));
    setRespondendo(null);
  };

  const alternarOcultar = async (c: ComentarioLocal) => {
    const alvo = !c.oculto;
    const r = await ocultarComentarioPost(post.id, post.contaId, c.id, alvo);
    if (r.ok) {
      setComentarios((atual) => atual.map((x) => (x.id === c.id ? { ...x, oculto: alvo } : x)));
      toast.success(alvo ? "Comentário ocultado." : "Comentário reexibido.");
    } else {
      toast.error(r.erro ?? "Não foi possível alterar o comentário.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar aos posts
        </Button>
        {post.permalink ? (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-xs font-bold text-kx-info-texto hover:underline"
          >
            Abrir no Instagram <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="flex gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-3">
        {post.foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- mídia pública do post (CDN do Instagram)
          <img src={post.foto} alt="" className="h-16 w-16 shrink-0 rounded-kx-botao object-cover" referrerPolicy="no-referrer" />
        ) : null}
        <p className="line-clamp-3 text-xs text-kx-texto-2">{post.conteudo || "Post sem legenda."}</p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-kx-legenda" aria-hidden />
        </div>
      ) : erro ? (
        <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-4 py-6 text-center text-sm text-kx-legenda">{erro}</p>
      ) : comentarios.length === 0 ? (
        <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-4 py-6 text-center text-sm text-kx-legenda">
          Esse post ainda não tem comentários.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comentarios.map((c) => (
            <li key={c.id} className={cn("flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4", c.oculto && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {c.fotoAutor ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar público do Instagram
                    <img src={c.fotoAutor} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-sm font-bold text-kx-texto-2">
                      {c.autor.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-kx-texto">{c.autor}</span>
                    <div className="flex items-center gap-2 text-xs text-kx-legenda">
                      <span>{data(c.criadoEm)}</span>
                      {c.curtidas > 0 ? (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" aria-hidden /> {numero(c.curtidas)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {c.oculto ? (
                  <span className="shrink-0 rounded-kx-pilula bg-kx-superficie px-2 py-0.5 text-[11px] font-bold text-kx-legenda">Oculto</span>
                ) : null}
              </div>

              <p className="whitespace-pre-line text-sm text-kx-texto-2">{c.texto || <span className="italic text-kx-legenda">(sem texto)</span>}</p>

              {respondendo === c.id ? (
                <RespostaComentario
                  post={post}
                  comentario={c}
                  onCancelar={() => setRespondendo(null)}
                  onRespondido={() => aoResponder(c.id)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={c.respondido} onClick={() => setRespondendo(c.id)}>
                    <Send className="h-3.5 w-3.5" aria-hidden /> {c.respondido ? "Respondido" : "Responder"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void alternarOcultar(c)}>
                    {c.oculto ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
                    {c.oculto ? "Reexibir" : "Ocultar"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {cursor && !carregando ? (
        <Button type="button" variant="ghost" size="sm" className="self-center" disabled={carregandoMais} onClick={() => void carregarMais()}>
          {carregandoMais ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Carregar mais comentários
        </Button>
      ) : null}
    </div>
  );
}

function RespostaComentario({
  post,
  comentario,
  onCancelar,
  onRespondido,
}: {
  post: PostComComentarios;
  comentario: ComentarioZernio;
  onCancelar: () => void;
  onRespondido: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);

  const sugerir = async () => {
    setSugerindo(true);
    try {
      const r = await sugerirRespostaComentario({ autor: comentario.autor, texto: comentario.texto });
      if (r.ok) setTexto(r.sugestao.slice(0, LIMITE_RESPOSTA));
      else toast.error(r.erro + (r.configurar ? " (Configure a chave de IA.)" : ""));
    } catch {
      toast.error("Não foi possível sugerir agora.");
    } finally {
      setSugerindo(false);
    }
  };

  const enviar = async () => {
    const valor = texto.trim();
    if (!valor) {
      toast.error("Escreva a resposta.");
      return;
    }
    setEnviando(true);
    try {
      const r = await responderComentarioPost(post.id, post.contaId, comentario.id, valor);
      if (r.ok) {
        toast.success("Resposta publicada no Instagram.");
        onRespondido();
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
    <div className="flex flex-col gap-2 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie p-3">
      <Textarea
        rows={2}
        maxLength={LIMITE_RESPOSTA}
        autoFocus
        className="resize-none border-kx-campo-borda bg-kx-painel text-kx-texto placeholder:text-kx-placeholder"
        placeholder="Escreva a resposta, ou use Sugerir com IA…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={sugerindo} onClick={() => void sugerir()}>
            {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            Sugerir com IA
          </Button>
          <span className="text-xs text-kx-legenda">
            {texto.length}/{LIMITE_RESPOSTA}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={enviando || !texto.trim()} onClick={() => void enviar()}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
