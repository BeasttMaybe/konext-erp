"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  enviarMidiaDaPublicacao,
  removerMidiaDaPublicacao,
  salvarPublicacao,
  type MidiaDaPublicacao,
  type PublicacaoParaEditar,
} from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CANAIS_ORGANICOS, ROTULO_CANAL, type CanalMarketing } from "@/lib/dominio/marketing/plataformas";
import { LIMITE_TEXTO } from "@/lib/dominio/marketing/publicacao";

type Tipo = "POST_ORGANICO" | "ANUNCIO_PAGO";

/** Converte um instante ISO para o valor de um <input type="datetime-local">. */
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CompositorPublicacao({ tipo, publicacao }: { tipo: Tipo; publicacao?: PublicacaoParaEditar }) {
  const router = useRouter();
  const ehAnuncio = tipo === "ANUNCIO_PAGO";
  const base = ehAnuncio ? "/marketing/anuncios" : "/marketing/publicacoes";

  const [id, setId] = useState<string | null>(publicacao?.id ?? null);
  const [texto, setTexto] = useState(publicacao?.texto ?? "");
  const [canais, setCanais] = useState<Set<CanalMarketing>>(() => new Set(publicacao?.canais ?? (ehAnuncio ? ["INSTAGRAM"] : [])));
  const [agendadoPara, setAgendadoPara] = useState(paraInputLocal(publicacao?.agendadoPara ?? null));
  const [orcamento, setOrcamento] = useState(publicacao?.orcamentoCentavos ? (publicacao.orcamentoCentavos / 100).toFixed(2).replace(".", ",") : "");
  const [linkDestino, setLinkDestino] = useState(publicacao?.linkDestino ?? "");
  const [midias, setMidias] = useState<MidiaDaPublicacao[]>(publicacao?.midias ?? []);
  const [salvando, setSalvando] = useState(false);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const alternarCanal = (canal: CanalMarketing) =>
    setCanais((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(canal)) proxima.delete(canal);
      else proxima.add(canal);
      return proxima;
    });

  const salvar = async (irParaLista: boolean) => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarPublicacao(id, {
        tipo,
        texto,
        canais: [...canais],
        agendadoPara: agendadoPara ? new Date(agendadoPara).toISOString() : "",
        orcamento,
        linkDestino,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setId(r.id);
      if (irParaLista) {
        toast.success(ehAnuncio ? "Anúncio salvo." : "Publicação salva.");
        router.push(base);
        router.refresh();
      } else {
        toast.success("Salvo. Agora você pode adicionar imagens.");
        router.refresh();
      }
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const enviarImagem = async (arquivo: File) => {
    if (!id) {
      setErro("Salve o texto primeiro; depois adicione as imagens.");
      return;
    }
    setEnviandoMidia(true);
    try {
      const fd = new FormData();
      fd.set("publicacaoId", id);
      fd.set("arquivo", arquivo);
      const r = await enviarMidiaDaPublicacao(fd);
      if (r.ok) setMidias((m) => [...m, r.midia]);
      else toast.error(r.erro);
    } catch {
      toast.error("Não foi possível enviar a imagem.");
    } finally {
      setEnviandoMidia(false);
      if (inputFoto.current) inputFoto.current.value = "";
    }
  };

  const removerImagem = async (midiaId: string) => {
    const r = await removerMidiaDaPublicacao(midiaId);
    if (r.ok) setMidias((m) => m.filter((x) => x.id !== midiaId));
    else toast.error("Não foi possível remover.");
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Marketing · {ehAnuncio ? "Anúncios" : "Publicações"}</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">
          {publicacao ? "Editar" : ehAnuncio ? "Novo anúncio" : "Nova publicação"}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mkt-texto" className="text-xs font-bold text-kx-texto">
              Texto da publicação
            </Label>
            <Textarea
              id="mkt-texto"
              rows={7}
              maxLength={LIMITE_TEXTO}
              className="border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder"
              placeholder="Escreva a legenda do post. Ex.: Troca de tela com garantia de 90 dias! Agende já no WhatsApp."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <span className="self-end text-xs text-kx-legenda">
              {texto.length}/{LIMITE_TEXTO}
            </span>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-bold text-kx-texto">Onde publicar</legend>
            <div className="flex flex-wrap gap-2">
              {CANAIS_ORGANICOS.map((canal) => (
                <label
                  key={canal}
                  className="flex cursor-pointer items-center gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 py-2 text-sm text-kx-texto"
                >
                  <Checkbox checked={canais.has(canal)} onCheckedChange={() => alternarCanal(canal)} />
                  {ROTULO_CANAL[canal]}
                </label>
              ))}
            </div>
          </fieldset>

          {ehAnuncio ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mkt-verba" className="text-xs font-bold text-kx-texto">
                  Verba (R$)
                </Label>
                <Input
                  id="mkt-verba"
                  inputMode="decimal"
                  placeholder="50,00"
                  className="h-11 border-kx-campo-borda bg-kx-superficie"
                  value={orcamento}
                  onChange={(e) => setOrcamento(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mkt-link" className="text-xs font-bold text-kx-texto">
                  Link de destino <span className="font-normal text-kx-legenda">(opcional)</span>
                </Label>
                <Input
                  id="mkt-link"
                  placeholder="https://wa.me/55..."
                  className="h-11 border-kx-campo-borda bg-kx-superficie"
                  value={linkDestino}
                  onChange={(e) => setLinkDestino(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mkt-quando" className="text-xs font-bold text-kx-texto">
              {ehAnuncio ? "Quando começar (opcional)" : "Agendar para (opcional)"}
            </Label>
            <Input
              id="mkt-quando"
              type="datetime-local"
              className="h-11 w-full border-kx-campo-borda bg-kx-superficie sm:w-64"
              value={agendadoPara}
              onChange={(e) => setAgendadoPara(e.target.value)}
            />
            <span className="text-xs text-kx-legenda">
              {ehAnuncio
                ? "O anúncio fica guardado como rascunho até você aprovar — não é publicado sozinho."
                : agendadoPara
                  ? "Será publicado automaticamente neste horário."
                  : "Sem data, fica como rascunho."}
            </span>
          </div>

          {erro ? (
            <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={salvando} onClick={() => void salvar(true)}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
            {!id ? (
              <Button type="button" variant="outline" disabled={salvando} onClick={() => void salvar(false)}>
                Salvar e adicionar imagens
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => router.push(base)}>
              Voltar
            </Button>
          </div>
        </div>

        {/* Imagens: só depois de a publicação existir (precisa de um id). */}
        <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <h2 className="text-[15px] font-bold text-kx-texto">Imagens</h2>
          {!id ? (
            <p className="text-sm text-kx-legenda">Salve a publicação primeiro para anexar imagens.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {midias.map((m) => (
                  <div key={m.id} className="group relative aspect-square overflow-hidden rounded-kx-botao border border-kx-painel-borda bg-kx-superficie">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do R2 */}
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => void removerImagem(m.id)}
                      className="absolute right-1 top-1 rounded-full bg-kx-erro p-1 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remover imagem"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={inputFoto}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviarImagem(f);
                }}
              />
              <Button type="button" variant="outline" size="sm" className="self-start" disabled={enviandoMidia} onClick={() => inputFoto.current?.click()}>
                {enviandoMidia ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" />}
                Adicionar imagem
              </Button>
              <span className="text-xs text-kx-legenda">JPG, PNG ou WebP, até 10 imagens.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
