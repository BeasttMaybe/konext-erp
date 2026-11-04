"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Loader2, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { enviarFotoDaOS } from "@/app/actions/fotos-os";
import { Button } from "@/components/ui/button";
import { MAXIMO_DE_FOTOS_POR_OS, formatarTamanho } from "@/lib/dominio/os/fotos";
import { reduzirImagem } from "@/lib/fotos/reduzir-imagem";

/**
 * Fotos tiradas DURANTE o cadastro da OS, antes de ela existir.
 *
 * O problema que isto resolve: no cadastro não há `ordemServicoId`, então não
 * há onde pendurar a foto. A saída preguiçosa seria mandar salvar e adicionar
 * depois na tela da OS — mas é no balcão, com o aparelho na mão e o cliente na
 * frente, que a foto do estado de entrada é tirada. Empurrar isso para "depois"
 * é como as fotos deixam de existir.
 *
 * Então as fotos ficam no navegador, já reduzidas, e sobem assim que a OS
 * nasce. Se o envio falhar, a OS já está criada e a tela diz quantas ficaram
 * para trás — perder a OS por causa de uma foto seria muito pior.
 *
 * Elas entram como momento ENTRADA, que é o que elas são: o registro de como o
 * aparelho chegou.
 */

export type FotoPendente = {
  /** Identificador só para a lista do React; some depois do envio. */
  id: string;
  arquivo: File;
  largura: number;
  altura: number;
  /** `URL.createObjectURL` da imagem reduzida, para a miniatura. */
  previa: string;
};

export type FotosPendentes = {
  fotos: FotoPendente[];
  preparando: boolean;
  adicionar: (lista: FileList | null) => Promise<void>;
  remover: (id: string) => void;
  limpar: () => void;
  /** Sobe o que está guardado. Devolve quantas subiram e quantas falharam. */
  enviarPara: (ordemServicoId: string) => Promise<{ enviadas: number; falhas: number }>;
};

/**
 * O estado mora no COMPONENTE QUE SALVA (a tela ou o modal), não aqui dentro
 * do assistente: quem chama `criarOrdemServico` é ele, e é ele que precisa do
 * id recém-criado para subir as fotos. O contexto só leva o estado para baixo,
 * até o passo que desenha o painel.
 */
export function useFotosPendentes(): FotosPendentes {
  const [fotos, setFotos] = useState<FotoPendente[]>([]);
  const [preparando, setPreparando] = useState(false);

  // As prévias são liberadas no desmonte. Sem isso, cada foto escolhida segura
  // memória até a página recarregar.
  const previasVivas = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const previa of previasVivas.current) URL.revokeObjectURL(previa);
    },
    []
  );

  const adicionar = useCallback(async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;

    setPreparando(true);

    for (const original of Array.from(lista)) {
      try {
        const reduzida = await reduzirImagem(original);
        const previa = URL.createObjectURL(reduzida.arquivo);
        previasVivas.current.push(previa);

        setFotos((atuais) => {
          if (atuais.length >= MAXIMO_DE_FOTOS_POR_OS) {
            toast.error(`O limite é de ${MAXIMO_DE_FOTOS_POR_OS} fotos por OS.`);
            return atuais;
          }

          return [
            ...atuais,
            {
              id: `${Date.now()}-${atuais.length}-${original.name}`,
              arquivo: reduzida.arquivo,
              largura: reduzida.largura,
              altura: reduzida.altura,
              previa,
            },
          ];
        });
      } catch (erro) {
        toast.error(
          erro instanceof Error
            ? `${original.name}: ${erro.message}`
            : "Não foi possível preparar a imagem."
        );
      }
    }

    setPreparando(false);
  }, []);

  const remover = useCallback((id: string) => {
    setFotos((atuais) => {
      const alvo = atuais.find((foto) => foto.id === id);
      if (alvo) URL.revokeObjectURL(alvo.previa);
      return atuais.filter((foto) => foto.id !== id);
    });
  }, []);

  const limpar = useCallback(() => {
    setFotos((atuais) => {
      for (const foto of atuais) URL.revokeObjectURL(foto.previa);
      return [];
    });
  }, []);

  const enviarPara = useCallback(
    async (ordemServicoId: string) => {
      let enviadas = 0;
      let falhas = 0;

      // Uma por vez: a internet de uma loja não melhora com uploads em
      // paralelo, e em série cada foto que já subiu está salva mesmo se a
      // seguinte falhar.
      for (const foto of fotos) {
        const dados = new FormData();
        dados.set("ordemServicoId", ordemServicoId);
        dados.set("momento", "ENTRADA");
        dados.set("arquivo", foto.arquivo);
        dados.set("largura", String(foto.largura));
        dados.set("altura", String(foto.altura));

        try {
          const resultado = await enviarFotoDaOS(dados);
          if (resultado.sucesso) enviadas += 1;
          else falhas += 1;
        } catch {
          falhas += 1;
        }
      }

      return { enviadas, falhas };
    },
    [fotos]
  );

  return { fotos, preparando, adicionar, remover, limpar, enviarPara };
}

