"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, ImageOff, Loader2, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  apagarFotoDaOS,
  enviarFotoDaOS,
  listarFotosDaOS,
  obterSituacaoFotosDaOS,
  type FotoDaOS,
} from "@/app/actions/fotos-os";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import {
  MOMENTOS_DA_FOTO,
  formatarTamanho,
  rotuloDoMomento,
  type MomentoFoto,
} from "@/lib/dominio/os/fotos";
import { reduzirImagem } from "@/lib/fotos/reduzir-imagem";
import { PainelLinkDoCelular } from "@/components/os/fotos/painel-link-do-celular";

/**
 * Fotos do aparelho.
 *
 * Esta seção existia desde a Fase 3-2B com os dois botões DESABILITADOS e o
 * texto "chega numa fase futura", porque não havia onde guardar arquivo. Agora
 * há: bucket no R2, conferido pelo diagnóstico em Configurações.
 *
 * As fotos ficam separadas por MOMENTO, e isso não é organização por
 * organização: a foto de entrada e a de entrega são provas diferentes. A de
 * entrada responde "já veio com essa trinca"; a de entrega responde "saiu
 * daqui funcionando". Misturar as duas numa lista só apagaria exatamente o que
 * faz a foto valer alguma coisa numa discussão com o cliente.
 *
 * Nada aqui é obrigatório. A loja não pode travar um atendimento porque a
 * câmera falhou.
 */
