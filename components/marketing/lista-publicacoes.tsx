"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Image as ImageIcon, Megaphone, Pencil, Plus, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { cancelarPublicacao, excluirPublicacao, publicarPublicacao, type PublicacaoDaLista } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
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
import { ROTULO_CANAL } from "@/lib/dominio/marketing/plataformas";
import { rotuloStatus, type StatusPublicacao } from "@/lib/dominio/marketing/publicacao";
import { cn } from "@/lib/utils";

const COR_STATUS: Record<StatusPublicacao, string> = {
  RASCUNHO: "bg-kx-superficie text-kx-texto-2",
  AGENDADA: "bg-kx-info-fundo text-kx-info-texto",
  PUBLICANDO: "bg-kx-alerta-fundo text-kx-alerta-texto",
  PUBLICADA: "bg-kx-sucesso-fundo text-kx-sucesso-texto",
  FALHOU: "bg-kx-erro-fundo text-kx-erro-texto",
  CANCELADA: "bg-kx-superficie text-kx-legenda",
};

const formatarData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatarMoeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ListaPublicacoes({
  publicacoes,
  tipo,
}: {
  publicacoes: PublicacaoDaLista[];
  tipo: "POST_ORGANICO" | "ANUNCIO_PAGO";
}) {
  const router = useRouter();
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const ehAnuncio = tipo === "ANUNCIO_PAGO";
  const base = ehAnuncio ? "/marketing/anuncios" : "/marketing/publicacoes";

  const cancelar = (id: string) =>
    iniciar(async () => {
      const r = await cancelarPublicacao(id);
      if (r.ok) toast.success("Cancelada.");
      else toast.error(r.erro);
      router.refresh();
    });

  const publicar = (id: string) =>
    iniciar(async () => {
      const r = await publicarPublicacao(id);
      if (r.ok) toast.success(r.status === "AGENDADA" ? "Agendada." : "Publicado! 🎉");
      else toast.error(r.erro);
      router.refresh();
    });

  const excluir = () => {
    const id = confirmarExclusao;
    if (!id) return;
    setConfirmarExclusao(null);
    iniciar(async () => {
      const r = await excluirPublicacao(id);
      if (r.ok) toast.success("Excluída.");
      else toast.error(r.erro);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Marketing</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">{ehAnuncio ? "Anúncios" : "Publicações"}</h1>
        </div>
        <Button asChild>
          <Link href={`${base}/nova`}>
            <Plus className="h-4 w-4" />
            {ehAnuncio ? "Novo anúncio" : "Nova publicação"}
          </Link>
        </Button>
      </div>

      {ehAnuncio ? (
        <p className="flex items-start gap-2 rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-4 py-3 text-sm text-kx-alerta-texto">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Anúncio gasta verba: o sistema prepara a campanha e espera sua aprovação antes de publicar. Nada é veiculado automaticamente.
        </p>
      ) : null}

      {publicacoes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-10 text-center">
          <p className="text-sm font-bold text-kx-texto">{ehAnuncio ? "Nenhum anúncio ainda" : "Nenhuma publicação ainda"}</p>
          <p className="text-sm text-kx-legenda">Crie {ehAnuncio ? "o primeiro anúncio" : "o primeiro post"} e ele aparece aqui.</p>
          <Button asChild variant="outline">
            <Link href={`${base}/nova`}>
              <Plus className="h-4 w-4" />
              Criar
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {publicacoes.map((p) => {
            const editavel = p.status === "RASCUNHO" || p.status === "AGENDADA" || p.status === "FALHOU";
            return (
              <li key={p.id} className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-kx-pilula px-2 py-0.5 text-[11px] font-bold", COR_STATUS[p.status])}>{rotuloStatus(p.status)}</span>
                    {p.canais.map((c) => (
                      <span key={c} className="rounded-kx-pilula bg-kx-superficie px-2 py-0.5 text-[11px] text-kx-texto-2">
                        {ROTULO_CANAL[c]}
                      </span>
                    ))}
                    {p.temMidia ? <ImageIcon className="h-3.5 w-3.5 text-kx-legenda" aria-hidden /> : null}
                  </div>
                  <p className="line-clamp-2 whitespace-pre-line text-sm text-kx-texto">{p.texto}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-kx-legenda">
                    {p.agendadoPara ? (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" aria-hidden /> {p.publicadoEm ? "Publicada" : "Agendada"}: {formatarData(p.publicadoEm ?? p.agendadoPara)}
                      </span>
                    ) : (
                      <span>Criada em {formatarData(p.criadoEm)}</span>
                    )}
                    {p.orcamentoCentavos ? <span>Verba: {formatarMoeda(p.orcamentoCentavos)}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!ehAnuncio && (p.status === "RASCUNHO" || p.status === "FALHOU") ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-kx-sucesso-texto"
                      disabled={ocupado}
                      onClick={() => publicar(p.id)}
                      title="Publicar agora"
                      aria-label="Publicar agora"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {editavel ? (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Editar">
                      <Link href={`${base}/${p.id}/editar`} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {(p.status === "AGENDADA" || p.status === "RASCUNHO" || p.status === "FALHOU") ? (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={ocupado} onClick={() => cancelar(p.id)} title="Cancelar" aria-label="Cancelar">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-kx-erro-texto"
                    disabled={ocupado}
                    onClick={() => setConfirmarExclusao(p.id)}
                    title="Excluir"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={confirmarExclusao !== null} onOpenChange={(a) => !a && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta publicação?</AlertDialogTitle>
            <AlertDialogDescription>Isso apaga o rascunho e as imagens dele. Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