type ValorDoContexto = FotosPendentes & {
  /**
   * Salva a OS agora e abre o link de envio pelo celular.
   *
   * Ausente quando o assistente não tem como fazer isso — e aí o botão
   * simplesmente não aparece, em vez de aparecer sem funcionar.
   */
  salvarEPedirLinkDoCelular?: () => void;
};

const Contexto = createContext<ValorDoContexto | null>(null);

export function ProvedorFotosPendentes({
  valor,
  salvarEPedirLinkDoCelular,
  children,
}: {
  valor: FotosPendentes;
  salvarEPedirLinkDoCelular?: () => void;
  children: React.ReactNode;
}) {
  const contexto = useMemo(
    () => ({ ...valor, salvarEPedirLinkDoCelular }),
    [valor, salvarEPedirLinkDoCelular]
  );

  return <Contexto.Provider value={contexto}>{children}</Contexto.Provider>;
}

/**
 * O painel das fotos da entrada.
 *
 * Fora do provedor ele não aparece, em vez de quebrar: o assistente de nova OS
 * é usado em dois lugares (a tela e o modal), e um terceiro uso futuro que
 * esqueça o provedor deve perder o painel, não a tela inteira.
 */
export function PainelFotosDaEntrada() {
  const pendentes = useContext(Contexto);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  if (!pendentes) return null;

  const cheia = pendentes.fotos.length >= MAXIMO_DE_FOTOS_POR_OS;

  return (
    <div className="flex flex-col gap-3 rounded-kx-cartao bg-kx-superficie p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-bold text-kx-texto">Fotos da entrada</span>
        <span className="text-xs text-kx-legenda">
          Como o aparelho chegou — é o que responde “já veio assim” depois
        </span>

        {/* O link do celular SALVA a OS antes de abrir, e o rótulo diz isso.
            Não é escolha de estilo: durante o cadastro a OS ainda não existe,
            e um link de fotos precisa de uma OS a que se ligar. A alternativa
            seria guardar as fotos num rascunho e colá-las depois — o que, em
            cadastro abandonado, deixaria arquivo no bucket para sempre.
            Salvar primeiro não perde nada: era o que ia acontecer de todo
            jeito, só que agora. */}
        {pendentes.salvarEPedirLinkDoCelular && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={pendentes.preparando}
            onClick={pendentes.salvarEPedirLinkDoCelular}
          >
            <Smartphone className="h-4 w-4" />
            Salvar e enviar pelo celular
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className={pendentes.salvarEPedirLinkDoCelular ? undefined : "ml-auto"}
          disabled={pendentes.preparando || cheia}
          onClick={() => entradaDeArquivo.current?.click()}
        >
          {pendentes.preparando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {pendentes.preparando ? "Preparando..." : "Adicionar"}
        </Button>
      </div>

      {/* `capture` não é usado de propósito: no celular ele força a câmera e
          esconde a galeria, e boa parte das fotos já foi tirada antes. */}
      <input
        ref={entradaDeArquivo}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(evento) => void pendentes.adicionar(evento.target.files)}
      />

      {pendentes.fotos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-kx-botao border border-dashed border-kx-campo-borda bg-kx-cartao px-4 py-8 text-center">
          <ImageOff className="h-6 w-6 text-kx-legenda" aria-hidden />
          <span className="text-xs text-kx-legenda">
            Nenhuma foto ainda. Elas sobem junto quando você salvar a OS.
          </span>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {pendentes.fotos.map((foto) => (
            <li key={foto.id} className="group relative">
              <div className="aspect-square overflow-hidden rounded-kx-botao border border-kx-campo-borda bg-kx-cartao">
                {/* eslint-disable-next-line @next/next/no-img-element --
                    é um blob local do navegador; o otimizador do Next não
                    alcança object URL. */}
                <img
                  src={foto.previa}
                  alt="Foto do aparelho na entrada"
                  className="h-full w-full object-cover"
                />
              </div>

              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => pendentes.remover(foto.id)}
                className="absolute right-1 top-1 rounded-kx-botao bg-kx-fundo/80 p-1.5 text-kx-erro-icone opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <span className="mt-1 block text-center text-[10px] tabular-nums text-kx-legenda">
                {formatarTamanho(foto.arquivo.size)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <span className="text-xs text-kx-legenda">
        {cheia
          ? `Limite de ${MAXIMO_DE_FOTOS_POR_OS} fotos atingido.`
          : "As fotos são reduzidas aqui no navegador antes de subir, e vão junto com a OS ao salvar."}
      </span>
    </div>
  );
}