export function SecaoFotosOS({ ordemServicoId }: { ordemServicoId: string }) {
  const podeEditar = useTemPermissao("os.editar");

  const [fotos, setFotos] = useState<FotoDaOS[] | null>(null);
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [limite, setLimite] = useState(20);
  const [enviando, setEnviando] = useState(false);
  const [painelDoCelularAberto, setPainelDoCelularAberto] = useState(false);
  const [momentoDoEnvio, setMomentoDoEnvio] = useState<MomentoFoto>("ENTRADA");
  const [ampliada, setAmpliada] = useState<FotoDaOS | null>(null);
  const [paraApagar, setParaApagar] = useState<FotoDaOS | null>(null);
  const [emTransicao, iniciarTransicao] = useTransition();

  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const [situacao, lista] = await Promise.all([
      obterSituacaoFotosDaOS(ordemServicoId),
      listarFotosDaOS(ordemServicoId),
    ]);

    setConfigurado(situacao.armazenamentoConfigurado);
    setLimite(situacao.limite);
    setFotos(lista);
  }, [ordemServicoId]);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        await carregar();
      } catch {
        if (!ativo) return;
        // Falhar em carregar não pode deixar a seção em esqueleto para sempre:
        // lista vazia e aviso de "não configurado" é o estado honesto quando
        // não se conseguiu perguntar.
        setFotos([]);
        setConfigurado(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [carregar]);

  const aoEscolherArquivos = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;

    setEnviando(true);

    // Uma por vez, e não em paralelo: a internet de uma loja não melhora com
    // quatro uploads simultâneos, e em série cada foto que já subiu está
    // salva mesmo se a seguinte falhar.
    let enviadas = 0;

    for (const original of Array.from(lista)) {
      try {
        const reduzida = await reduzirImagem(original);

        const dados = new FormData();
        dados.set("ordemServicoId", ordemServicoId);
        dados.set("momento", momentoDoEnvio);
        dados.set("arquivo", reduzida.arquivo);
        dados.set("largura", String(reduzida.largura));
        dados.set("altura", String(reduzida.altura));

        const resultado = await enviarFotoDaOS(dados);

        if (resultado.sucesso) enviadas += 1;
        else toast.error(`${original.name}: ${resultado.erro}`);
      } catch (erro) {
        toast.error(
          erro instanceof Error ? `${original.name}: ${erro.message}` : "Falha ao preparar a imagem."
        );
      }
    }

    if (enviadas > 0) {
      toast.success(enviadas === 1 ? "Foto adicionada." : `${enviadas} fotos adicionadas.`);
      await carregar();
    }

    setEnviando(false);
    if (entradaDeArquivo.current) entradaDeArquivo.current.value = "";
  };

  const confirmarRemocao = () => {
    if (!paraApagar) return;
    const alvo = paraApagar;
    setParaApagar(null);

    iniciarTransicao(async () => {
      const resultado = await apagarFotoDaOS(alvo.id);

      if (resultado.sucesso) {
        toast.success(resultado.mensagem);
        await carregar();
      } else {
        toast.error(resultado.erro);
      }
    });
  };

  const total = fotos?.length ?? 0;
  const cheia = total >= limite;

  return (
    <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-kx-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-bold text-kx-texto">Fotos do aparelho</span>
        <span className="rounded-kx-pilula bg-kx-cartao px-2 py-0.5 text-[11px] font-bold tabular-nums text-kx-texto-2">
          {total}
        </span>

        {podeEditar && configurado && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPainelDoCelularAberto(true)}
            >
              <Smartphone className="h-4 w-4" />
              Enviar pelo celular
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={enviando || cheia}
              onClick={() => entradaDeArquivo.current?.click()}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {enviando ? "Enviando..." : "Adicionar"}
            </Button>
          </div>
        )}
      </div>

      {podeEditar && configurado && (
        <>
          {/* `capture` não é usado de propósito: no celular ele força a câmera
              e esconde a galeria, e boa parte das fotos já foi tirada antes. */}
          <input
            ref={entradaDeArquivo}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(evento) => void aoEscolherArquivos(evento.target.files)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-kx-legenda">Adicionar como:</span>
            {MOMENTOS_DA_FOTO.map((momento) => (
              <button
                key={momento.valor}
                type="button"
                aria-pressed={momentoDoEnvio === momento.valor}
                title={momento.ajuda}
                onClick={() => setMomentoDoEnvio(momento.valor)}
                className={
                  momentoDoEnvio === momento.valor
                    ? "rounded-kx-pilula border border-kx-primaria bg-kx-primaria px-3 py-1 text-xs font-bold text-primary-foreground"
                    : "rounded-kx-pilula border border-kx-campo-borda px-3 py-1 text-xs font-semibold text-kx-texto-2 hover:text-kx-texto"
                }
              >
                {momento.rotulo}
              </button>
            ))}
          </div>

          {cheia && (
            <p className="text-xs font-semibold text-kx-alerta-texto">
              Esta OS chegou no limite de {limite} fotos. Apague alguma para adicionar outra.
            </p>
          )}
        </>
      )}

      {configurado === false && (
        <div className="rounded-kx-cartao border border-dashed border-kx-painel-borda py-8 text-center">
          <ImageOff className="mx-auto h-6 w-6 text-kx-legenda" aria-hidden />
          <p className="mt-2 text-xs text-kx-legenda">
            O armazenamento de fotos ainda não está configurado.
          </p>
          <p className="mt-1 text-xs text-kx-legenda">
            Quem administra o sistema resolve isso em Configurações → Armazenamento de fotos.
          </p>
        </div>
      )}

      {fotos === null && configurado !== false && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, indice) => (
            <div
              key={indice}
              className="aspect-square animate-pulse rounded-kx-botao bg-kx-superficie"
            />
          ))}
        </div>
      )}

      {fotos !== null && configurado && total === 0 && (
        <div className="rounded-kx-cartao border border-dashed border-kx-painel-borda py-8 text-center">
          <ImageOff className="mx-auto h-6 w-6 text-kx-legenda" aria-hidden />
          <p className="mt-2 text-xs text-kx-legenda">
            Nenhuma foto ainda. Foto na entrada é o que responde “já veio assim” depois.
          </p>
        </div>
      )}

      {fotos !== null && total > 0 && (
        <div className="flex flex-col gap-4">
          {MOMENTOS_DA_FOTO.map((momento) => {
            const doMomento = fotos.filter((foto) => foto.momento === momento.valor);
            if (doMomento.length === 0) return null;

            return (
              <div key={momento.valor}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kx-legenda">
                  {momento.rotulo} · {doMomento.length}
                </p>

                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {doMomento.map((foto) => (
                    <li key={foto.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setAmpliada(foto)}
                        className="block aspect-square w-full overflow-hidden rounded-kx-botao border border-kx-painel-borda bg-kx-superficie"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element --
                            a URL é assinada e expira em minutos; o otimizador de
                            imagem do Next guardaria em cache uma URL que morre,
                            e a foto passaria a não carregar. */}
                        <img
                          src={foto.url}
                          alt={`Foto do aparelho — ${rotuloDoMomento(foto.momento)}`}
                          loading="lazy"
                          width={foto.largura ?? undefined}
                          height={foto.altura ?? undefined}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </button>

                      {podeEditar && (
                        <button
                          type="button"
                          aria-label="Remover foto"
                          disabled={emTransicao}
                          onClick={() => setParaApagar(foto)}
                          className="absolute right-1 top-1 rounded-kx-botao bg-kx-fundo/80 p-1.5 text-kx-erro-icone opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={ampliada !== null} onOpenChange={(aberto) => !aberto && setAmpliada(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {ampliada ? rotuloDoMomento(ampliada.momento) : "Foto"}
            </DialogTitle>
            <DialogDescription>
              {ampliada && (
                <>
                  {new Date(ampliada.criadoEm).toLocaleString("pt-BR")}
                  {" · "}
                  {formatarTamanho(ampliada.tamanhoBytes)}
                  {ampliada.enviadaPeloCelular
                    ? " · enviada pelo celular"
                    : ampliada.enviadaPorNome
                      ? ` · por ${ampliada.enviadaPorNome}`
                      : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {ampliada && (
            // eslint-disable-next-line @next/next/no-img-element -- ver acima
            <img
              src={ampliada.url}
              alt={`Foto do aparelho — ${rotuloDoMomento(ampliada.momento)}`}
              className="max-h-[70vh] w-full rounded-kx-botao object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paraApagar !== null} onOpenChange={(aberto) => !aberto && setParaApagar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover esta foto?</DialogTitle>
            <DialogDescription>
              A foto é apagada do armazenamento e não volta. Se ela for a prova de como o aparelho
              chegou, pense duas vezes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setParaApagar(null)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-kx-erro-borda text-kx-erro-texto hover:bg-kx-erro-fundo"
              disabled={emTransicao}
              onClick={confirmarRemocao}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PainelLinkDoCelular
        ordemServicoId={ordemServicoId}
        aberto={painelDoCelularAberto}
        aoFechar={() => setPainelDoCelularAberto(false)}
      />
    </div>
  );
}
