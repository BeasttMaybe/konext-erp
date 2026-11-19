"use client";

import { useState } from "react";
import { CheckCheck, Loader2, Send, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";

import { prepararRespostasPendentes, responderAvaliacaoGoogle, type RascunhoAvaliacao } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LIMITE_RESPOSTA = 500;

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

type Rascunho = RascunhoAvaliacao & { texto_resposta: string };

export function RespostasPendentesLote() {
  const [preparando, setPreparando] = useState(false);
  const [preparado, setPreparado] = useState(false);
  const [itens, setItens] = useState<Rascunho[]>([]);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [enviandoTodas, setEnviandoTodas] = useState(false);

  const preparar = async () => {
    setPreparando(true);
    try {
      const r = await prepararRespostasPendentes();
      if (r.ok) {
        setPreparado(true);
        setItens(r.itens.map((i) => ({ ...i, texto_resposta: i.sugestao })));
        if (r.itens.length === 0) toast.success("Tudo respondido por aqui. 🎉");
      } else {
        toast.error(r.erro + (r.configurar ? " (Configure a chave de IA.)" : ""));
      }
    } catch {
      toast.error("Não foi possível preparar as respostas agora.");
    } finally {
      setPreparando(false);
    }
  };

  const mudarTexto = (id: string, valor: string) => {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, texto_resposta: valor.slice(0, LIMITE_RESPOSTA) } : i)));
  };

  // Envia UMA avaliação. Devolve true se publicou, pra "Enviar todas" saber contar.
  const enviarUma = async (item: Rascunho): Promise<boolean> => {
    const valor = item.texto_resposta.trim();
    if (!valor) {
      toast.error("Escreva a resposta antes de enviar.");
      return false;
    }
    try {
      const r = await responderAvaliacaoGoogle(item.id, item.contaId, valor);
      if (r.ok) {
        setItens((atual) => atual.filter((i) => i.id !== item.id));
        return true;
      }
      toast.error(r.erro ?? "Não foi possível responder.");
      return false;
    } catch {
      toast.error("Não foi possível responder agora.");
      return false;
    }
  };

  const enviar = async (item: Rascunho) => {
    setEnviandoId(item.id);
    try {
      if (await enviarUma(item)) toast.success("Resposta publicada no Google.");
    } finally {
      setEnviandoId(null);
    }
  };

  const enviarTodas = async () => {
    const prontas = itens.filter((i) => i.texto_resposta.trim());
    if (prontas.length === 0) {
      toast.error("Nenhuma resposta preenchida para enviar.");
      return;
    }
    setEnviandoTodas(true);
    let enviadas = 0;
    try {
      for (const item of prontas) {
        setEnviandoId(item.id);
        if (await enviarUma(item)) enviadas += 1;
      }
    } finally {
      setEnviandoId(null);
      setEnviandoTodas(false);
    }
    if (enviadas > 0) toast.success(`${enviadas} ${enviadas === 1 ? "resposta publicada" : "respostas publicadas"} no Google.`);
  };

  const ocupado = preparando || enviandoTodas || enviandoId !== null;
  const prontas = itens.filter((i) => i.texto_resposta.trim()).length;

  return (
    <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-bold text-kx-texto">Responder pendentes em lote</h2>
          <span className="text-xs text-kx-legenda">A IA escreve um rascunho pra cada avaliação sem resposta. Você revisa, edita e envia.</span>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={preparando || enviandoTodas} onClick={() => void preparar()}>
          {preparando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
          {preparado ? "Preparar de novo" : "Preparar respostas com IA"}
        </Button>
      </div>

      {preparando ? (
        <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-superficie px-4 py-6 text-center text-sm text-kx-legenda">
          A IA está escrevendo os rascunhos…
        </p>
      ) : !preparado ? null : itens.length === 0 ? (
        <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-superficie px-4 py-6 text-center text-sm text-kx-legenda">
          Tudo respondido por aqui. 🎉
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {itens.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie p-4">
                <div className="flex items-center gap-2.5">
                  {a.fotoAutor ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar público do Google
                    <img src={a.fotoAutor} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kx-painel text-xs font-bold text-kx-texto-2">
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

                {a.texto ? (
                  <p className="whitespace-pre-line text-sm text-kx-texto-2">{a.texto}</p>
                ) : (
                  <p className="text-sm italic text-kx-legenda">Avaliação sem texto.</p>
                )}

                <Textarea
                  rows={3}
                  maxLength={LIMITE_RESPOSTA}
                  className="resize-none border-kx-campo-borda bg-kx-painel text-kx-texto placeholder:text-kx-placeholder"
                  placeholder="Rascunho da IA aparece aqui. Edite à vontade antes de enviar."
                  value={a.texto_resposta}
                  onChange={(e) => mudarTexto(a.id, e.target.value)}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-kx-legenda">
                    {a.texto_resposta.length}/{LIMITE_RESPOSTA}
                  </span>
                  <Button type="button" size="sm" disabled={ocupado || !a.texto_resposta.trim()} onClick={() => void enviar(a)}>
                    {enviandoId === a.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                    Enviar
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-kx-painel-borda pt-3">
            <span className="text-xs text-kx-legenda">
              {prontas} de {itens.length} {itens.length === 1 ? "pronta" : "prontas"} para enviar.
            </span>
            <Button type="button" disabled={ocupado || prontas === 0} onClick={() => void enviarTodas()}>
              {enviandoTodas ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCheck className="h-4 w-4" aria-hidden />}
              Enviar todas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
